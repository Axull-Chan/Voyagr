import { IntegrationError, kindFromStatus } from "@/integrations/core/errors"

/**
 * The one place any integration talks to the network.
 *
 * Every provider needs the same four things — a timeout, retry on transient
 * faults, a typed error on failure, and a parsed body — so they live here
 * rather than being reimplemented (slightly differently) five times.
 */

export interface RequestOptions {
  /** Abandon the request after this long. Providers vary; default is modest. */
  timeoutMs?: number
  /** Attempts *after* the first. Only transient failures consume one. */
  retries?: number
  headers?: Record<string, string>
  /** Lets a caller cancel, e.g. when a React `cache()` scope is torn down. */
  signal?: AbortSignal
  /** GET unless a body is supplied, in which case POST. */
  method?: "GET" | "POST"
  /** JSON-serialised and sent with `content-type: application/json`. */
  body?: unknown
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_RETRIES = 2
const BASE_BACKOFF_MS = 300

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Exponential backoff with jitter.
 *
 * The jitter matters more than the exponent: several trips generating at once
 * would otherwise retry in lockstep and hit the provider as a single spike,
 * which is exactly what a rate limiter punishes.
 */
function backoffDelay(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** attempt
  return exponential + Math.random() * BASE_BACKOFF_MS
}

/**
 * Fetches JSON, retrying transient failures, and throws `IntegrationError`
 * for everything a caller might want to branch on.
 */
export async function fetchJson<T>(
  provider: string,
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    headers,
    signal,
    method = options.body === undefined ? "GET" : "POST",
    body,
  } = options

  let lastError: IntegrationError | undefined
  // Keys travel in the URL for several providers (Gemini `key`, OpenTripMap
  // `apikey`), so anything we build an error from is scrubbed of them first.
  const secrets = collectSecrets(url, headers)
  const scrub = (text: string) => redactSecrets(text, secrets)

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // A fresh controller per attempt — an aborted one stays aborted.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onOuterAbort = () => controller.abort()
    signal?.addEventListener("abort", onOuterAbort)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          accept: "application/json",
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // These are upstream services with their own TTLs; our TtlCache owns
        // freshness, so Next's fetch cache would just be a second, invisible
        // layer with different rules.
        cache: "no-store",
      })

      if (!response.ok) {
        // Best-effort: most JSON APIs (OpenAI included) put an actionable
        // message in the error body, and "responded 400" alone gives nobody
        // enough to debug a bad schema or a typo'd model name.
        const detail = await response
          .json()
          .then((json: unknown) => extractErrorMessage(json))
          .then((message) => (message === null ? null : scrub(message)))
          .catch(() => null)

        const error = new IntegrationError(
          provider,
          kindFromStatus(response.status),
          detail
            ? `${provider} responded ${response.status}: ${detail}`
            : `${provider} responded ${response.status}`,
          { status: response.status }
        )
        if (!error.isRetryable || attempt === retries) throw error
        lastError = error
        await sleep(backoffDelay(attempt))
        continue
      }

      try {
        return (await response.json()) as T
      } catch (cause) {
        // A 200 we can't parse is a provider bug or an HTML error page —
        // retrying would just get the same body.
        throw new IntegrationError(
          provider,
          "invalid_response",
          `${provider} returned a body that was not valid JSON`,
          // A JSON parse error quotes the start of the body, which can echo the URL.
          { cause: scrubCause(cause, scrub) }
        )
      }
    } catch (error) {
      if (error instanceof IntegrationError) {
        if (!error.isRetryable || attempt === retries) throw error
        lastError = error
      } else {
        // Distinguish "we gave up waiting" from a genuine network fault: an
        // abort we did not initiate came from the caller and must not retry.
        const aborted = error instanceof Error && error.name === "AbortError"
        if (aborted && signal?.aborted) {
          throw new IntegrationError(provider, "unavailable", "Request cancelled", {
            cause: scrubCause(error, scrub),
          })
        }
        const wrapped = new IntegrationError(
          provider,
          "unavailable",
          aborted
            ? `${provider} timed out after ${timeoutMs}ms`
            : `${provider} could not be reached`,
          { cause: scrubCause(error, scrub) }
        )
        if (attempt === retries) throw wrapped
        lastError = wrapped
      }
      await sleep(backoffDelay(attempt))
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onOuterAbort)
    }
  }

  // Only reachable if `retries` is negative; keeps the return type honest.
  throw (
    lastError ??
    new IntegrationError(provider, "unavailable", `${provider} request failed`)
  )
}

