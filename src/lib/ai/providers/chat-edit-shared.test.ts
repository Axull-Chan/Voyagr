import { describe, expect, it } from "vitest"

import {
  assignItemRefIds,
  resolveChatOperations,
  type ModelChatOperation,
  type ModelChatResponse,
} from "@/lib/ai/providers/chat-edit-shared"
import type { Candidates } from "@/lib/ai/providers/venue-grounded"
import type {
  ChatItinerarySnapshot,
  SourcedVenue,
} from "@/lib/ai/types"

/**
 * `resolveChatOperations` is the boundary where a model's choice meets real
 * data. These tests pin the rule the whole chat feature rests on: the model
 * picks *which* item and writes prose, and everything it cannot know — names,
 * coordinates, ids — comes from the real record, never from the model. Anything
 * that can't be resolved is dropped with a warning instead of being guessed.
 */

const venue = (
  id: string,
  name: string,
  kinds: string[] = ["museums"]
): SourcedVenue => ({
  id,
  name,
  latitude: 38.71,
  longitude: -9.13,
  rating: 3,
  kinds,
})

const candidates: Candidates = {
  attractionsById: new Map([["a1", venue("N100", "Museu do Azulejo")]]),
  restaurantsById: new Map([
    ["r1", venue("N200", "Cafe Central", ["cafes"])],
    ["r2", venue("N201", "Tasca do Rui", ["restaurants"])],
  ]),
  hotelsById: new Map(),
}

const snapshot: ChatItinerarySnapshot = {
  tripId: "trip-uuid",
  destination: "Lisbon",
  currency: "EUR",
  days: [
    { dayNumber: 1, date: "2026-03-01", summary: "Arrive" },
    { dayNumber: 2, date: "2026-03-02", summary: "Explore" },
  ],
  activities: [
    {
      id: "9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa",
      dayNumber: 1,
      timeSlot: "morning",
      title: "Alfama walk",
      locationName: "Alfama",
      startTime: "09:00",
      durationMinutes: 120,
      estimatedCost: 0,
      category: "walks",
    },
    {
      id: "9b1f5c3e-2222-4a2b-8c3d-bbbbbbbbbbbb",
      dayNumber: 2,
      timeSlot: "afternoon",
      title: "Tram 28",
      locationName: null,
      startTime: null,
      durationMinutes: null,
      estimatedCost: null,
      category: null,
    },
  ],
  restaurants: [
    {
      id: "7c0d4e2f-3333-4a2b-8c3d-cccccccccccc",
      dayNumber: 1,
      mealType: "dinner",
      name: "Old Tasca",
      cuisine: "Local",
    },
  ],
}

const itemRefs = assignItemRefIds(snapshot)
const DAY_COUNT = 2

/** A model operation with every optional field null, overridden per test. */
function op(partial: Partial<ModelChatOperation> & { kind: ModelChatOperation["kind"] }): ModelChatOperation {
  return {
    dayNumber: null,
    timeSlot: null,
    mealType: null,
    venueRef: null,
    itemRef: null,
    toDayNumber: null,
    toTimeSlot: null,
    title: null,
    description: null,
    startTime: null,
    durationMinutes: null,
    estimatedCost: null,
    summary: null,
    ...partial,
  }
}

function resolve(...operations: ModelChatOperation[]) {
  const response: ModelChatResponse = { reply: "Here's a suggestion.", operations }
  return resolveChatOperations(response, candidates, itemRefs, DAY_COUNT)
}

describe("assignItemRefIds", () => {
  it("hands the model short tokens, never the real UUIDs", () => {
    const { activitiesByRef, restaurantsByRef } = itemRefs
    expect([...activitiesByRef.keys()]).toEqual(["act1", "act2"])
    expect([...restaurantsByRef.keys()]).toEqual(["res1"])
    for (const key of [...activitiesByRef.keys(), ...restaurantsByRef.keys()]) {
      expect(key).not.toMatch(/-/)
    }
  })

  it("maps each token back to the right real item", () => {
    expect(itemRefs.activitiesByRef.get("act2")?.title).toBe("Tram 28")
    expect(itemRefs.restaurantsByRef.get("res1")?.name).toBe("Old Tasca")
  })
})

