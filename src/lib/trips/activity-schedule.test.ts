import { describe, expect, it } from "vitest"

import {
  placeActivity,
  SLOT_DEFAULT_START,
  timeFitsSlot,
  type ScheduledActivity,
} from "@/lib/trips/activity-schedule"
import { chatOperationSchema } from "@/features/trips/schemas/chat.schemas"
import { dayCostUpdates } from "@/lib/trips/itinerary-costs"

const act = (
  id: string,
  time_slot: string | null,
  start_time: string | null,
  sort_order: number,
  duration_minutes: number | null = 90
): ScheduledActivity => ({ id, time_slot, start_time, duration_minutes, sort_order })

// Lisbon day 1 as generated: two mornings and an afternoon.
const day1 = [
  act("baixa", "morning", "09:30:00", 0, 90),
  act("statue", "morning", "11:15:00", 1, 30),
  act("arco", "afternoon", "14:30:00", 2, 60),
]
// Lisbon day 2: morning, afternoon, evening.
const day2 = [
  act("money", "morning", "10:00:00", 0, 120),
  act("ruins", "afternoon", "14:00:00", 1, 90),
  act("mude", "evening", "17:00:00", 2, 90),
]

describe("timeFitsSlot", () => {
  it("uses half-open windows at the slot boundaries", () => {
    expect(timeFitsSlot("11:59", "morning")).toBe(true)
    expect(timeFitsSlot("12:00", "morning")).toBe(false)
    expect(timeFitsSlot("12:00", "afternoon")).toBe(true)
    expect(timeFitsSlot("17:00", "evening")).toBe(true)
    expect(timeFitsSlot("10:00:00", "morning")).toBe(true)
    expect(timeFitsSlot(null, "morning")).toBe(false)
  })
})

describe("placeActivity - cross-slot move within a day", () => {
  it("never leaves a morning time on an activity moved to the evening", () => {
    // Baixa (09:30 morning) moved to day 1's evening, which is empty.
    const placement = placeActivity({
      id: "baixa",
      slot: "evening",
      currentStartTime: "09:30:00",
      dayActivities: day1,
    })
    expect(placement.reason).toBe("slot-default")
    expect(placement.startTime).toBe(SLOT_DEFAULT_START.evening)
    expect(timeFitsSlot(placement.startTime, "evening")).toBe(true)
    // It now comes last, and the others close the gap it left.
    expect(placement.sortOrder).toBe(2)
    expect(placement.reorder).toEqual([
      { id: "statue", sortOrder: 0 },
      { id: "arco", sortOrder: 1 },
    ])
  })

  it("moving into an occupied slot starts after what is already there", () => {
    // Statue (11:15 morning) to the afternoon, after Arco 14:30 + 60 min.
    const placement = placeActivity({
      id: "statue",
      slot: "afternoon",
      currentStartTime: "11:15:00",
      dayActivities: day1,
    })
    expect(placement).toMatchObject({ reason: "after-previous", startTime: "16:00", sortOrder: 2 })
  })

  it("caps a computed time so it stays inside the slot", () => {
    const busyEvening = [act("late", "evening", "21:00:00", 0, 120)]
    const placement = placeActivity({ id: "x", slot: "evening", dayActivities: busyEvening })
    expect(placement.startTime).toBe("21:30")
    expect(timeFitsSlot(placement.startTime, "evening")).toBe(true)
  })
})

describe("placeActivity - cross-day move", () => {
  it("keeps the activity's own time when it already fits the target slot, and slots it in by time", () => {
    // Arco (14:30 afternoon, day 1) to day 2's afternoon, which has Ruins at 14:00.
    const placement = placeActivity({
      id: "arco",
      slot: "afternoon",
      currentStartTime: "14:30:00",
      dayActivities: day2,
    })
    expect(placement).toMatchObject({ reason: "kept", startTime: "14:30", sortOrder: 2 })
    // MUDE (evening) shifts down one to make room.
    expect(placement.reorder).toEqual([{ id: "mude", sortOrder: 3 }])
  })

  it("moves a morning activity to another day's evening at a time inside that slot", () => {
    const placement = placeActivity({
      id: "baixa",
      slot: "evening",
      currentStartTime: "09:30:00",
      dayActivities: day2,
    })
    // After MUDE: 17:00 + 90 + 30 buffer = 19:00.
    expect(placement).toMatchObject({ reason: "after-previous", startTime: "19:00", sortOrder: 3 })
    expect(placement.reorder).toEqual([])
  })

  it("honours an explicit time inside the slot, which also decides the position", () => {
    const placement = placeActivity({
      id: "baixa",
      slot: "morning",
      explicitStartTime: "08:00",
      currentStartTime: "09:30:00",
      dayActivities: day2,
    })
    expect(placement).toMatchObject({ reason: "explicit", startTime: "08:00", sortOrder: 0 })
    expect(placement.reorder).toEqual([
      { id: "money", sortOrder: 1 },
      { id: "ruins", sortOrder: 2 },
      { id: "mude", sortOrder: 3 },
    ])
  })

  it("ignores an explicit time that contradicts the slot", () => {
    const placement = placeActivity({
      id: "baixa",
      slot: "evening",
      explicitStartTime: "10:00",
      dayActivities: [],
    })
    expect(placement).toMatchObject({ reason: "slot-default", startTime: SLOT_DEFAULT_START.evening })
  })

  it("re-derives daily_cost for both days once the move is applied", () => {
    // Arco (EUR 15) leaves day 1 for day 2.
    const days = [
      { id: "d1", daily_cost: 15 },
      { id: "d2", daily_cost: 10 },
    ]
    const after = [
      { trip_day_id: "d1", estimated_cost: 0 }, // baixa
      { trip_day_id: "d1", estimated_cost: 0 }, // statue
      { trip_day_id: "d2", estimated_cost: 15 }, // arco, moved
      { trip_day_id: "d2", estimated_cost: 10 }, // ruins
    ]
    expect(dayCostUpdates(days, after)).toEqual([
      { id: "d1", dailyCost: 0 },
      { id: "d2", dailyCost: 25 },
    ])
  })
})

describe("placeActivity - adding", () => {
  it("places an add with no requested time after the slot's last activity", () => {
    const placement = placeActivity({ id: "__new__", slot: "morning", dayActivities: day2 })
    // Money 10:00 + 120 + 30 = 12:30, capped at the morning's latest start.
    expect(placement).toMatchObject({ startTime: "11:30", sortOrder: 1 })
  })

  it("keeps untimed activities after timed ones in the same slot", () => {
    const placement = placeActivity({
      id: "__new__",
      slot: "morning",
      explicitStartTime: "09:00",
      dayActivities: [act("untimed", "morning", null, 0)],
    })
    expect(placement.sortOrder).toBe(0)
    expect(placement.reorder).toEqual([{ id: "untimed", sortOrder: 1 }])
  })
})

describe("stored proposals stay valid", () => {
  it("accepts a move saved before toStartTime existed, and an add with a null time", () => {
    expect(
      chatOperationSchema.safeParse({
        kind: "move_activity",
        activityId: "9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa",
        label: "Alfama walk",
        toDayNumber: 2,
        toTimeSlot: "evening",
      }).success
    ).toBe(true)
    expect(
      chatOperationSchema.safeParse({
        kind: "add_activity",
        dayNumber: 1,
        timeSlot: "evening",
        title: "t",
        description: "",
        locationName: "x",
        lat: 0,
        lng: 0,
        startTime: null,
        durationMinutes: 60,
        estimatedCost: 0,
        category: "museums",
      }).success
    ).toBe(true)
  })
})
