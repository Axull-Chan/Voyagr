import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveProviderId } from "@/lib/ai"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  AI_RESERVATION_WINDOW_MS,
  AI_USAGE_WINDOW_MS,
  countActiveUsage,
  describeQuotaBlock,
  getAiLimits,
  remainingAllowance,
  type AiQuotaHint,
  type AiUsageKind,
} from "@/lib/ai/usage-limits"
import type { Database } from "@/types/database.types"

type Client = SupabaseClient<Database>

/**
 * Reserve, then confirm, a slot of AI usage.
 *
 * The call sequence around a model request is:
 *
 *   const quota = await reserveAiQuota(supabase, "trip_generation")
 *   if (!quota.allowed) return { ok: false, error: quota.message }
 *   ...the model call...
 *   await confirmAiQuota(supabase, quota.usageId)   // only once it has succeeded
 *
 * A call that fails is never confirmed, so its reservation lapses on its own and
 * a provider outage does not burn anyone's allowance. There is deliberately no
 * "refund": a signed-in user can call database functions directly, so a refund
 * would be a way to hand yourself unlimited free calls. The reasoning and the
 * database side are in the `add_ai_usage_limits` migration.
 *
 * FAILS OPEN. If the limiter itself breaks — the migration isn't applied yet, the
 * database is unreachable — the request is allowed and the problem is logged. A
 * broken safety mechanism must not take the product down with it, and the window
 * is bounded by how fast the error is noticed. (It also makes deploy order
 * irrelevant: shipping this code before the migration is applied is harmless.)
 * It does NOT fail open on a real "limit reached" answer.
 */

export type QuotaReservation =
  /** `usageId` is null when no slot was reserved (free mock provider, or the limiter was unavailable). */
  | { allowed: true; usageId: number | null }
  | { allowed: false; message: string }

interface ReserveOptions {
  /** For tests; defaults to the configured provider. */
  providerId?: string
  now?: Date
}

export async function reserveAiQuota(
  supabase: Client,
  kind: AiUsageKind,
  options: ReserveOptions = {}
): Promise<QuotaReservation> {
  // The mock provider costs nothing and has no quota to protect.
  let providerId: string
  try {
    providerId = options.providerId ?? resolveProviderId()
  } catch {
    // An unrecognised AI_PROVIDER: the action throws its own clear error when it
    // resolves the provider, so don't reserve a slot for a call that can't happen.
    return { allowed: true, usageId: null }
  }
  if (providerId === "mock") return { allowed: true, usageId: null }

  const limits = getAiLimits(kind)

  try {
    const { data, error } = await supabase.rpc("consume_ai_quota", {
      p_kind: kind,
      p_user_limit: limits.perUser,
      p_global_limit: limits.global,
    })

    const row = data?.[0]
    if (error || !row) {
      await reportServerError(error ?? new Error("consume_ai_quota returned no row"), {
        context: "ai-quota:reserve-failed-open",
      })
      return { allowed: true, usageId: null }
    }

    if (row.allowed) return { allowed: true, usageId: row.usage_id }

    return {
      allowed: false,
      message: describeQuotaBlock(
        kind,
        {
          reason: row.reason === "global" ? "global" : "user",
          resetsAt: row.resets_at,
          max: row.max_allowed,
        },
        options.now
      ),
    }
  } catch (error) {
    await reportServerError(error, { context: "ai-quota:reserve-threw-open" })
    return { allowed: true, usageId: null }
  }
}

/** Marks a reserved slot as used. Never throws: the model call already succeeded
 * and nothing here is worth failing the traveller's request over. */
export async function confirmAiQuota(
  supabase: Client,
  usageId: number | null
): Promise<void> {
  if (usageId === null) return
  try {
    const { error } = await supabase.rpc("confirm_ai_quota", { p_usage_id: usageId })
    if (error) await reportServerError(error, { context: "ai-quota:confirm-failed" })
  } catch (error) {
    await reportServerError(error, { context: "ai-quota:confirm-threw" })
  }
}

interface HintOptions {
  /** For tests; defaults to the configured provider. */
  providerId?: string
  now?: Date
  /** Gives up and returns null after this long. Default 1500 ms. */
  timeoutMs?: number
}

/**
 * How many uses of `kind` the signed-in traveller has left, for the "N left today"
 * caption. A HINT, not enforcement: `consume_ai_quota` alone decides, and it also
 * applies a GLOBAL limit that this cannot show (RLS lets a traveller read only their
 * own `ai_usage` rows). So "3 left" can still be refused when the whole site is out.
 *
 * It reads the traveller's own rows with their own session — the table's select-own
 * policy is exactly what permits that, so no new privileged function is involved —
 * and counts them with the same rule the database uses (`countActiveUsage`).
 *
 * Returns null — meaning "show nothing" — for the free mock provider (nothing is
 * limited), and on ANY failure or a slow database. It never throws and never makes
 * a page wait more than `timeoutMs`: a missing caption costs nothing, a broken
 * page costs a lot. Failures are reported as warnings.
 */
export async function getAiQuotaHint(
  supabase: Client,
  kind: AiUsageKind,
  options: HintOptions = {}
): Promise<AiQuotaHint | null> {
  let providerId: string
  try {
    providerId = options.providerId ?? resolveProviderId()
  } catch {
    return null
  }
  if (providerId === "mock") return null

  const now = options.now ?? new Date()
  const { perUser } = getAiLimits(kind)
  const since = new Date(now.getTime() - AI_USAGE_WINDOW_MS).toISOString()
  const reservedSince = new Date(now.getTime() - AI_RESERVATION_WINDOW_MS).toISOString()

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Narrowed to rows that can count (confirmed within 24 h, or a reservation
    // within 3 min) so stale, never-confirmed reservations don't pad the result;
    // `countActiveUsage` then applies the exact rule. No row limit is set: what
    // survives the filter is bounded by the usage limit itself. (PostgREST caps a
    // response at its own max-rows, 1000 by default, far above the default limits;
    // a hint tolerates that edge.)
    const query = supabase
      .from("ai_usage")
      .select("status, created_at")
      .eq("kind", kind)
      .gt("created_at", since)
      .or(`status.eq.ok,created_at.gt.${reservedSince}`)

    const timedOut = Symbol("timed out")
    const result = await Promise.race([
      Promise.resolve(query),
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), options.timeoutMs ?? 1500)
      }),
    ])

    if (result === timedOut) return null
    if (result.error || !result.data) {
      await reportServerError(result.error ?? new Error("ai_usage returned no data"), {
        context: "ai-quota:hint-failed",
        severity: "warning",
      })
      return null
    }

    const used = countActiveUsage(result.data, now)
    return { remaining: remainingAllowance(perUser, used), max: perUser }
  } catch (error) {
    await reportServerError(error, { context: "ai-quota:hint-threw", severity: "warning" })
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}