describe("resolveChatOperations — adding an activity", () => {
  it("takes name, coordinates and category from the real venue", () => {
    const { operations, warnings } = resolve(
      op({ kind: "add_activity", venueRef: "a1", dayNumber: 2, title: "Tiles!" })
    )
    expect(warnings).toEqual([])
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({
      kind: "add_activity",
      dayNumber: 2,
      title: "Tiles!",
      locationName: "Museu do Azulejo",
      lat: 38.71,
      lng: -9.13,
      category: "museums",
    })
  })

  it("falls back to 'Visit <venue>' when the model gives no usable title", () => {
    for (const title of [null, "", "   "]) {
      const { operations } = resolve(
        op({ kind: "add_activity", venueRef: "a1", dayNumber: 1, title })
      )
      expect(operations[0]).toMatchObject({ title: "Visit Museu do Azulejo" })
    }
  })

  it("drops a venue the model invented", () => {
    const { operations, warnings } = resolve(
      op({ kind: "add_activity", venueRef: "a99", dayNumber: 1 })
    )
    expect(operations).toEqual([])
    expect(warnings).toHaveLength(1)
  })

  it("does not accept a restaurant ref as an attraction", () => {
    const { operations } = resolve(
      op({ kind: "add_activity", venueRef: "r1", dayNumber: 1 })
    )
    expect(operations).toEqual([])
  })

  it.each([0, 3, -1, null])("drops a day outside 1..2 (%s)", (dayNumber) => {
    const { operations, warnings } = resolve(
      op({ kind: "add_activity", venueRef: "a1", dayNumber })
    )
    expect(operations).toEqual([])
    expect(warnings).toHaveLength(1)
  })

  it("clamps duration to 15–480 minutes, defaulting to 90", () => {
    const duration = (durationMinutes: number | null) =>
      resolve(
        op({ kind: "add_activity", venueRef: "a1", dayNumber: 1, durationMinutes })
      ).operations[0]
    expect(duration(5)).toMatchObject({ durationMinutes: 15 })
    expect(duration(9999)).toMatchObject({ durationMinutes: 480 })
    expect(duration(null)).toMatchObject({ durationMinutes: 90 })
    expect(duration(60)).toMatchObject({ durationMinutes: 60 })
  })

  it("never lets a cost go negative", () => {
    const cost = (estimatedCost: number | null) =>
      resolve(
        op({ kind: "add_activity", venueRef: "a1", dayNumber: 1, estimatedCost })
      ).operations[0]
    expect(cost(-20)).toMatchObject({ estimatedCost: 0 })
    expect(cost(null)).toMatchObject({ estimatedCost: 0 })
    expect(cost(12.5)).toMatchObject({ estimatedCost: 12.5 })
  })

  it("accepts only a valid HH:MM start time, else leaves it null for the app to place", () => {
    const start = (startTime: string | null) =>
      resolve(
        op({ kind: "add_activity", venueRef: "a1", dayNumber: 1, startTime })
      ).operations[0]
    expect(start("09:30")).toMatchObject({ startTime: "09:30" })
    expect(start("25:00")).toMatchObject({ startTime: null })
    expect(start("9:30")).toMatchObject({ startTime: null })
    expect(start("noonish")).toMatchObject({ startTime: null })
    expect(start(null)).toMatchObject({ startTime: null })
  })

  it("coerces an unknown time slot to morning", () => {
    const { operations } = resolve(
      op({ kind: "add_activity", venueRef: "a1", dayNumber: 1, timeSlot: "midnight" })
    )
    expect(operations[0]).toMatchObject({ timeSlot: "morning" })
  })
})

