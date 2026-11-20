import { describe, expect, it } from "vitest"

import type { ChatOperation } from "@/lib/ai/types"
import type { TimeSlot } from "@/lib/trips/trip-domain"
import type { GeoPoint } from "@/lib/trips/feasibility"
import {
  MAX_REPLAN_OPERATIONS,
  analyzeTripDay,
  applyOperationsInMemory,
  proposePaceFix,
  proposeWeatherFix,
  verifyOperations,
  type ForecastLike,
  type ReplanActivity,
  type ReplanTrip,
} from "@/lib/trips/replan"

const P = {
  hotel: { lat: 38.7097, lng: -9.1377 },
  baixa: { lat: 38.7101, lng: -9.137 },
  statue: { lat: 38.7075, lng: -9.1365 },
  arco: { lat: 38.7084, lng: -9.1368 },
  money: { lat: 38.7086, lng: -9.1389 },
  mude: { lat: 38.7092, lng: -9.1367 },
  story: { lat: 38.7077, lng: -9.1354 },
  santo: { lat: 38.7101, lng: -9.134 },
} satisfies Record<string, GeoPoint>

let seq = 0
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`

function act(
  title: string,
  dayNumber: number,
  timeSlot: TimeSlot,
  startTime: string | null,
  durationMinutes: number | null,
  point: GeoPoint,
  category: string | null = "historic",
  sortOrder = 0
): ReplanActivity {
  return { id: uuid(), title, dayNumber, timeSlot, startTime, durationMinutes, lat: point.lat, lng: point.lng, sortOrder, category }
}

const trip = (activities: ReplanActivity[], dayNumbers = [1, 2, 3]): ReplanTrip => ({
  dayNumbers,
  activities,
  start: P.hotel,
  transport: "public",
})

const rain: ForecastLike = { condition: "Rain", precipitationChance: 80, windKph: 12 }
const dry: ForecastLike = { condition: "Partly cloudy", precipitationChance: 5, windKph: 10 }

const moves = (ops: ChatOperation[]) => ops.filter((o) => o.kind === "move_activity")

describe("applyOperationsInMemory mirrors the apply action", () => {
  it("places a move with its explicit time and removes a removed stop", () => {
    const a = act("A", 1, "morning", "09:30", 60, P.baixa)
    const b = act("B", 2, "morning", "10:00", 60, P.statue)
    const after = applyOperationsInMemory(trip([a, b]), [
      { kind: "move_activity", activityId: a.id, label: "A", toDayNumber: 2, toTimeSlot: "evening", toStartTime: "18:30" },
      { kind: "remove_activity", activityId: b.id, label: "B" },
    ])
    expect(after.activities).toHaveLength(1)
    expect(after.activities[0]).toMatchObject({ id: a.id, dayNumber: 2, timeSlot: "evening", startTime: "18:30" })
  })
})

describe("Optimize pace", () => {
  it("re-spaces a tight day within itself when that is enough", () => {
    // B starts before A ends: tight.
    const a = act("Baixa", 1, "morning", "09:30", 60, P.baixa, "historic", 0)
    const b = act("Statue", 1, "morning", "10:00", 60, P.statue, "historic", 1)
    const t = trip([a, b, act("Mude", 2, "morning", "10:00", 60, P.mude)])
    expect(analyzeTripDay(t, 1).status).toBe("tight")

    const result = proposePaceFix(t, 1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.before).toBe("tight")
    expect(result.after).toBe("comfortable")
    // Only same-day retimes, each carrying the state it was proposed against.
    for (const op of result.operations) {
      expect(op).toMatchObject({ kind: "move_activity", toDayNumber: 1, expectedDayNumber: 1 })
    }
    expect(result.operations.some((op) => op.kind === "move_activity" && op.expectedStartTime === "10:00")).toBe(true)
    expect(result.reply).toContain("Tight timing to Comfortable pace")
  })

  // Six well-spaced stops: busy only because there are too many.
  const crowded = () => [
    act("Baixa", 1, "morning", "09:00", 30, P.baixa, "historic", 0),
    act("Statue", 1, "morning", "10:00", 30, P.statue, "historic", 1),
    act("Arco", 1, "morning", "11:00", 30, P.arco, "historic", 2),
    act("Money", 1, "afternoon", "13:00", 30, P.money, "museums", 3),
    act("Mude", 1, "afternoon", "14:30", 30, P.mude, "museums", 4),
    act("Story", 1, "afternoon", "16:00", 30, P.story, "museums", 5),
  ]

  it("moves one stop to the lightest other day that stays comfortable", () => {
    const busy = crowded()
    const t = trip([
      ...busy,
      act("Santo", 2, "morning", "10:00", 60, P.santo),
      act("Santo 2", 3, "morning", "10:00", 60, P.santo),
      act("Santo 3", 3, "afternoon", "14:00", 60, P.santo),
    ])
    expect(analyzeTripDay(t, 1).status).toBe("busy")
    const result = proposePaceFix(t, 1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Latest stop first; day 2 is lighter than day 3.
    expect(result.operations[0]).toMatchObject({ kind: "move_activity", label: "Story", toDayNumber: 2, toTimeSlot: "afternoon" })
    expect(result.after).toBe("comfortable")
    const after = applyOperationsInMemory(t, result.operations)
    expect(analyzeTripDay(after, 2).status).toBe("comfortable")
  })

  it("removes a stop only as a last resort, when no other day exists", () => {
    const result = proposePaceFix(trip(crowded(), [1]), 1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations[0]).toMatchObject({ kind: "remove_activity", label: "Story", expectedDayNumber: 1 })
    expect(result.reply).toContain("last resort")
  })

  it("does not remove when a move works", () => {
    const result = proposePaceFix(trip([...crowded(), act("x", 2, "morning", "10:00", 30, P.santo)]), 1)
    expect(result.ok && result.operations.some((o) => o.kind === "remove_activity")).toBe(false)
  })

  it("leaves a comfortable day alone", () => {
    const result = proposePaceFix(trip([act("Baixa", 1, "morning", "09:30", 60, P.baixa)]), 1)
    expect(result).toEqual({ ok: false, reply: expect.stringContaining("already has a comfortable pace") })
  })

  it(`never proposes more than ${MAX_REPLAN_OPERATIONS} operations`, () => {
    // Eight stops, all at the same time: every one needs a new time.
    const pile = Array.from({ length: 8 }, (_, i) =>
      act(`S${i}`, 1, i < 4 ? "morning" : "afternoon", i < 4 ? "09:00" : "13:00", 20, P.baixa, "historic", i)
    )
    const result = proposePaceFix(trip(pile, [1, 2]), 1)
    if (result.ok) expect(result.operations.length).toBeLessThanOrEqual(MAX_REPLAN_OPERATIONS)
    else expect(result.reply).toMatch(/No safe change found/)
  })
})

describe("the safety invariant (verifyOperations)", () => {
  it("rejects a change that gives another day a new tight problem", () => {
    const mover = act("Mover", 1, "morning", "09:30", 90, P.baixa)
    const resident = act("Resident", 2, "morning", "10:00", 60, P.statue)
    const t = trip([mover, act("Stay", 1, "afternoon", "14:00", 60, P.arco), resident])
    // Mover would start at 09:30 on day 2, running into Resident at 10:00.
    const ops: ChatOperation[] = [
      { kind: "move_activity", activityId: mover.id, label: "Mover", toDayNumber: 2, toTimeSlot: "morning", toStartTime: "09:30" },
    ]
    expect(verifyOperations(t, ops, 1, "no-new-problems").ok).toBe(false)
  })

  it("rejects a pace change that doesn't improve the target day", () => {
    const a = act("A", 1, "morning", "09:30", 60, P.baixa)
    const b = act("B", 1, "morning", "10:00", 60, P.statue) // tight
    const ops: ChatOperation[] = [
      // Moves A to a time that still overlaps.
      { kind: "move_activity", activityId: a.id, label: "A", toDayNumber: 1, toTimeSlot: "morning", toStartTime: "09:45" },
    ]
    expect(verifyOperations(trip([a, b]), ops, 1, "improve").ok).toBe(false)
  })

  it(`rejects more than ${MAX_REPLAN_OPERATIONS} operations, and none at all`, () => {
    const a = act("A", 1, "morning", "09:30", 30, P.baixa)
    const op: ChatOperation = { kind: "move_activity", activityId: a.id, label: "A", toDayNumber: 1, toTimeSlot: "morning", toStartTime: "09:30" }
    expect(verifyOperations(trip([a]), Array(MAX_REPLAN_OPERATIONS + 1).fill(op), 1, "no-new-problems").ok).toBe(false)
    expect(verifyOperations(trip([a]), Array(MAX_REPLAN_OPERATIONS).fill(op), 1, "no-new-problems").ok).toBe(true)
    expect(verifyOperations(trip([a]), [], 1, "no-new-problems").ok).toBe(false)
  })
})

describe("Adapt for weather", () => {
  it("swaps an outdoor stop with an indoor one from a drier day, trading slots and times", () => {
    const garden = act("Garden", 1, "morning", "10:00", 60, P.arco, "gardens_and_parks")
    const museum = act("Museum", 2, "morning", "10:30", 60, P.money, "museums")
    const t = trip([garden, museum, act("Old town", 1, "afternoon", "14:00", 60, P.baixa, "historic")])
    const result = proposeWeatherFix(t, 1, { 1: rain, 2: dry, 3: dry })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(moves(result.operations)).toEqual([
      expect.objectContaining({ activityId: garden.id, toDayNumber: 2, toTimeSlot: "morning", toStartTime: "10:30", expectedDayNumber: 1 }),
      expect.objectContaining({ activityId: museum.id, toDayNumber: 1, toTimeSlot: "morning", toStartTime: "10:00", expectedDayNumber: 2 }),
    ])
    expect(result.reply).toContain('swapped "Garden" with "Museum" from Day 2')
  })

  it("moves an outdoor stop on its own when the drier day has nothing indoor", () => {
    const beach = act("Beach", 1, "afternoon", "14:00", 90, P.statue, "beaches")
    const t = trip([beach, act("Monument", 2, "morning", "10:00", 60, P.baixa, "historic")], [1, 2])
    const result = proposeWeatherFix(t, 1, { 1: rain, 2: dry })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations).toHaveLength(1)
    expect(result.operations[0]).toMatchObject({ activityId: beach.id, toDayNumber: 2, toTimeSlot: "afternoon" })
  })

  it("never moves an ambiguous category", () => {
    const t = trip([act("Castle", 1, "morning", "10:00", 60, P.baixa, "historic")], [1, 2])
    const result = proposeWeatherFix(t, 1, { 1: rain, 2: dry })
    expect(result).toEqual({ ok: false, reply: expect.stringContaining("Nothing on Day 1 is clearly outdoors") })
  })

  it("never moves to a day whose forecast is unknown or also severe", () => {
    const t = trip([act("Park", 1, "morning", "10:00", 60, P.baixa, "natural")], [1, 2, 3])
    const result = proposeWeatherFix(t, 1, { 1: rain, 2: null, 3: { condition: "Thunderstorm", precipitationChance: 70, windKph: 20 } })
    expect(result).toEqual({ ok: false, reply: expect.stringContaining("No other day has a forecast known to be better") })
  })

  it("does nothing when the forecast isn't severe (same rule as the weather warnings)", () => {
    const t = trip([act("Park", 1, "morning", "10:00", 60, P.baixa, "natural")], [1, 2])
    // A "Rain" label at 10% is not severe; strong wind is.
    expect(proposeWeatherFix(t, 1, { 1: { condition: "Rain", precipitationChance: 10, windKph: 10 }, 2: dry }).ok).toBe(false)
    expect(proposeWeatherFix(t, 1, { 1: { condition: "Overcast", precipitationChance: 0, windKph: 45 }, 2: dry }).ok).toBe(true)
  })

  it("says no safe change rather than crowding another day", () => {
    const park = act("Park", 1, "morning", "10:00", 60, P.baixa, "natural")
    // Day 2's morning is solid until 12:30: anything placed there would overlap.
    const t = trip(
      [
        park,
        act("Long walk", 2, "morning", "09:00", 150, P.statue, "historic", 0),
        act("Tour", 2, "morning", "11:30", 60, P.arco, "historic", 1),
      ],
      [1, 2]
    )
    const result = proposeWeatherFix(t, 1, { 1: rain, 2: dry })
    expect(result).toEqual({ ok: false, reply: expect.stringContaining("No safe change found") })
  })
})
