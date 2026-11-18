/**
 * Error monitoring — the pure parts: describing an error, deciding what is noise,
 * and throttling the browser. No I/O, so it is all unit-tested.
 *
 * Reporting (report-server.ts, report-client.ts) is deliberately split from this so
 * that the decisions that matter — "is this worth recording?", "what do we call it?"
 * — can be tested without a database or a browser.
 */

export type ErrorSource = "server" | "client"
export type ErrorSeverity = "error" | "warning"

export interface SerialisedError {
  name: string
  message: string
  stack: string | null
  /** Next.js attaches a digest to server errors so the browser's generic error
   * page can be matched to the full error in the server log. */
  digest: string | null
}

export interface ErrorReport {
  source: ErrorSource
  severity: ErrorSeverity
  /** Where it was caught: "route", "action", "error-boundary", "service:Weather"… */
  context: string
  name: string
  message: string
  stack: string | null
  route: string | null
  digest: string | null
  release: string | null
  userAgent: string | null
}

// The database truncates too; trimming here keeps the payload small and means a
// pathological error (a 5 MB message) never leaves the process at all.
const MAX_MESSAGE = 500
const MAX_STACK = 4000
const MAX_CAUSE = 200

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return "[unserialisable value]"
  }
}

function digestOf(error: unknown): string | null {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest
    return typeof digest === "string" ? digest : null
  }
  return null
}

/**
 * Turns anything that can be thrown into a name, a message and a stack.
 *
 * JavaScript lets code throw strings, objects and `undefined`, and database
 * clients hand back plain `{ message }` objects rather than Error instances, so
 * this cannot assume `instanceof Error`. An error's `cause` is folded into the
 * message: the app wraps provider failures in its own error type, and the wrapper
 * alone ("We couldn't reach Gemini") hides the thing that actually went wrong.
 */
export function serialiseError(error: unknown): SerialisedError {
  if (error instanceof Error) {
    let message = error.message || "(no message)"
    const cause = (error as { cause?: unknown }).cause
    if (cause !== undefined && cause !== null) {
      const inner =
        cause instanceof Error
          ? `${cause.name}: ${cause.message}`
          : typeof cause === "string"
            ? cause
            : safeJson(cause)
      message = `${message} (caused by ${clip(inner, MAX_CAUSE)})`
    }
    return {
      name: error.name || "Error",
      message: clip(message, MAX_MESSAGE),
      stack: error.stack ? clip(error.stack, MAX_STACK) : null,
      digest: digestOf(error),
    }
  }

  if (typeof error === "string") {
    return { name: "NonError", message: clip(error || "(no message)", MAX_MESSAGE), stack: null, digest: null }
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message
    return {
      name: "NonError",
      message: clip(typeof message === "string" && message ? message : safeJson(error), MAX_MESSAGE),
      stack: null,
      digest: digestOf(error),
    }
  }

  return { name: "NonError", message: clip(String(error), MAX_MESSAGE), stack: null, digest: null }
}

/**
 * Next.js implements `redirect()` and `notFound()` by throwing. They are control
 * flow, not failures, and reporting them would bury every real error.
 */
const CONTROL_FLOW_DIGESTS = [
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  "NEXT_HTTP_ERROR_FALLBACK",
  "DYNAMIC_SERVER_USAGE",
  "BAILOUT_TO_CLIENT_SIDE_RENDERING",
  "NEXT_PRERENDER_INTERRUPTED",
]

export function isControlFlowError(error: unknown): boolean {
  const digest = digestOf(error)
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  return CONTROL_FLOW_DIGESTS.some(
    (marker) => (digest !== null && digest.startsWith(marker)) || message === marker
  )
}

// ---------------------------------------------------------------------------
// Browser noise
// ---------------------------------------------------------------------------

const EXTENSION_FRAME = /(chrome|moz|safari|safari-web)-extension:\/\//i

/**
 * Errors a visitor's browser raises that say nothing about our code. Recording them
 * would drown the signal: browser extensions throw errors that bubble up to the
 * page, cross-origin scripts report only "Script error." with no detail, and
 * ResizeObserver complains harmlessly during layout.
 */
export function shouldIgnoreClientError(
  error: Pick<SerialisedError, "name" | "message" | "stack">
): boolean {
  if (error.name === "AbortError") return true
  if (/ResizeObserver loop/i.test(error.message)) return true
  if (/^Script error\.?$/i.test(error.message.trim())) return true
  if (/Non-Error promise rejection captured/i.test(error.message)) return true
  if (error.stack && EXTENSION_FRAME.test(error.stack)) return true
  return false
}

/**
 * A dropped connection on a phone is not a bug in the app, but a spike of them can
 * mean something is wrong with it, so they are kept — as warnings, not errors.
 */
export function classifyClientSeverity(message: string): ErrorSeverity {
  return /Failed to fetch|Load failed|NetworkError|Network request failed/i.test(message)
    ? "warning"
    : "error"
}

/**
 * At most `max` distinct problems, each once, per page load. A render loop or an
 * event firing sixty times a second must not send sixty requests a second.
 */
export class ReportGate {
  private readonly seen = new Set<string>()

  constructor(private readonly max = 10) {}

  allow(key: string): boolean {
    if (this.seen.has(key)) return false
    if (this.seen.size >= this.max) return false
    this.seen.add(key)
    return true
  }
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

/**
 * Durable reporting is off unless explicitly switched on, and is switched on only
 * for the Production environment. Local development and Vercel previews talk to the
 * same database as production, so without this gate a developer's own mistakes —
 * and automated test runs — would fill the real error record.
 */
export function isReportingEnabled(flag: string | undefined): boolean {
  return flag === "on"
}

/** A short commit id, so a regression can be tied to the release that caused it. */
export function releaseId(sha: string | undefined): string | null {
  return sha ? sha.slice(0, 7) : null
}

/**
 * The arguments `report_error` takes, from a report.
 *
 * Every one is always present, as an explicit null when empty. The database
 * function declares no default values, and PostgREST finds a function by the NAMES
 * of the arguments sent: leaving one out (which is what `undefined` does once the
 * body is turned into JSON) makes it look for a function that does not exist, and
 * the report fails with a 404 instead of being recorded.
 */
export function toRpcArgs(report: ErrorReport) {
  return {
    p_source: report.source,
    p_severity: report.severity,
    p_context: report.context,
    p_name: report.name,
    p_message: report.message,
    p_stack: report.stack,
    p_route: report.route,
    p_digest: report.digest,
    p_release: report.release,
    p_user_agent: report.userAgent,
  }
}

/** Waits for `promise`, but never longer than `ms` — and never rejects. Reporting
 * an error must not be able to slow a request down or fail it. */
export async function settleWithin(promise: PromiseLike<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve(promise),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms)
      }),
    ])
  } catch {
    // Swallowed on purpose: see above.
  } finally {
    if (timer) clearTimeout(timer)
  }
}