/**
 * Pulls a human-readable message out of an error body, tolerating the two
 * shapes providers actually use (`{ error: { message } }` — OpenAI and most
 * REST APIs — or a bare `{ message }`) without assuming either.
 */
function extractErrorMessage(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null
  const record = json as Record<string, unknown>

  const nested = record.error
  if (typeof nested === "object" && nested !== null) {
    const message = (nested as Record<string, unknown>).message
    if (typeof message === "string") return message
  }

  return typeof record.message === "string" ? record.message : null
}

/** Builds a URL with undefined/null params dropped rather than stringified. */
export function buildUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/**
 * Query parameters that carry credentials in some provider's URL. Matched
 * case-insensitively; `key` is Gemini's, `apikey` OpenTripMap's.
 */
export const SENSITIVE_QUERY_PARAMS = [
  "apikey",
  "api_key",
  "api-key",
  "key",
  "token",
  "access_token",
  "auth",
  "client_secret",
  "client_id",
  "secret",
  "signature",
  "sig",
  "password",
] as const

const SENSITIVE_HEADERS = ["authorization", "x-api-key", "x-goog-api-key", "api-key"]

/** Shorter values are not treated as secrets: replacing "1" everywhere would mangle messages. */
const MIN_SECRET_LENGTH = 6

const REDACTED = "[REDACTED]"

/**
 * The credential values a request carries: sensitive query parameters of its
 * URL and sensitive request headers (a `Bearer ` prefix is stripped).
 */
export function collectSecrets(
  url: string,
  headers?: Record<string, string>
): string[] {
  const values: string[] = []
  try {
    const sensitive = new Set<string>(SENSITIVE_QUERY_PARAMS)
    for (const [name, value] of new URL(url).searchParams) {
      if (sensitive.has(name.toLowerCase())) values.push(value)
    }
  } catch {
    // Not an absolute URL: nothing to collect from it.
  }
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (SENSITIVE_HEADERS.includes(name.toLowerCase())) {
      values.push(value.replace(/^(bearer|token|basic|client-id)\s+/i, ""))
    }
  }
  return [...new Set(values)].filter((value) => value.length >= MIN_SECRET_LENGTH)
}

const PARAM_PATTERN = new RegExp(
  // `?name=` or `&name=`, also percent-encoded (`%3F`, `%26`, `%3D`), up to
  // the next separator. The value is what gets replaced; the name is kept so
  // a message still says which parameter it was.
  `((?:[?&]|%3F|%26)(?:${SENSITIVE_QUERY_PARAMS.map((p) => p.replace("-", "\\-")).join("|")})(?:=|%3D))[^&\\s"'<>#]*`,
  "gi"
)

/**
 * Removes credentials from text that is about to become an error message:
 * every sensitive query parameter's value in any URL-looking text, plus every
 * known secret value wherever it appears (in any encoding we can predict).
 */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let out = text.replace(PARAM_PATTERN, `$1${REDACTED}`)
  for (const secret of secrets) {
    if (secret.length < MIN_SECRET_LENGTH) continue
    for (const form of new Set([secret, encodeURIComponent(secret)])) {
      out = out.split(form).join(REDACTED)
    }
  }
  return out
}

/**
 * A copy of a thrown value with its message scrubbed, for use as an error
 * `cause` (the error reporter folds the cause's message into what it stores).
 */
function scrubCause(cause: unknown, scrub: (text: string) => string): unknown {
  if (cause instanceof Error) {
    const copy = new Error(scrub(cause.message))
    copy.name = cause.name
    copy.stack = cause.stack ? scrub(cause.stack) : undefined
    return copy
  }
  return typeof cause === "string" ? scrub(cause) : cause
}
