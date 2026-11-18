import { describe, expect, it } from "vitest"

import {
  activityFieldsSchema,
  addActivitySchema,
  moveActivitySchema,
  updateActivitySchema,
} from "./itinerary.schemas"

const valid = {
  title: "Walk the old town",
  timeSlot: "morning",
  startTime: "09:30",
  durationMinutes: 90,
  estimatedCost: 12.5,
  locationName: "Alfama",
  description: "Start early to beat the crowds.",
}

const uuid = "5b3f6c3e-8d0a-4b8e-9c7e-2f1a4d6b9e10"

describe("activityFieldsSchema", () => {
  it("accepts a fully filled-in activity", () => {
    expect(activityFieldsSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts only a title and a time of day, with every optional field null or empty", () => {
    const result = activityFieldsSchema.safeParse({
      title: "Free afternoon",
      timeSlot: "afternoon",
      startTime: null,
      durationMinutes: null,
      estimatedCost: null,
      locationName: "",
      description: "",
    })
    expect(result.success).toBe(true)
  })

  it("trims the title and rejects a blank one", () => {
    const ok = activityFieldsSchema.safeParse({ ...valid, title: "  Museum  " })
    expect(ok.success && ok.data.title).toBe("Museum")
    const blank = activityFieldsSchema.safeParse({ ...valid, title: "   " })
    expect(blank.success).toBe(false)
    expect(!blank.success && blank.error.issues[0]?.message).toMatch(/title/i)
  })

  it("only allows the three times of day the timeline can show", () => {
    expect(activityFieldsSchema.safeParse({ ...valid, timeSlot: "night" }).success).toBe(false)
    for (const slot of ["morning", "afternoon", "evening"]) {
      expect(activityFieldsSchema.safeParse({ ...valid, timeSlot: slot }).success).toBe(true)
    }
  })

  it.each(["9:30", "24:00", "12:60", "noon", "09:30:00", ""])(
    "rejects the start time %j",
    (startTime) => {
      expect(activityFieldsSchema.safeParse({ ...valid, startTime }).success).toBe(false)
    }
  )

  it("bounds the duration to whole minutes between 5 and a day", () => {
    for (const durationMinutes of [4, 1441, 30.5, -10]) {
      expect(activityFieldsSchema.safeParse({ ...valid, durationMinutes }).success).toBe(false)
    }
    expect(activityFieldsSchema.safeParse({ ...valid, durationMinutes: 5 }).success).toBe(true)
    expect(activityFieldsSchema.safeParse({ ...valid, durationMinutes: 1440 }).success).toBe(true)
  })

  it("allows a free activity (cost 0) but not a negative or absurd one", () => {
    expect(activityFieldsSchema.safeParse({ ...valid, estimatedCost: 0 }).success).toBe(true)
    expect(activityFieldsSchema.safeParse({ ...valid, estimatedCost: -1 }).success).toBe(false)
    expect(activityFieldsSchema.safeParse({ ...valid, estimatedCost: 2_000_000 }).success).toBe(false)
  })

  it("rejects NaN, which is what an unparsable number field turns into", () => {
    expect(activityFieldsSchema.safeParse({ ...valid, estimatedCost: Number.NaN }).success).toBe(false)
    expect(activityFieldsSchema.safeParse({ ...valid, durationMinutes: Number.NaN }).success).toBe(false)
  })

  it("caps text lengths", () => {
    expect(activityFieldsSchema.safeParse({ ...valid, title: "x".repeat(121) }).success).toBe(false)
    expect(activityFieldsSchema.safeParse({ ...valid, locationName: "x".repeat(121) }).success).toBe(false)
    expect(activityFieldsSchema.safeParse({ ...valid, description: "x".repeat(501) }).success).toBe(false)
  })

  it("has no coordinate, travel-time or distance fields, so a manual edit can never write a guessed place", () => {
    const result = activityFieldsSchema.safeParse({
      ...valid,
      lat: 38.7,
      lng: -9.1,
      travelTimeMinutes: 20,
      walkingDistanceKm: 1.2,
    })
    // zod strips unknown keys: they never reach the action.
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("lat")
      expect(result.data).not.toHaveProperty("lng")
      expect(result.data).not.toHaveProperty("travelTimeMinutes")
      expect(result.data).not.toHaveProperty("walkingDistanceKm")
    }
  })
})

describe("action inputs", () => {
  it("add needs a real trip id and day id", () => {
    expect(addActivitySchema.safeParse({ ...valid, tripId: uuid, dayId: uuid }).success).toBe(true)
    expect(addActivitySchema.safeParse({ ...valid, tripId: "nope", dayId: uuid }).success).toBe(false)
    expect(addActivitySchema.safeParse({ ...valid, tripId: uuid }).success).toBe(false)
  })

  it("update needs a trip id and an activity id", () => {
    expect(
      updateActivitySchema.safeParse({ ...valid, tripId: uuid, activityId: uuid }).success
    ).toBe(true)
    expect(updateActivitySchema.safeParse({ ...valid, tripId: uuid }).success).toBe(false)
  })

  it("move only accepts up or down", () => {
    expect(moveActivitySchema.safeParse({ tripId: uuid, activityId: uuid, direction: "up" }).success).toBe(true)
    expect(moveActivitySchema.safeParse({ tripId: uuid, activityId: uuid, direction: "left" }).success).toBe(false)
  })
})
