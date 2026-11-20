import { TIME_SLOTS, type TimeSlot } from "@/lib/trips/trip-domain"

/**
 * Where an activity lands in a day — its start time and its place in the list —
 * when the chat moves one or adds one.
 *
 * The trip page groups a day's activities by `time_slot` and orders each group
 * by `sort_order`, and shows each one's `start_time`. A move used to change only
 * the slot and append the activity last, keeping its old time: an activity
 * moved to the evening still said 10:00, and sat after later ones. These rules
 * keep the three fields consistent: the time always falls inside the slot, and
 * the day is re-sequenced by slot, then time.
 */

/** Start times that belong to each slot: [start, end), 24-hour `HH:MM`. */
export const SLOT_WINDOWS: Record<TimeSlot, { start: string; end: string }> = {
  morning: { start: "06:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "23:59" },
}

/** Where an activity goes in an otherwise empty slot. */
export const SLOT_DEFAULT_START: Record<TimeSlot, string> = {
  morning: "09:30",
  afternoon: "14:00",
  evening: "18:30",
}

/** The latest start a computed time may take within each slot. */
const SLOT_LATEST_START: Record<TimeSlot, string> = {
  morning: "11:30",
  afternoon: "16:30",
  evening: "21:30",
}

/** Gap left after the previous activity in the slot before the next starts. */
export const BUFFER_MINUTES = 30

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)/

/** Minutes after midnight for `HH:MM` or `HH:MM:SS`, or null. */
export function toMinutes(time: string | null | undefined): number | null {
  const match = HH_MM.exec(time ?? "")
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function timeFitsSlot(time: string | null | undefined, slot: TimeSlot): boolean {
  const minutes = toMinutes(time)
  if (minutes === null) return false
  const window = SLOT_WINDOWS[slot]
  return minutes >= toMinutes(window.start)! && minutes < toMinutes(window.end)!
}

export interface ScheduledActivity {
  id: string
  time_slot: string | null
  start_time: string | null
  duration_minutes: number | null
  sort_order: number
}

export interface PlacementRequest {
  /** The activity being placed (a new activity can use a placeholder id). */
  id: string
  slot: TimeSlot
  /** A time the user or model asked for; used only if it fits the slot. */
  explicitStartTime?: string | null
  /** The activity's current time, kept on a move if it already fits the slot. */
  currentStartTime?: string | null
  /** The target day's activities as stored, the placed one excluded or not. */
  dayActivities: readonly ScheduledActivity[]
}

export interface Placement {
  startTime: string
  /** Why that time: shown nowhere, but pinned by tests and useful in logs. */
  reason: "explicit" | "kept" | "after-previous" | "slot-default"
  /** `sort_order` for the placed activity. */
  sortOrder: number
  /** Other activities on the target day whose `sort_order` must change. */
  reorder: { id: string; sortOrder: number }[]
}

function slotIndex(slot: string | null): number {
  const index = TIME_SLOTS.indexOf(slot as TimeSlot)
  return index === -1 ? TIME_SLOTS.length : index
}

/**
 * Chooses the start time, then re-sequences the whole target day by slot and
 * time (activities without a time keep their relative order after timed ones
 * in the same slot).
 *
 * Time, in order of preference: an explicit time inside the slot; on a move,
 * the activity's own time if it already falls in the slot; else straight after
 * the last activity already in that slot (plus a buffer, capped so it stays in
 * the slot); else the slot's default.
 */
export function placeActivity(request: PlacementRequest): Placement {
  const { id, slot } = request
  const others = request.dayActivities.filter((a) => a.id !== id)

  let startTime: string
  let reason: Placement["reason"]
  if (request.explicitStartTime && timeFitsSlot(request.explicitStartTime, slot)) {
    startTime = fromMinutes(toMinutes(request.explicitStartTime)!)
    reason = "explicit"
  } else if (request.currentStartTime && timeFitsSlot(request.currentStartTime, slot)) {
    startTime = fromMinutes(toMinutes(request.currentStartTime)!)
    reason = "kept"
  } else {
    const inSlot = others
      .filter((a) => a.time_slot === slot && toMinutes(a.start_time) !== null)
      .map((a) => toMinutes(a.start_time)! + Math.max(0, a.duration_minutes ?? 60))
    if (inSlot.length > 0) {
      const after = Math.ceil((Math.max(...inSlot) + BUFFER_MINUTES) / 15) * 15
      startTime = fromMinutes(Math.min(after, toMinutes(SLOT_LATEST_START[slot])!))
      reason = "after-previous"
    } else {
      startTime = SLOT_DEFAULT_START[slot]
      reason = "slot-default"
    }
  }

  const placed: ScheduledActivity = {
    id,
    time_slot: slot,
    start_time: startTime,
    duration_minutes: null,
    sort_order: Number.MAX_SAFE_INTEGER,
  }
  const ordered = [...others, placed].sort((a, b) => {
    const bySlot = slotIndex(a.time_slot) - slotIndex(b.time_slot)
    if (bySlot !== 0) return bySlot
    const ta = toMinutes(a.start_time)
    const tb = toMinutes(b.start_time)
    if (ta !== null && tb !== null && ta !== tb) return ta - tb
    if (ta === null && tb !== null) return 1
    if (tb === null && ta !== null) return -1
    // Equal times: the placed activity goes after the one already there.
    return a.sort_order - b.sort_order
  })

  let sortOrder = 0
  const reorder: Placement["reorder"] = []
  ordered.forEach((activity, index) => {
    if (activity.id === id) sortOrder = index
    else if (activity.sort_order !== index) reorder.push({ id: activity.id, sortOrder: index })
  })

  return { startTime, reason, sortOrder, reorder }
}
