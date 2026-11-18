import {
  ReportGate,
  classifyClientSeverity,
  isReportingEnabled,
  releaseId,
  serialiseError,
  shouldIgnoreClientError,
  toRpcArgs,
  type ErrorReport,
  type ErrorSeverity,
} from "@/lib/monitoring/error-model"
import { createClient } from "@/lib/supabase/client"

/**
 * Reports an error from the browser.
 *
 * A browser's console is invisible to us, so before this an error on a visitor's
 * phone left no trace anywhere. This sends it to the same durable record the
 * server uses (`report_error`), with the page and the browser's user-agent so a
 * problem that only affects one browser is visible as such.
 *
 * It NEVER throws, and it is throttled: at most ten distinct problems per page
 * load, each once, so a render loop cannot turn into a flood of requests. Noise
 * that says nothing about our code (extension errors, cross-origin "Script error.",
 * ResizeObserver) is dropped.
 *
 * Switched on only for Production (`NEXT_PUBLIC_ERROR_REPORTING`), because
 * development and previews share the production database.
 */

const gate = new ReportGate(10)

export interface ClientReportOptions {
  context: string
  severity?: ErrorSeverity
}

export async function reportClientError(
  error: unknown,
  options: ClientReportOptions
): Promise<void> {
  try {
    const serialised = serialiseError(error)
    if (shouldIgnoreClientError(serialised)) return

    // The developer console still gets it, as before.
    console.error(error)

    // An error with a digest came from the SERVER: Next hides its real message from
    // the browser in production and sends only a generic placeholder plus this digest.
    // `onRequestError` has already recorded it, properly, with the real message and
    // stack and the same digest. Reporting it again from here would add a second row
    // that says nothing useful and spend part of the hourly allowance for new kinds
    // of problem. The digest is what ties the two together.
    if (serialised.digest) return

    if (!isReportingEnabled(process.env.NEXT_PUBLIC_ERROR_REPORTING)) return
    if (!gate.allow(`${serialised.name}|${serialised.message}`)) return

    const report: ErrorReport = {
      source: "client",
      severity: options.severity ?? classifyClientSeverity(serialised.message),
      context: options.context,
      name: serialised.name,
      message: serialised.message,
      stack: serialised.stack,
      route: window.location.pathname,
      digest: serialised.digest,
      release: releaseId(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA),
      userAgent: navigator.userAgent,
    }

    await createClient().rpc("report_error", toRpcArgs(report))
  } catch {
    // Never let reporting an error become another error.
  }
}

/**
 * Catches what no React error boundary can: errors in event handlers, in timers and
 * in promises nobody awaited. Returns a function that removes the listeners.
 */
export function installGlobalErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) => {
    void reportClientError(event.error ?? event.message, { context: "window.onerror" })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    void reportClientError(event.reason, { context: "unhandledrejection" })
  }
  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onRejection)
  return () => {
    window.removeEventListener("error", onError)
    window.removeEventListener("unhandledrejection", onRejection)
  }
}
