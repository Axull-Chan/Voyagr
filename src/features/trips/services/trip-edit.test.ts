import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  MAX_BUDGET,
  addYears,
  budgetEditBlockedReason,
  dateShiftBlockedReason,
  describeShiftPreview,
  isoToday,
  parseBudgetInput,
  previewDateShift,
} from "@/features/trips/services/trip-edit"
import {
  shiftTripDatesSchema,
  updateTripBudgetSchema,
} from "@/features/trips/schemas/trip-management.schemas"

const TODAY = "2026-11-20"
const trip = { status: "ready", startDate: "2026-12-01", endDate: "2026-12-03" }
const reason = (newStart: string | null, t: typeof trip = trip) => dateShiftBlockedReason(t, newStart, TODAY)

describe("dateShiftBlockedReason", () => {
  it("allows a valid new start", () => {
    expect(reason("2026-12-10")).toBeNull()
    expect(reason("2026-11-25")).toBeNull() // earlier, still in the future
  })

  it("refuses a trip still generating, or one with no dates", () => {
    expect(reason("2026-12-10", { ...trip, status: "generating" })).toMatch(/still being generated/)
    expect(reason("2026-12-10", { ...trip, startDate: null as unknown as string })).toBe("This trip has no dates to change.")
    expect(reason("2026-12-10", { ...trip, endDate: null as unknown as string })).toBe("This trip has no dates to change.")
  })

  it("refuses an empty or malformed date, and the same start", () => {
    expect(reason(null)).toBe("Choose a new start date.")
    expect(reason("2026-13-45")).toBe("Choose a new start date.")
    expect(reason("1 Dec")).toBe("Choose a new start date.")
    expect(reason("2026-12-01")).toBe("The trip already starts on that date.")
  })

  it("allows yesterday (time zones) but not the day before", () => {
    expect(reason("2026-11-19")).toBeNull()
    expect(reason("2026-11-18")).toBe("The new start date is in the past.")
  })

  it("allows exactly two years ahead but not a day more", () => {
    expect(reason("2028-11-20")).toBeNull()
    expect(reason("2028-11-21")).toBe("Trips can start at most two years ahead.")
  })
})

describe("addYears and isoToday", () => {
  it("clamps 29 February like Postgres", () => {
    expect(addYears("2028-02-29", 2)).toBe("2030-02-28")
    expect(addYears("2026-11-20", 2)).toBe("2028-11-20")
  })

  it("reads today in UTC", () => {
    expect(isoToday(new Date("2026-11-20T23:30:00-05:00"))).toBe("2026-11-21")
  })
})

describe("previewDateShift", () => {
  it("keeps the length and moves the end by the same offset", () => {
    expect(previewDateShift("2026-12-01", "2026-12-03", "2026-12-30")).toEqual({
      startDate: "2026-12-30",
      endDate: "2027-01-01",
      days: 3,
      offsetDays: 29,
    })
    expect(previewDateShift("2026-12-01", "2026-12-03", "2026-11-25").offsetDays).toBe(-6)
  })

  it("handles a one-day trip", () => {
    expect(previewDateShift("2026-12-01", "2026-12-01", "2026-12-05")).toMatchObject({ endDate: "2026-12-05", days: 1 })
  })

  it("describes the result in plain words", () => {
    expect(describeShiftPreview(previewDateShift("2026-12-01", "2026-12-03", "2026-12-30"))).toBe(
      "Wed 30 Dec 2026 – Fri 1 Jan 2027 · 3 days, same length"
    )
  })
})

describe("budget", () => {
  it("refuses only while generating", () => {
    expect(budgetEditBlockedReason("generating")).toMatch(/still being generated/)
    for (const status of ["draft", "ready", "archived"]) expect(budgetEditBlockedReason(status)).toBeNull()
  })

  it.each([
    ["", null],
    ["   ", null],
    ["1500", 1500],
    ["1,500.50", 1500.5],
    ["0.01", 0.01],
    [String(MAX_BUDGET), MAX_BUDGET],
  ])("parses %j", (text, budget) => {
    expect(parseBudgetInput(text)).toEqual({ ok: true, budget })
  })

  it.each(["0", "0.00", "-5", "abc", "1.234", "1e5", String(MAX_BUDGET + 0.01)])("refuses %j", (text) => {
    expect(parseBudgetInput(text).ok).toBe(false)
  })

  it("schema: null clears, above 0 up to the cap is fine, nothing else", () => {
    const id = "11111111-0000-4000-8000-000000000001"
    expect(updateTripBudgetSchema.safeParse({ tripId: id, budget: null }).success).toBe(true)
    expect(updateTripBudgetSchema.safeParse({ tripId: id, budget: 1500 }).success).toBe(true)
    expect(updateTripBudgetSchema.safeParse({ tripId: id, budget: MAX_BUDGET }).success).toBe(true)
    for (const budget of [0, -1, MAX_BUDGET + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(updateTripBudgetSchema.safeParse({ tripId: id, budget }).success).toBe(false)
    }
    expect(updateTripBudgetSchema.safeParse({ tripId: "nope", budget: 10 }).success).toBe(false)
  })

  it("schema: a start date must be YYYY-MM-DD", () => {
    const id = "11111111-0000-4000-8000-000000000001"
    expect(shiftTripDatesSchema.safeParse({ tripId: id, startDate: "2026-12-10" }).success).toBe(true)
    expect(shiftTripDatesSchema.safeParse({ tripId: id, startDate: "10/12/2026" }).success).toBe(false)
  })
})

describe("the app and the database refuse in the same words", () => {
  // shift_trip_dates is authoritative; the dialog's early refusals must not drift from it.
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261121090000_add_shift_trip_dates.sql"),
    "utf8"
  ).replace(/''/g, "'")

  it.each([
    reason("2026-12-10", { ...trip, status: "generating" }),
    reason("2026-12-10", { ...trip, startDate: null as unknown as string }),
    reason(null),
    reason("2026-12-01"),
    reason("2026-11-18"),
    reason("2028-11-21"),
  ])("%s", (message) => {
    expect(message).not.toBeNull()
    expect(sql).toContain(message!)
  })

  it("uses the same bounds", () => {
    expect(sql).toContain("current_date - 1")
    expect(sql).toContain("interval '2 years'")
  })
})
