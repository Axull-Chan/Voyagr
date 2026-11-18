import { isIntegrationError } from "@/integrations/core/errors"

/**
 * What every service hands back.
 *
 * Services never throw at their callers: a page must render whether or not a
 * third party answered. `source` is what the UI reads to decide between
 * showing live data and showing it with an honest "not live" note, which the
 * brief requires whenever fallback data is displayed.
 */
export type DataSource = "live" | "fallback" | "unavailable"

export interface ServiceResult<T> {
  data: T
  source: DataSource
  /** Plain-language explanation, safe to show a user. Only set when degraded. */
  notice?: string
}

export function live<T>(data: T): ServiceResult<T> {
  return { data, source: "live" }
}

export function fallback<T>(data: T, notice: string): ServiceResult<T> {
  return { data, source: "fallback", notice }
}

export function unavailable<T>(data: T, notice: string): ServiceResult<T> {
  return { data, source: "unavailable", notice }
}

/**
 * Turns an integration failure into something a user can read.
 *
 * Deliberately vague about the provider: "OpenTripMap returned 429" is our
 * problem, not the traveller's. The distinction that matters to them is
 * whether waiting will help.
 */
export function describeFailure(error: unknown, subject: string): string {
  if (isIntegrationError(error)) {
    switch (error.kind) {
      case "not_configured":
        return `${subject} isn't connected yet.`
      case "rate_limited":
        return `${subject} is busy right now — try again shortly.`
      case "unauthorized":
        return `${subject} rejected our request.`
      default:
        return `We couldn't reach ${subject.toLowerCase()} just now.`
    }
  }
  return `We couldn't load ${subject.toLowerCase()} just now.`
}

/**
 * Runs a service body, converting any failure into a degraded result.
 *
 * Centralised so no service forgets a try/catch and takes a page down with it.
 */
export async function attempt<T>(
  subject: string,
  fallbackValue: T,
  body: () => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> {
  try {
    return await body()
  } catch (error) {
    // A degraded service is a warning, not an error: the page still works, but a
    // key that is wrong or a provider that is down shows up here as a pattern.
    // Imported lazily because this module is also reachable from a client component
    // (through currency-service's `convert`), and reporting is server-only.
    const { reportServerError } = await import("@/lib/monitoring/report-server")
    await reportServerError(error, { context: `service:${subject}`, severity: "warning" })
    return unavailable(fallbackValue, describeFailure(error, subject))
  }
}
