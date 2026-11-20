import { describe, expect, it } from "vitest"

import {
  STALE_OPERATION_REASON,
  hasExpectedState,
  staleOperationReason,
} from "@/lib/trips/operation-staleness"
import { chatOperationSchema } from "@/features/trips/schemas/chat.schemas"
import { describeOperation } from "@/features/trips/services/chat-operation-text"

const now = { dayNumber: 2, timeSlot: "morning", startTime: "10:00:00" }

describe("staleOperationReason", () => {
  it("passes an operation whose expected state still matches (seconds ignored)", () => {
    expect(
      staleOperationReason({ expectedDayNumber: 2, expectedTimeSlot: "morning", expectedStartTime: "10:00" }, now)
    ).toBeNull()
  })

  it.each([
    ["moved to another day", { expectedDayNumber: 1 }],
    ["moved to another slot", { expectedTimeSlot: "afternoon" }],
    ["retimed", { expectedStartTime: "09:30" }],
    ["given a time when it had none", { expectedStartTime: null }],
  ])("skips one that has been %s since", (_label, expected) => {
    expect(staleOperationReason(expected, now)).toBe(STALE_OPERATION_REASON)
  })

  it("treats an activity no longer on this trip's days as changed", () => {
    expect(staleOperationReason({ expectedDayNumber: 2 }, { ...now, dayNumber: null })).toBe(STALE_OPERATION_REASON)
  })

  it("never calls a model proposal or an older stored one stale (no expected fields)", () => {
    expect(hasExpectedState({})).toBe(false)
    expect(staleOperationReason({}, { dayNumber: null, timeSlot: null, startTime: null })).toBeNull()
  })
})

describe("stored proposals stay valid", () => {
  const id = "9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa"
  it("accepts moves and removes with or without expected state", () => {
    for (const op of [
      { kind: "move_activity", activityId: id, label: "A", toDayNumber: 2, toTimeSlot: "evening" },
      { kind: "move_activity", activityId: id, label: "A", toDayNumber: 2, toTimeSlot: "evening", toStartTime: "18:30", expectedDayNumber: 1, expectedTimeSlot: "morning", expectedStartTime: "10:00" },
      { kind: "remove_activity", activityId: id, label: "A" },
      { kind: "remove_activity", activityId: id, label: "A", expectedDayNumber: 1, expectedTimeSlot: null, expectedStartTime: null },
    ]) {
      expect(chatOperationSchema.safeParse(op).success).toBe(true)
    }
  })

  it("rejects a malformed expected state", () => {
    expect(
      chatOperationSchema.safeParse({ kind: "remove_activity", activityId: id, label: "A", expectedDayNumber: 0 }).success
    ).toBe(false)
  })
})

describe("describeOperation", () => {
  const id = "9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa"
  it("shows the new time, and calls a same-day same-slot change a retime", () => {
    expect(
      describeOperation(
        { kind: "move_activity", activityId: id, label: "Arco", toDayNumber: 2, toTimeSlot: "morning", toStartTime: "10:15", expectedDayNumber: 2, expectedTimeSlot: "morning", expectedStartTime: "09:30" },
        "EUR"
      )
    ).toBe("Retime: Arco — Day 2, morning at 10:15")
    expect(
      describeOperation(
        { kind: "move_activity", activityId: id, label: "Arco", toDayNumber: 3, toTimeSlot: "afternoon", toStartTime: "14:00", expectedDayNumber: 2, expectedTimeSlot: "morning" },
        "EUR"
      )
    ).toBe("Move: Arco — Day 3, afternoon at 14:00")
    expect(
      describeOperation({ kind: "move_activity", activityId: id, label: "Arco", toDayNumber: 3, toTimeSlot: "evening" }, "EUR")
    ).toBe("Move: Arco — Day 3, evening")
  })
})
