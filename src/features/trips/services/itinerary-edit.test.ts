import { describe, expect, it } from "vitest"

import {
  FORECAST_UNAVAILABLE,
  buildBlankDays,
  dayCostFrom,
  editBlockedReason,
  orderActivities,
  reorderWithinSlot,
  weatherRowsForDays,
  type OrderedActivity,
} from "./itinerary-edit"

const act = (
  id: string,
  slot: string | null,
  sortOrder: number,
  createdAt = "2026-01-01T00:00:00Z"
): OrderedActivity => ({ id, time_slot: slot, sort_order: sortOrder, created_at: createdAt })

/** Apply the returned updates to a list, the way the database would. */
function apply(items: OrderedActivity[], updates: { id: string; sortOrder: number }[] | null) {
  const next = new Map(updates?.map((u) => [u.id, u.sortOrder]))
  return orderActivities(items.map((a) => ({ ...a, sort_order: next.get(a.id) ?? a.sort_order }))).map(
    (a) => a.id
  )
}

/** The order the timeline would show one time of day in, after applying the updates. */
function inSlot(
  items: OrderedActivity[],
  updates: { id: string; sortOrder: number }[] | null,
  slot: string
) {
  const next = new Map(updates?.map((u) => [u.id, u.sortOrder]))
  return orderActivities(
    items.map((a) => ({ ...a, sort_order: next.get(a.id) ?? a.sort_order }))
  )
    .filter((a) => a.time_slot === slot)
    .map((a) => a.id)
}

describe("editBlockedReason", () => {
  it("blocks a trip that is still generating, because the generator would erase the edit", () => {
    expect(editBlockedReason("generating")).toMatch(/still being built/i)
  })

  it("blocks an archived trip and says how to get it back", () => {
    expect(editBlockedReason("archived")).toMatch(/restore/i)
  })

  it.each(["draft", "ready"])("allows a %s trip", (status) => {
    expect(editBlockedReason(status)).toBeNull()
  })
})

describe("orderActivities", () => {
  it("orders by sort_order, and does not change its input", () => {
    const input = [act("c", "morning", 2), act("a", "morning", 0), act("b", "morning", 1)]
    expect(orderActivities(input).map((a) => a.id)).toEqual(["a", "b", "c"])
    expect(input.map((a) => a.id)).toEqual(["c", "a", "b"])
  })

  it("breaks a tie by creation time, then id, so the order never depends on the database", () => {
    const tied = [
      act("z", "morning", 1, "2026-01-02T00:00:00Z"),
      act("y", "morning", 1, "2026-01-01T00:00:00Z"),
      act("b", "morning", 1, "2026-01-01T00:00:00Z"),
    ]
    expect(orderActivities(tied).map((a) => a.id)).toEqual(["b", "y", "z"])
    expect(orderActivities([...tied].reverse()).map((a) => a.id)).toEqual(["b", "y", "z"])
  })
})

describe("reorderWithinSlot", () => {
  const day = [
    act("m1", "morning", 0),
    act("m2", "morning", 1),
    act("a1", "afternoon", 2),
    act("m3", "morning", 3),
    act("a2", "afternoon", 4),
  ]

  it("moves an activity down past the next one in the SAME time of day, skipping other slots", () => {
    // m2's next morning neighbour is m3; the afternoon item a1 lies between them in
    // the stored order and must not count as its neighbour.
    const updates = reorderWithinSlot(day, "m2", "down")
    expect(inSlot(day, updates, "morning")).toEqual(["m1", "m3", "m2"])
    // The other slot is exactly as it was.
    expect(inSlot(day, updates, "afternoon")).toEqual(["a1", "a2"])
  })

  it("moves an activity up", () => {
    const updates = reorderWithinSlot(day, "m3", "up")
    expect(inSlot(day, updates, "morning")).toEqual(["m1", "m3", "m2"])
    expect(inSlot(day, updates, "afternoon")).toEqual(["a1", "a2"])
  })

  it("does nothing at the edge of its group", () => {
    expect(reorderWithinSlot(day, "m1", "up")).toBeNull()
    expect(reorderWithinSlot(day, "m3", "down")).toBeNull()
    // Last in its slot even though the day continues: a2 is the only later item and it
    // is in another slot.
    expect(reorderWithinSlot(day, "a2", "down")).toBeNull()
  })

  it("does nothing for an activity that is not on the day", () => {
    expect(reorderWithinSlot(day, "nope", "up")).toBeNull()
  })

  it("only writes the rows that change", () => {
    const updates = reorderWithinSlot([act("a", "morning", 0), act("b", "morning", 1)], "b", "up")
    expect(updates).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ])
    // A clean day: moving the first of three down touches just the two that swap.
    const three = [act("a", "morning", 0), act("b", "morning", 1), act("c", "morning", 2)]
    expect(reorderWithinSlot(three, "a", "down")).toHaveLength(2)
  })

  it("converges on a clean 0..n sequence even when rows share a sort_order", () => {
    // Two rows tied at 1, as an interrupted reorder can leave them.
    const tied = [act("a", "morning", 1, "2026-01-01T00:00:00Z"), act("b", "morning", 1, "2026-01-02T00:00:00Z")]
    const updates = reorderWithinSlot(tied, "b", "up")
    expect(apply(tied, updates)).toEqual(["b", "a"])
    // Only b changes (a already holds 1), yet the stored values end up a clean 0, 1.
    const stored = new Map(tied.map((a) => [a.id, a.sort_order]))
    for (const u of updates ?? []) stored.set(u.id, u.sortOrder)
    expect([...stored.values()].sort()).toEqual([0, 1])
  })

  it("groups an unrecognised or missing slot together as one group", () => {
    const odd = [act("x", null, 0), act("y", "brunch", 1), act("m", "morning", 2)]
    expect(apply(odd, reorderWithinSlot(odd, "y", "up"))).toEqual(["y", "x", "m"])
    expect(reorderWithinSlot(odd, "m", "up")).toBeNull()
  })
})

