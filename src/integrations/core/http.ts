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
  } = options

  let lastError: IntegrationError | undefined

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // A fresh controller per attempt — an aborted one stays aborted.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onOuterAbort = () => controller.abort()
    signal?.addEventListener("abort", onOuterAbort)

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", ...headers },
        signal: controller.signal,
        // These are upstream services with their own TTLs; our TtlCache owns
        // freshness, so Next's fetch cache would just be a second, invisible
        // layer with different rules.
        cache: "no-store",
      })

      if (!response.ok) {
        const error = new IntegrationError(
          provider,
          kindFromStatus(response.status),
          `${provider} responded ${response.status}`,
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
          { cause }
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
            cause: error,
          })
        }
        const wrapped = new IntegrationError(
          provider,
          "unavailable",
          aborted
            ? `${provider} timed out after ${timeoutMs}ms`
            : `${provider} could not be reached`,
          { cause: error }
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
