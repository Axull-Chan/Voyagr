import { CACHE_TTL, integrationCache } from "@/integrations/core/cache"
import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"
import { frankfurterBaseUrl } from "@/lib/config/providers"

/**
 * Frankfurter exchange rates — https://frankfurter.dev/
 *
 * Keyless, no quotas, and sourced from central bank reference rates. This
 * targets the **v2** API (`/v2/rates`); the older `api.frankfurter.app/latest`
 * shape (`{ amount, base, date, rates: {...} }`) is superseded, and v2 instead
 * returns a flat array of one object per pair.
 */

const PROVIDER = "frankfurter"
// FRANKFURTER_BASE_URL can point at a self-hosted instance; see lib/config/providers.

/** One row per quote currency, as returned by `/v2/rates`. */
interface RateRow {
  date?: string
  base?: string
  quote?: string
  rate?: number
}

export interface RateTable {
  base: string
  /** Quote currency code → units per 1 unit of `base`. */
  rates: Record<string, number>
  /** Publication date of the underlying reference rates, ISO `YYYY-MM-DD`. */
  date: string
}

/**
 * Latest rates from `base` into each of `quotes`.
 *
 * Rates publish once per working day, so the hour-long TTL is generous rather
 * than aggressive — it exists to stop a page that shows twelve prices making
 * twelve identical requests.
 */
export async function fetchRates(
  base: string,
  quotes: readonly string[],
  signal?: AbortSignal
): Promise<RateTable> {
  const wanted = [...new Set(quotes.map((q) => q.toUpperCase()))]
    .filter((q) => q !== base.toUpperCase())
    .sort()

  // Nothing to ask for: converting a currency into itself is always 1.
  if (wanted.length === 0) {
    return { base: base.toUpperCase(), rates: {}, date: todayIso() }
  }

  const key = `frankfurter:${base.toUpperCase()}:${wanted.join(",")}`

  return integrationCache.getOrSet(key, CACHE_TTL.currency, async () => {
    const url = buildUrl(`${frankfurterBaseUrl()}/rates`, {
      base: base.toUpperCase(),
      quotes: wanted.join(","),
    })

    const rows = await fetchJson<RateRow[]>(PROVIDER, url, { signal })
    if (!Array.isArray(rows)) {
      throw new IntegrationError(
        PROVIDER,
        "invalid_response",
        "Rates response was not an array"
      )
    }

    const rates: Record<string, number> = {}
    let date = todayIso()
    for (const row of rows) {
      if (typeof row.quote === "string" && typeof row.rate === "number") {
        rates[row.quote.toUpperCase()] = row.rate
      }
      if (typeof row.date === "string") date = row.date
    }

    if (Object.keys(rates).length === 0) {
      throw new IntegrationError(
        PROVIDER,
        "invalid_response",
        "Rates response contained no usable pairs"
      )
    }

    return { base: base.toUpperCase(), rates, date }
  })
}

/** The set of currencies the provider knows about, for validation and pickers. */
export async function fetchSupportedCurrencies(
  signal?: AbortSignal
): Promise<{ code: string; name: string }[]> {
  return integrationCache.getOrSet(
    "frankfurter:currencies",
    CACHE_TTL.currency,
    async () => {
      const rows = await fetchJson<{ iso_code?: string; name?: string }[]>(
        PROVIDER,
        `${frankfurterBaseUrl()}/currencies`,
        { signal }
      )
      if (!Array.isArray(rows)) {
        throw new IntegrationError(
          PROVIDER,
          "invalid_response",
          "Currency list was not an array"
        )
      }
      return rows
        .filter(
          (r): r is { iso_code: string; name: string } =>
            typeof r.iso_code === "string" && typeof r.name === "string"
        )
        .map((r) => ({ code: r.iso_code, name: r.name }))
    }
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
