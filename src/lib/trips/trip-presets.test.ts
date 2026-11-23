import { describe, expect, it } from "vitest"

import { createTripSchema, type CreateTripInput } from "@/features/trips/schemas/trip.schemas"
import { TRIP_PRESETS, presetById, wizardStartValues } from "@/lib/trips/trip-presets"

const defaults: CreateTripInput = {
  destination: "",
  startingCity: "",
  startDate: "2026-12-07",
  endDate: "2026-12-11",
  travelers: 2,
  budget: null,
  currency: "USD",
  travelStyle: "balanced",
  interests: [],
  accommodation: "hotel",
  transportation: "public",
  notes: "",
}

describe("trip presets", () => {
  it.each(TRIP_PRESETS)("$id is a form the traveller could have filled by hand", (preset) => {
    const parsed = createTripSchema.safeParse({ ...defaults, ...preset.values })
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  it("has unique, URL-safe ids", () => {
    const ids = TRIP_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it("finds known ids and ignores anything else", () => {
    expect(presetById("kyoto-culture")?.values.destination).toBe("Kyoto, Japan")
    for (const bad of [undefined, null, "", "nope", "KYOTO-CULTURE", ["kyoto-culture"]]) {
      expect(presetById(bad as never)).toBeNull()
    }
  })

  it("never sets what the traveller must choose: dates, budget, travellers, currency", () => {
    for (const preset of TRIP_PRESETS) {
      for (const key of ["startDate", "endDate", "budget", "travelers", "currency"]) {
        expect(preset.values).not.toHaveProperty(key)
      }
    }
  })
})

describe("wizardStartValues", () => {
  const draft: Partial<CreateTripInput> = { destination: "Lisbon, Portugal", notes: "half-finished", interests: ["food"] }
  const preset = TRIP_PRESETS.find((p) => p.id === "kyoto-culture")!.values

  it("replaces a saved draft outright when a preset was chosen", () => {
    const { values, source } = wizardStartValues(defaults, draft, preset)
    expect(source).toBe("preset")
    expect(values.destination).toBe("Kyoto, Japan")
    expect(values.notes).toBe("") // nothing from the draft survives
    expect(values.interests).toEqual(preset.interests)
  })

  it("restores a draft over the defaults when there is no preset", () => {
    const { values, source } = wizardStartValues(defaults, draft, null)
    expect(source).toBe("draft")
    expect(values).toMatchObject({ destination: "Lisbon, Portugal", notes: "half-finished", travelers: 2 })
  })

  it("keeps the defaults with neither", () => {
    expect(wizardStartValues(defaults, null, null)).toEqual({ values: defaults, source: "defaults" })
  })
})
