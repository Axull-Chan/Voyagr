import { fromMinutes, toMinutes } from "@/lib/trips/activity-schedule"

/**
 * Whether a proposed move/remove still describes the activity as it is now.
 *
 * A replan is computed against the trip at one moment and applied later; if
 * the activity has since moved day, slot or time (another proposal, a chat
 * edit, a second tab), applying the old operation would rearrange a day the
 * plan was never checked against. Only the fields the proposal recorded are
 * compared, so model proposals and older stored ones (which carry none) are
 * never treated as stale.
 */

export interface ExpectedState {
  expectedDayNumber?: number
  expectedTimeSlot?: string | null
  expectedStartTime?: string | null
}

export interface CurrentState {
  /** Null when the activity's day isn't one of this trip's days. */
  dayNumber: number | null
  timeSlot: string | null
  startTime: string | null
}

export const STALE_OPERATION_REASON = "It has changed since this was suggested."

export function hasExpectedState(op: ExpectedState): boolean {
  return (
    op.expectedDayNumber !== undefined ||
    op.expectedTimeSlot !== undefined ||
    op.expectedStartTime !== undefined
  )
}

const hhmm = (time: string | null | undefined) => {
  const minutes = toMinutes(time)
  return minutes === null ? null : fromMinutes(minutes)
}

/** The reason to skip, or null when the activity still matches. */
export function staleOperationReason(op: ExpectedState, current: CurrentState): string | null {
  if (op.expectedDayNumber !== undefined && current.dayNumber !== op.expectedDayNumber) {
    return STALE_OPERATION_REASON
  }
  if (op.expectedTimeSlot !== undefined && current.timeSlot !== op.expectedTimeSlot) {
    return STALE_OPERATION_REASON
  }
  if (op.expectedStartTime !== undefined && hhmm(current.startTime) !== hhmm(op.expectedStartTime)) {
    return STALE_OPERATION_REASON
  }
  return null
}
