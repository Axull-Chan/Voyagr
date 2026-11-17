import { describe, expect, it } from "vitest"

import { buildTripPdfModel, PDF_NOTICE } from "@/features/trips/pdf/trip-pdf-model"
import { makeDays, makeDetail } from "@/features/trips/pdf/test-fixtures"
import type { ConversionTable } from "@/services/currency-service"

const NO_RATES: ConversionTable = { base: "EUR", rates: {}, asOf: "" }
const WITH_USD: ConversionTable = { base: "EUR", rates: { USD: 1.08 }, asOf: "2026-11-17" }
const NOW = new Date("2026-11-17T12:00:00Z")

const build = (overrides: Record<string, unknown> = {}, rates = NO_RATES) =>
  buildTripPdfModel(makeDetail(overrides), rates, NOW)

/** Replaces one field of the fixture trip row. */
const withTrip = (patch: Record<string, unknown>) => ({
  trip: { ...makeDetail().trip, ...patch },
})

describe("header", () => {
  it("summarises the trip and carries the standing caveat", () => {
    const m = build()
    expect(m.title).toBe("Lisbon in March")
    expect(m.destination).toBe("Lisbon, Portugal")
    expect(m.facts).toEqual([
      { label: "Dates", value: "1 Mar 2026 - 3 Mar 2026" },
      { label: "Length", value: "2 nights" },
      { label: "Travellers", value: "2 travellers" },
      { label: "Budget", value: "€2,000" },
    ])
    expect(m.notice).toBe(PDF_NOTICE)
    expect(m.notice).toMatch(/planned with AI/)
    expect(m.generatedOn).toBe("17 Nov 2026")
  })

  it("omits the facts it does not have, and singularises", () => {
    const m = build(withTrip({ budget: null, travelers: 1, start_date: null, end_date: null }))
    expect(m.facts).toEqual([
      { label: "Dates", value: "Dates not set" },
      { label: "Travellers", value: "1 traveller" },
    ])
  })

  it("flags an archived or draft trip, and says nothing for a ready one", () => {
    expect(build().statusNote).toBeNull()
    expect(build(withTrip({ status: "archived" })).statusNote).toBe("Archived trip")
    expect(build(withTrip({ status: "draft" })).statusNote).toMatch(/Draft/)
  })

  it("trims notes, and drops them when blank", () => {
    expect(build().notes).toBe("Gluten-free where possible.")
    expect(build(withTrip({ additional_notes: "   " })).notes).toBeNull()
    expect(build(withTrip({ additional_notes: null })).notes).toBeNull()
  })
})

describe("days", () => {
  it("labels each day with its weekday and date", () => {
    expect(build().days[0]?.heading).toBe("Day 1  ·  Sun 1 Mar")
  })

  it("prints times and slots, and an estimate only when there is a cost", () => {
    const [morning, afternoon] = build().days[0]!.activities
    expect(morning).toMatchObject({ when: "Morning  09:30", cost: "est. €12.50" })
    // A zero cost is "nothing recorded", not "free" — print no figure.
    expect(afternoon).toMatchObject({ when: "Afternoon  14:00", cost: null })
  })

  it("marks travel time as an estimate", () => {
    expect(build().days[0]!.activities[1]!.detail).toContain("est. 12 min travel")
  })

  it("puts breakfast before lunch before dinner whatever order they were stored in", () => {
    expect(build().days[0]!.meals.map((m) => m.meal)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
    ])
  })

  it("gives the day cost without a second 'est.' (the document already says 'Estimated')", () => {
    expect(build().days[0]!.dayCost).toBe("€41")
  })

  it("handles a trip with no itinerary", () => {
    const m = build({ days: [] })
    expect(m.days).toEqual([])
  })
})

describe("weather provenance", () => {
  const dayWith = (weather: Record<string, unknown> | null) => {
    const days = makeDays(1)
    days[0]!.weather = weather as never
    return build({ days }).days[0]!.weather
  }

  it("labels a real snapshot as the forecast at planning time, not live", () => {
    const line = dayWith({
      condition: "Light rain", temp_high_c: 16.4, temp_low_c: 9.2,
      precipitation_chance: 60, source: "open-meteo",
    })
    expect(line).toContain("Light rain")
    expect(line).toContain("16° / 9°C")
    expect(line).toContain("60% chance of rain")
    expect(line).toContain("forecast at time of planning")
  })

  it("calls modelled weather typical, never a forecast", () => {
    const line = dayWith({
      condition: "Partly cloudy", temp_high_c: 19, temp_low_c: 11,
      precipitation_chance: 10, source: "mock",
    })
    expect(line).toContain("typical weather, not a forecast")
    expect(line).not.toContain("forecast at time of planning")
  })

  it("prints only the condition when there is no forecast, with no invented numbers", () => {
    const line = dayWith({
      condition: "Forecast not yet available", temp_high_c: null, temp_low_c: null,
      precipitation_chance: null, source: "unavailable",
    })
    expect(line).toBe("Forecast not yet available")
  })

  it("prints nothing when a day has no weather row", () => {
    expect(dayWith(null)).toBeNull()
  })
})

