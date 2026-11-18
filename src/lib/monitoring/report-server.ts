import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import {
  isControlFlowError,
  isReportingEnabled,
  releaseId,
  serialiseError,
  settleWithin,
  toRpcArgs,
  type ErrorReport,
  type ErrorSeverity,
} from "@/lib/monitoring/error-model"
import type { Database } from "@/types/database.types"

/**
 * Reports an error from server code: the log AND the durable record.
 *
 * It does two things, and they fail independently:
 *
 *  1. Always writes ONE structured JSON line to the server log. Vercel keeps logs
 *     for only an hour on this plan, but within that hour the line is searchable
 *     (`"event":"app_error"`), and it is the record of last resort if the database
 *     one fails.
 *  2. When reporting is switched on (Production only — see `isReportingEnabled`),
 *     records it durably through the `report_error` database function, where
 *     repeats of one problem are folded into one row with a counter.
 *
 * It NEVER throws and NEVER waits long. Reporting an error is the one thing that
 * must not be able to make the original problem worse: every failure inside is
 * swallowed, and the database call is abandoned after `timeoutMs`.
 *
 * It uses the public key with no session, so a server-side report carries no user
 * identity. That is deliberate — an error report is a poor place to put a person's
 * id — and it means the report works in contexts with no request (the Next.js
 * `onRequestError` hook) where cookies are not available.
 */

export type ReportClient = Pick<SupabaseClient<Database>, "rpc">

export interface ServerReportOptions {
  /** Where it was caught: "route", "action", "service:Weather", "ai-quota"… */
  context: string
  severity?: ErrorSeverity
  route?: string | null
  // The three below exist so tests can run this with no environment and no network.
  client?: ReportClient | null
  enabled?: boolean
  timeoutMs?: number
}

let cachedClient: ReportClient | null = null

function getClient(): ReportClient | null {
  if (cachedClient) return cachedClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  cachedClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

export async function reportServerError(
  error: unknown,
  options: ServerReportOptions
): Promise<void> {
  try {
    // redirect() and notFound() are thrown by design; they are not failures.
    if (isControlFlowError(error)) return

    const serialised = serialiseError(error)
    const severity = options.severity ?? "error"
    const report: ErrorReport = {
      source: "server",
      severity,
      context: options.context,
      name: serialised.name,
      message: serialised.message,
      stack: serialised.stack,
      route: options.route ?? null,
      digest: serialised.digest,
      release: releaseId(process.env.VERCEL_GIT_COMMIT_SHA),
      userAgent: null,
    }

    // 1. The log line. One line of JSON, so it can be searched and never spans
    // multiple log records.
    const line = JSON.stringify({ event: "app_error", ...report })
    if (severity === "warning") console.warn(line)
    else console.error(line)

    // 2. The durable record.
    const enabled =
      options.enabled ?? isReportingEnabled(process.env.NEXT_PUBLIC_ERROR_REPORTING)
    if (!enabled) return
    const client = options.client === undefined ? getClient() : options.client
    if (!client) return

    await settleWithin(client.rpc("report_error", toRpcArgs(report)), options.timeoutMs ?? 2500)
  } catch (inner) {
    // Last resort. Plain console, never a recursive report.
    console.error("[monitoring] could not report an error", inner)
  }
}
