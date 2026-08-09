import { fetchRates } from "@/integrations/frankfurter/currency"
import { formatCurrency } from "@/lib/trips/trip-domain"
import { attempt, live, type ServiceResult } from "@/services/service-result"

/**
 * Live currency conversion.
 *
 * Adding a currency needs no code change here: the quote list is whatever the
 * caller asks for, and Frankfurter covers 200+ codes.
 */

export interface ConversionTable {
  base: string
  /** Quote code → units per 1 unit of base. */
  rates: Record<string, number>
  /** Publication date of the underlying reference rates. */
  asOf: string
}

const EMPTY: ConversionTable = { base: "USD", rates: {}, asOf: "" }

export async function getRates(
  base: string,
  quotes: readonly string[]
): Promise<ServiceResult<ConversionTable>> {
  return attempt("Exchange rates", { ...EMPTY, base }, async () => {
    const table = await fetchRates(base, quotes)
    return live({ base: table.base, rates: table.rates, asOf: table.date })
  })
}

/**
 * Converts an amount, returning null when no rate is available.
 *
 * Null rather than the unconverted number: silently showing yen as if it were
 * dollars is a worse failure than showing nothing.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  table: ConversionTable
): number | null {
  if (from === to) return amount
  if (table.base === from) {
    const rate = table.rates[to]
    return rate === undefined ? null : amount * rate
  }
  // Cross-rate via the table's base, e.g. JPY -> USD -> EUR.
  const fromRate = table.rates[from]
  const toRate = table.rates[to]
  if (fromRate === undefined || toRate === undefined || fromRate === 0) return null
  return (amount / fromRate) * toRate
}

/** Converts and formats in one step, falling back to the original currency. */
export function convertAndFormat(
  amount: number,
  from: string,
  to: string,
  table: ConversionTable
): string {
  const converted = convert(amount, from, to, table)
  return converted === null
    ? formatCurrency(amount, from)
    : formatCurrency(converted, to)
}