describe("dayCostFrom", () => {
  it("sums the activity costs and rounds to cents", () => {
    expect(dayCostFrom([10, 5.555, 0.1])).toBe(15.66)
  })

  it("accepts numeric strings, which is how Postgres numeric can arrive", () => {
    expect(dayCostFrom(["12.50", "7.25"])).toBe(19.75)
  })

  it("ignores nulls, negatives and junk, and is 0 for an empty day", () => {
    expect(dayCostFrom([null, -5, Number.NaN, "abc"])).toBe(0)
    expect(dayCostFrom([])).toBe(0)
  })
})

describe("buildBlankDays", () => {
  it("makes one numbered, dated day per calendar date, both ends included", () => {
    expect(buildBlankDays("2026-03-30", "2026-04-02")).toEqual([
      { dayNumber: 1, date: "2026-03-30" },
      { dayNumber: 2, date: "2026-03-31" },
      { dayNumber: 3, date: "2026-04-01" },
      { dayNumber: 4, date: "2026-04-02" },
    ])
  })

  it("makes a single day for a one-day trip", () => {
    expect(buildBlankDays("2026-05-05", "2026-05-05")).toEqual([
      { dayNumber: 1, date: "2026-05-05" },
    ])
  })

  it("returns nothing for missing, reversed or over-long dates, so no partial trip is made", () => {
    expect(buildBlankDays(null, "2026-05-05")).toEqual([])
    expect(buildBlankDays("2026-05-05", null)).toEqual([])
    expect(buildBlankDays("2026-05-06", "2026-05-05")).toEqual([])
    expect(buildBlankDays("2026-01-01", "2026-03-01")).toEqual([])
  })
})

describe("weatherRowsForDays", () => {
  const days = [
    { id: "d1", date: "2026-03-01" },
    { id: "d2", date: "2026-03-02" },
    { id: "d3", date: null },
  ]
  const forecast = {
    condition: "Light rain",
    tempHighC: 14,
    tempLowC: 8,
    precipitationChance: 70,
    windKph: 12,
    humidity: 80,
    sunrise: "07:10",
    sunset: "18:20",
  }

  it("uses the real reading, labelled as such, for a date that has one", () => {
    const [row] = weatherRowsForDays(days, { "2026-03-01": forecast })
    expect(row).toMatchObject({
      trip_day_id: "d1",
      condition: "Light rain",
      temp_high_c: 14,
      source: "open-meteo",
    })
  })

  it("gives every other day a plain 'not yet available' row with no numbers — never a guess", () => {
    const rows = weatherRowsForDays(days, { "2026-03-01": forecast })
    for (const row of rows.slice(1)) {
      expect(row.source).toBe("unavailable")
      expect(row.condition).toBe(FORECAST_UNAVAILABLE)
      expect(row.temp_high_c).toBeNull()
      expect(row.temp_low_c).toBeNull()
      expect(row.precipitation_chance).toBeNull()
    }
  })

  it("writes one row per day, and treats a day with no date as unavailable", () => {
    const rows = weatherRowsForDays(days, {})
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.source === "unavailable")).toBe(true)
  })
})