describe("resolveChatOperations — restaurants", () => {
  it("takes the name from the venue and labels a café as one", () => {
    const { operations } = resolve(
      op({ kind: "add_restaurant", venueRef: "r1", dayNumber: 1, mealType: "breakfast" }),
      op({ kind: "add_restaurant", venueRef: "r2", dayNumber: 1, mealType: "dinner" })
    )
    expect(operations[0]).toMatchObject({ name: "Cafe Central", cuisine: "Café", mealType: "breakfast" })
    expect(operations[1]).toMatchObject({ name: "Tasca do Rui", cuisine: "Local", mealType: "dinner" })
  })

  it("coerces an unknown meal type to lunch", () => {
    const { operations } = resolve(
      op({ kind: "add_restaurant", venueRef: "r1", dayNumber: 1, mealType: "brunch" })
    )
    expect(operations[0]).toMatchObject({ mealType: "lunch" })
  })

  it("drops an unknown venue or an out-of-range day", () => {
    expect(resolve(op({ kind: "add_restaurant", venueRef: "r9", dayNumber: 1 })).operations).toEqual([])
    expect(resolve(op({ kind: "add_restaurant", venueRef: "r1", dayNumber: 3 })).operations).toEqual([])
  })
})

describe("resolveChatOperations — removing and moving existing items", () => {
  it("resolves a token to the real id and a display label", () => {
    const { operations } = resolve(
      op({ kind: "remove_activity", itemRef: "act1" }),
      op({ kind: "remove_restaurant", itemRef: "res1" })
    )
    expect(operations).toEqual([
      {
        kind: "remove_activity",
        activityId: "9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa",
        label: "Alfama walk",
      },
      {
        kind: "remove_restaurant",
        restaurantId: "7c0d4e2f-3333-4a2b-8c3d-cccccccccccc",
        label: "Old Tasca",
      },
    ])
  })

  it("drops a removal that points at something not on the trip", () => {
    const { operations, warnings } = resolve(
      op({ kind: "remove_activity", itemRef: "act9" }),
      op({ kind: "remove_restaurant", itemRef: "act1" }), // wrong kind of ref
      op({ kind: "remove_activity", itemRef: null })
    )
    expect(operations).toEqual([])
    expect(warnings).toHaveLength(3)
  })

  it("moves an activity, validating the destination day", () => {
    const ok = resolve(
      op({ kind: "move_activity", itemRef: "act1", toDayNumber: 2, toTimeSlot: "evening" })
    )
    expect(ok.operations[0]).toMatchObject({
      kind: "move_activity",
      activityId: "9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa",
      toDayNumber: 2,
      toTimeSlot: "evening",
    })
    expect(ok.operations[0]).toMatchObject({ toStartTime: null })
    const bad = resolve(op({ kind: "move_activity", itemRef: "act1", toDayNumber: 9 }))
    expect(bad.operations).toEqual([])
    expect(bad.warnings).toHaveLength(1)
  })

  it("carries an explicitly requested time on a move, and drops a malformed one", () => {
    const at = (startTime: string | null) =>
      resolve(
        op({ kind: "move_activity", itemRef: "act1", toDayNumber: 2, toTimeSlot: "evening", startTime })
      ).operations[0]
    expect(at("19:15")).toMatchObject({ toStartTime: "19:15" })
    expect(at("7pm")).toMatchObject({ toStartTime: null })
  })
})

describe("resolveChatOperations — day summaries and no-ops", () => {
  it("trims a reworded summary", () => {
    const { operations } = resolve(
      op({ kind: "reword_day_summary", dayNumber: 1, summary: "  A slower first day.  " })
    )
    expect(operations).toEqual([
      { kind: "reword_day_summary", dayNumber: 1, summary: "A slower first day." },
    ])
  })

  it("drops a blank summary or an unknown day", () => {
    const { operations, warnings } = resolve(
      op({ kind: "reword_day_summary", dayNumber: 1, summary: "   " }),
      op({ kind: "reword_day_summary", dayNumber: 7, summary: "text" })
    )
    expect(operations).toEqual([])
    expect(warnings).toHaveLength(2)
  })

  it("'none' produces neither an operation nor a warning", () => {
    const result = resolve(op({ kind: "none" }))
    expect(result.operations).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.reply).toBe("Here's a suggestion.")
  })

  it("keeps the valid operations when others in the same turn are dropped", () => {
    const { operations, warnings } = resolve(
      op({ kind: "add_activity", venueRef: "a1", dayNumber: 1 }),
      op({ kind: "add_activity", venueRef: "a99", dayNumber: 1 }),
      op({ kind: "remove_activity", itemRef: "act2" })
    )
    expect(operations.map((o) => o.kind)).toEqual(["add_activity", "remove_activity"])
    expect(warnings).toHaveLength(1)
  })
})
