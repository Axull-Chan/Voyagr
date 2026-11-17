import { describe, expect, it } from "vitest"

import { convert, type ConversionTable } from "@/services/currency-service"

/**
 * The shape the trip page actually builds: based on the *trip's* currency, with
 * one quote per other currency in play. Each quote is "units of that currency
 * per 1 EUR", and the base itself is never listed.
 */
const table: ConversionTable = {
  base: "EUR",
  rates: { USD: 1.08, JPY: 160 },
  asOf: "2026-11-17",
}

describe("convert", () => {
  it("returns the amount unchanged for the same currency, needing no rates", () => {
    expect(convert(10, "EUR", "EUR", table)).toBe(10)
    expect(convert(10, "GBP", "GBP", { base: "EUR", rates: {}, asOf: "" })).toBe(10)
  })

  it("converts from the base into a quote by multiplying", () => {
    expect(convert(10, "EUR", "USD", table)).toBeCloseTo(10.8)
  })

  it("converts a quote INTO the base by dividing — a foreign expense on a trip", () => {
    // Regression: this returned null, so every foreign-currency expense counted
    // as zero spend on the budget page.
    expect(convert(1600, "JPY", "EUR", table)).toBeCloseTo(10)
    expect(convert(10.8, "USD", "EUR", table)).toBeCloseTo(10)
  })

  it("round-trips through the base without drifting", () => {
    const there = convert(25, "EUR", "JPY", table)
    expect(there).not.toBeNull()
    expect(convert(there as number, "JPY", "EUR", table)).toBeCloseTo(25)
  })

  it("cross-converts between two quotes via the base", () => {
    expect(convert(10, "USD", "JPY", table)).toBeCloseTo((10 / 1.08) * 160)
  })

  it("returns null, never the unconverted number, when a rate is missing", () => {
    expect(convert(10, "GBP", "EUR", table)).toBeNull() // no GBP quote
    expect(convert(10, "EUR", "GBP", table)).toBeNull()
    expect(convert(10, "GBP", "USD", table)).toBeNull()
  })

  it("returns null rather than dividing by a zero rate", () => {
    const broken: ConversionTable = { base: "EUR", rates: { USD: 0 }, asOf: "" }
    expect(convert(10, "USD", "EUR", broken)).toBeNull()
  })
})