describe("never prints what it cannot back", () => {
  it("leaves out every rating, though the rows carry them", () => {
    const text = JSON.stringify(build())
    expect(text).not.toMatch(/rating/i)
    expect(text).not.toContain("4.7")
    expect(text).not.toContain("4.5")
    expect(text).not.toContain("★")
  })

  it("calls a placeholder hotel an example, and a real one nothing special", () => {
    expect(build().stays[0]).toMatchObject({ isExample: true })
    const real = build({
      hotels: [{ id: "h", name: "Memmo Alfama", address: null, nights: 2, price_per_night: 150, source: "opentripmap" }],
    })
    expect(real.stays[0]).toMatchObject({ isExample: false, name: "Memmo Alfama" })
  })

  it("marks a nightly rate as an estimate even for a real listing", () => {
    expect(build().stays[0]!.facts).toBe("2 nights  ·  est. €120 / night")
  })

  it("marks transport durations and costs as estimates", () => {
    expect(build().transport[0]).toEqual({
      route: "Metro: Airport to Baixa-Chiado",
      facts: "Metro Lisboa  ·  est. 25 min  ·  est. €2",
    })
  })
})

describe("budget", () => {
  const expense = (over: Record<string, unknown>) => ({
    id: "x", category: "food", amount: 10, currency: "EUR", description: null,
    expense_date: "2026-03-02", ...over,
  })

  it("totals planned and spent and works out what is left", () => {
    const b = build().budget!
    expect(b.plannedTotal).toBe("€950")
    expect(b.spentTotal).toBe("€32.50")
    expect(b.budgetTotal).toBe("€2,000")
    expect(b.remaining).toBe("€1,967.50")
    expect(b.warning).toBeNull()
  })

  it("counts a foreign-currency expense by converting it into the trip currency", () => {
    // USD 21.60 at 1.08 USD per EUR is EUR 20 — the case convert() used to drop.
    const m = build(
      { expenses: [expense({ amount: 21.6, currency: "USD", category: "activities", description: "Tickets" })] },
      WITH_USD
    )
    expect(m.budget!.spentTotal).toBe("€20")
    expect(m.budget!.rows.find((r) => r.label === "Activities")?.spent).toBe("€20")
    expect(m.expenses[0]!.amount).toBe("$21.60 (= €20)")
  })

  it("names an expense it could not convert instead of silently zeroing it", () => {
    const m = build({ expenses: [expense({ amount: 4800, currency: "JPY" })] }, WITH_USD)
    expect(m.budget!.spentTotal).toBe("€0")
    expect(m.budget!.warning).toBe(
      '1 expense in JPY could not be converted to EUR (no exchange rate was available) and is not counted in "Spent".'
    )
  })

  it("pluralises the warning and groups the currencies", () => {
    const m = build(
      { expenses: [expense({ currency: "JPY" }), expense({ currency: "JPY" }), expense({ currency: "GBP" })] },
      WITH_USD
    )
    expect(m.budget!.warning).toBe(
      '3 expenses in JPY, GBP could not be converted to EUR (no exchange rate was available) and are not counted in "Spent".'
    )
  })

  it("leaves a category out of the table when it has nothing planned or spent", () => {
    expect(build().budget!.rows.map((r) => r.label)).toEqual(["Accommodation", "Food & drink"])
  })

  it("has no budget section for a trip with no budget, rows or expenses", () => {
    expect(build({ budget: [], expenses: [], ...withTrip({ budget: null }) }).budget).toBeNull()
  })

  it("still shows the section when only an overall budget was set", () => {
    const b = build({ budget: [], expenses: [] }).budget!
    expect(b.budgetTotal).toBe("€2,000")
    expect(b.remaining).toBe("€2,000")
  })
})

describe("packing", () => {
  it("groups by category in order, files uncategorised items under Other, and counts packed", () => {
    const m = build()
    expect(m.packing).toEqual([
      { category: "Documents", items: [{ text: "Passport", checked: true }, { text: "Insurance", checked: false }] },
      { category: "Other", items: [{ text: "Charger", checked: false }] },
    ])
    expect(m.packingSummary).toBe("1 of 3 packed")
  })

  it("has no packing section when the list is empty", () => {
    const m = build({ packing: [] })
    expect(m.packing).toEqual([])
    expect(m.packingSummary).toBeNull()
  })
})

describe("text safety", () => {
  it("makes unsupported characters safe everywhere, not just in the fields someone remembered", () => {
    const days = makeDays(1)
    days[0]!.activities[0]!.title = "Visit 浅草寺 and Kőszeg Gate"
    days[0]!.summary = "Ünïcode ✓"
    const m = build({
      days,
      ...withTrip({ title: "東京 trip", additional_notes: "note ★" }),
    })
    expect(m.title).toBe("? trip")
    expect(m.days[0]!.activities[0]!.title).toBe("Visit ? and Koszeg Gate")
    expect(m.days[0]!.summary).toBe("Ünïcode ?")
    expect(m.notes).toBe("note ?")
  })
})
