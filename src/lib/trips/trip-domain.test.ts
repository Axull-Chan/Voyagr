import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  BUDGET_CATEGORY_VALUES,
  MEAL_TYPES,
  TIME_SLOTS,
  TRANSPORT_MODES,
  addDays,
  countdownLabel,
  countdownVariant,
  currencySymbol,
  daysUntil,
  formatCurrency,
  tripDurationDays,
} from "@/lib/trips/trip-domain"

describe("tripDurationDays", () => {
  it("counts both ends: the 1st to the 3rd is three days", () => {
    expect(tripDurationDays("2026-03-01", "2026-03-03")).toBe(3)
  })

  it("treats a same-day trip as one day", () => {
    expect(tripDurationDays("2026-03-01", "2026-03-01")).toBe(1)
  })

  it("returns 0 for an end before the start", () => {
    expect(tripDurationDays("2026-03-03", "2026-03-01")).toBe(0)
  })

  it("returns 0 for unparseable input rather than NaN", () => {
    expect(tripDurationDays("", "2026-03-01")).toBe(0)
    expect(tripDurationDays("2026-03-01", "not-a-date")).toBe(0)
  })

  it("handles a leap day", () => {
    expect(tripDurationDays("2028-02-28", "2028-03-01")).toBe(3)
    expect(tripDurationDays("2026-02-28", "2026-03-01")).toBe(2)
  })
})

describe("addDays", () => {
  it("rolls over month and year boundaries", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("accepts a negative offset", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(addDays("garbage", 5)).toBe("garbage")
  })
})

describe("formatCurrency", () => {
  it("drops the decimals for a whole amount and keeps them otherwise", () => {
    expect(formatCurrency(1200, "USD")).toBe("$1,200")
    expect(formatCurrency(19.5, "EUR")).toBe("€19.50")
  })

  it("falls back instead of throwing on a code Intl rejects", () => {
    // 7 letters is not a well-formed ISO 4217 code, so Intl throws a RangeError.
    expect(() => formatCurrency(1500, "TOOLONG")).not.toThrow()
    expect(formatCurrency(1500, "TOOLONG")).toContain("1,500")
  })
})

describe("currencySymbol", () => {
  it("returns the curated symbol, or an empty string for an unknown code", () => {
    expect(currencySymbol("GBP")).toBe("£")
    expect(currencySymbol("XXX")).toBe("")
  })
})

describe("countdown helpers", () => {
  beforeEach(() => {
    // Noon UTC, so "today" is unambiguous in every timezone the CI runner
    // might report.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"))
  })
  afterEach(() => vi.useRealTimers())

  it("daysUntil counts whole days, negative once the trip has started", () => {
    expect(daysUntil("2026-11-17")).toBe(0)
    expect(daysUntil("2026-11-18")).toBe(1)
    expect(daysUntil("2026-11-27")).toBe(10)
    expect(daysUntil("2026-11-16")).toBe(-1)
  })

  it("daysUntil is null when there is no usable date", () => {
    expect(daysUntil(null)).toBeNull()
    expect(daysUntil("nope")).toBeNull()
  })

  it("labels each side of every boundary", () => {
    expect(countdownLabel(null)).toBeNull()
    expect(countdownLabel(5)).toBe("In 5 days")
    expect(countdownLabel(2)).toBe("In 2 days")
    expect(countdownLabel(1)).toBe("Tomorrow")
    expect(countdownLabel(0)).toBe("Today")
    expect(countdownLabel(-1)).toBe("Past trip")
  })

  it("never gives a past or undated trip the gold countdown treatment", () => {
    expect(countdownVariant(null)).toBe("secondary")
    expect(countdownVariant(-3)).toBe("secondary")
    expect(countdownVariant(0)).toBe("countdown-urgent")
    expect(countdownVariant(1)).toBe("countdown-urgent")
    expect(countdownVariant(2)).toBe("countdown")
  })
})

/**
 * These lists are written by hand to mirror `check` constraints in the
 * database. A drift between the two only shows up as an insert failing at
 * runtime, so pin them: changing one of these should be a deliberate edit that
 * also touches a migration, never an accident.
 */
describe("vocabularies mirroring database check constraints", () => {
  it("budget categories", () => {
    expect([...BUDGET_CATEGORY_VALUES]).toEqual([
      "hotels",
      "transportation",
      "food",
      "activities",
      "shopping",
      "emergency_fund",
    ])
  })

  it("time slots, meal types and transport modes", () => {
    expect([...TIME_SLOTS]).toEqual(["morning", "afternoon", "evening"])
    expect([...MEAL_TYPES]).toEqual(["breakfast", "lunch", "dinner"])
    expect([...TRANSPORT_MODES]).toEqual([
      "flight",
      "train",
      "bus",
      "car",
      "ferry",
      "metro",
      "walk",
      "rideshare",
    ])
  })
})
