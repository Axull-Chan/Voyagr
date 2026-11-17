import { describe, expect, it } from "vitest"

import { expenseSchema } from "@/features/trips/schemas/expense.schemas"
import {
  packingItemSchema,
  updatePackingItemSchema,
} from "@/features/trips/schemas/packing.schemas"
import {
  WIZARD_STEPS,
  createTripSchema,
} from "@/features/trips/schemas/trip.schemas"
import {
  renameTripSchema,
  tripIdSchema,
} from "@/features/trips/schemas/trip-management.schemas"

const UUID = "2ec92b6f-d9ae-450f-b4c6-dd28c0f8f8b2"

/** Returns the message of the first issue, and which field it landed on. */
function firstIssue(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const issue = result.error?.issues[0]
  return { field: issue?.path[0], message: issue?.message }
}

describe("createTripSchema", () => {
  const valid = {
    destination: "Kyoto",
    startingCity: "",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    travelers: 2,
    budget: 3000,
    currency: "USD",
    travelStyle: "balanced",
    interests: ["food", "history"],
    accommodation: "hotel",
    transportation: "mixed",
    notes: "",
  }

  it("accepts a complete, valid trip and trims the destination", () => {
    const result = createTripSchema.safeParse({
      ...valid,
      destination: "  Kyoto  ",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.destination).toBe("Kyoto")
  })

  it("accepts a blank budget (null) and a blank starting city", () => {
    expect(createTripSchema.safeParse({ ...valid, budget: null }).success).toBe(
      true
    )
  })

  it("puts an end-before-start error on the end date, where the user can fix it", () => {
    const result = createTripSchema.safeParse({
      ...valid,
      startDate: "2026-03-05",
      endDate: "2026-03-01",
    })
    expect(result.success).toBe(false)
    expect(firstIssue(result).field).toBe("endDate")
  })

  it("allows exactly 30 days and rejects 31", () => {
    // Inclusive of both ends: 1 March to 30 March is 30 days.
    expect(
      createTripSchema.safeParse({ ...valid, endDate: "2026-03-30" }).success
    ).toBe(true)
    const tooLong = createTripSchema.safeParse({
      ...valid,
      endDate: "2026-03-31",
    })
    expect(tooLong.success).toBe(false)
    expect(firstIssue(tooLong).field).toBe("endDate")
  })

  it.each([
    ["zero travellers", { travelers: 0 }],
    ["more than 20 travellers", { travelers: 21 }],
    ["a fractional traveller", { travelers: 1.5 }],
    ["a negative budget", { budget: -1 }],
    ["an unknown currency", { currency: "ZZZ" }],
    ["an unknown travel style", { travelStyle: "chaotic" }],
    ["a one-letter destination", { destination: "K" }],
    ["a non-ISO date", { startDate: "01/03/2026" }],
    ["an unknown interest", { interests: ["skydiving"] }],
  ])("rejects %s", (_label, override) => {
    expect(createTripSchema.safeParse({ ...valid, ...override }).success).toBe(
      false
    )
  })

  it("WIZARD_STEPS owns every field exactly once, so no field escapes step validation", () => {
    const owned = WIZARD_STEPS.flatMap((step) => [...step.fields])
    expect(new Set(owned).size).toBe(owned.length)
    expect([...owned].sort()).toEqual(Object.keys(valid).sort())
  })
})

describe("renameTripSchema", () => {
  it("trims the title", () => {
    const result = renameTripSchema.safeParse({ tripId: UUID, title: "  Lisbon  " })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.title).toBe("Lisbon")
  })

  it("rejects an empty or whitespace-only title", () => {
    expect(renameTripSchema.safeParse({ tripId: UUID, title: "" }).success).toBe(false)
    expect(renameTripSchema.safeParse({ tripId: UUID, title: "   " }).success).toBe(false)
  })

  it("allows 120 characters and rejects 121", () => {
    expect(renameTripSchema.safeParse({ tripId: UUID, title: "a".repeat(120) }).success).toBe(true)
    expect(renameTripSchema.safeParse({ tripId: UUID, title: "a".repeat(121) }).success).toBe(false)
  })

  it("rejects an id that is not a uuid", () => {
    expect(tripIdSchema.safeParse("not-a-uuid").success).toBe(false)
    expect(tripIdSchema.safeParse(UUID).success).toBe(true)
    expect(renameTripSchema.safeParse({ tripId: "1", title: "x" }).success).toBe(false)
  })
})

describe("expenseSchema", () => {
  const valid = {
    tripId: UUID,
    category: "food",
    amount: 12.5,
    currency: "EUR",
    description: "",
    expenseDate: "2026-03-02",
  }

  it("accepts a valid expense, with or without a description", () => {
    expect(expenseSchema.safeParse(valid).success).toBe(true)
    const withoutDescription: Partial<typeof valid> = { ...valid }
    delete withoutDescription.description
    expect(expenseSchema.safeParse(withoutDescription).success).toBe(true)
  })

  it.each([
    ["a zero amount", { amount: 0 }],
    ["a negative amount", { amount: -3 }],
    ["an absurd amount", { amount: 10_000_001 }],
    ["an unknown category", { category: "souvenirs" }],
    ["an unknown currency", { currency: "ZZZ" }],
    ["a malformed date", { expenseDate: "yesterday" }],
    ["an over-long description", { description: "x".repeat(201) }],
  ])("rejects %s", (_label, override) => {
    expect(expenseSchema.safeParse({ ...valid, ...override }).success).toBe(false)
  })
})

describe("packing schemas", () => {
  it("trims and requires both category and item", () => {
    const ok = packingItemSchema.safeParse({
      tripId: UUID,
      category: "  Documents ",
      item: " Passport ",
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.category).toBe("Documents")
      expect(ok.data.item).toBe("Passport")
    }
    expect(packingItemSchema.safeParse({ tripId: UUID, category: "", item: "x" }).success).toBe(false)
    expect(packingItemSchema.safeParse({ tripId: UUID, category: "x", item: "  " }).success).toBe(false)
  })

  it("an update needs a real id but every other field is optional", () => {
    expect(updatePackingItemSchema.safeParse({ id: UUID, isChecked: true }).success).toBe(true)
    expect(updatePackingItemSchema.safeParse({ id: "nope", isChecked: true }).success).toBe(false)
  })
})
