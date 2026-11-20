import type { ChatOperation } from "@/lib/ai/types"
import { isSevereForecast } from "@/lib/ai/providers/weather-warnings"
import type { TimeSlot } from "@/lib/trips/trip-domain"
import { placeActivity, toMinutes, fromMinutes } from "@/lib/trips/activity-schedule"
import {
  FEASIBILITY_STATUS_LABEL,
  analyzeDay,
  planDayRoute,
  sortStopsByTime,
  type DayFeasibility,
  type FeasibilityStatus,
  type GeoPoint,
} from "@/lib/trips/feasibility"

/**
 * Deterministic replanning: "Optimize pace" for a tight or busy day, and
 * "Adapt for weather" for a day with a severe forecast. Pure — no database,
 * no model, no network.
 *
 * Output is ordinary chat operations (moves and removes), shown and applied
 * through the existing proposal flow, so nothing changes without the traveller
 * pressing Apply. Every candidate set of operations is first applied to an
 * in-memory copy of the trip with the same placement rule the apply action
 * uses, and kept only if `analyzeDay` says the target day improves and no day
 * gains a tight or busy problem it didn't already have.
 */

/** The chat apply action takes at most this many operations per proposal. */
export const MAX_REPLAN_OPERATIONS = 6

/** Categories (an activity's first OpenStreetMap kind) that are clearly outdoors. */
export const OUTDOOR_CATEGORIES: ReadonlySet<string> = new Set([
  "natural",
  "gardens_and_parks",
  "beaches",
  "view_points",
  "urban_environment",
  "bridges",
  "sport",
])

/** Categories that are clearly indoors. Anything in neither set is never moved for weather. */
export const INDOOR_CATEGORIES: ReadonlySet<string> = new Set([
  "museums",
  "theatres_and_entertainments",
  "religion",
  "shops",
])

export interface ReplanActivity {
  id: string
  title: string
  dayNumber: number
  timeSlot: TimeSlot | null
  startTime: string | null
  durationMinutes: number | null
  lat: number | null
  lng: number | null
  sortOrder: number
  category: string | null
}

export interface ReplanTrip {
  dayNumbers: number[]
  activities: ReplanActivity[]
  /** Where each day starts (the real stay), as on the trip page. */
  start: GeoPoint | null
  transport: string | null
}

export interface ForecastLike {
  condition: string
  precipitationChance: number | null
  windKph: number | null
}

export type ReplanResult =
  | {
      ok: true
      operations: ChatOperation[]
      reply: string
      before: FeasibilityStatus
      after: FeasibilityStatus
    }
  | { ok: false; reply: string }

// ---------------------------------------------------------------------------
// Simulation and verification
// ---------------------------------------------------------------------------

const hhmm = (time: string | null) => {
  const minutes = toMinutes(time)
  return minutes === null ? null : fromMinutes(minutes)
}

function dayStops(trip: ReplanTrip, dayNumber: number) {
  return trip.activities.filter((a) => a.dayNumber === dayNumber)
}

export function analyzeTripDay(trip: ReplanTrip, dayNumber: number): DayFeasibility {
  return analyzeDay(dayStops(trip, dayNumber), { start: trip.start, transport: trip.transport })
}

/**
 * Applies operations to a copy of the trip exactly as the apply action does:
 * a move goes through `placeActivity` against the target day as it stands
 * (an explicit time wins when it fits the slot), a remove deletes.
 */
export function applyOperationsInMemory(trip: ReplanTrip, operations: readonly ChatOperation[]): ReplanTrip {
  let activities = trip.activities.map((a) => ({ ...a }))
  for (const op of operations) {
    if (op.kind === "remove_activity") {
      activities = activities.filter((a) => a.id !== op.activityId)
    } else if (op.kind === "move_activity") {
      const moving = activities.find((a) => a.id === op.activityId)
      if (!moving) continue
      const placement = placeActivity({
        id: moving.id,
        slot: op.toTimeSlot,
        explicitStartTime: op.toStartTime ?? null,
        currentStartTime: moving.startTime,
        dayActivities: activities
          .filter((a) => a.dayNumber === op.toDayNumber)
          .map((a) => ({
            id: a.id,
            time_slot: a.timeSlot,
            start_time: a.startTime,
            duration_minutes: a.durationMinutes,
            sort_order: a.sortOrder,
          })),
      })
      moving.dayNumber = op.toDayNumber
      moving.timeSlot = op.toTimeSlot
      moving.startTime = placement.startTime
      moving.sortOrder = placement.sortOrder
      for (const { id, sortOrder } of placement.reorder) {
        const other = activities.find((a) => a.id === id)
        if (other) other.sortOrder = sortOrder
      }
    }
  }
  return { ...trip, activities }
}

const STATUS_RANK: Record<FeasibilityStatus, number> = { tight: 2, busy: 1, comfortable: 0, unknown: 0 }

function problemKeys(f: DayFeasibility): Set<string> {
  return new Set(
    f.issues
      .filter((i) => i.severity !== "info")
      .map((i) => `${i.kind}:${[...i.stopIds].sort().join(",")}`)
  )
}

/** Tight or busy problems on `after` that `before` did not have. */
export function newProblems(before: DayFeasibility, after: DayFeasibility): string[] {
  const had = problemKeys(before)
  return [...problemKeys(after)].filter((key) => !had.has(key))
}

/** Better = a lower status, or the same status with fewer problems. */
export function improves(before: DayFeasibility, after: DayFeasibility): boolean {
  const rankBefore = STATUS_RANK[before.status]
  const rankAfter = STATUS_RANK[after.status]
  if (rankAfter !== rankBefore) return rankAfter < rankBefore
  return problemKeys(after).size < problemKeys(before).size
}

/**
 * The safety invariant. Every day the operations touch, other than `target`,
 * must gain no tight or busy problem; `target` must improve (pace) or at least
 * gain no new problem (weather, where the improvement is fewer outdoor stops).
 */
export function verifyOperations(
  trip: ReplanTrip,
  operations: readonly ChatOperation[],
  target: number,
  rule: "improve" | "no-new-problems"
): { ok: boolean; after: ReplanTrip } {
  if (operations.length === 0 || operations.length > MAX_REPLAN_OPERATIONS) {
    return { ok: false, after: trip }
  }
  const after = applyOperationsInMemory(trip, operations)
  for (const day of trip.dayNumbers) {
    const b = analyzeTripDay(trip, day)
    const a = analyzeTripDay(after, day)
    if (day === target && rule === "improve") {
      if (!improves(b, a)) return { ok: false, after }
    } else if (newProblems(b, a).length > 0) {
      return { ok: false, after }
    }
  }
  return { ok: true, after }
}

// ---------------------------------------------------------------------------
// Operation builders
// ---------------------------------------------------------------------------

function expected(a: ReplanActivity) {
  return {
    expectedDayNumber: a.dayNumber,
    expectedTimeSlot: a.timeSlot,
    expectedStartTime: hhmm(a.startTime),
  }
}

function moveOp(a: ReplanActivity, toDayNumber: number, toTimeSlot: TimeSlot, toStartTime: string | null): ChatOperation {
  return {
    kind: "move_activity",
    activityId: a.id,
    label: a.title,
    toDayNumber,
    toTimeSlot,
    toStartTime,
    ...expected(a),
  }
}

function removeOp(a: ReplanActivity): ChatOperation {
  return { kind: "remove_activity", activityId: a.id, label: a.title, ...expected(a) }
}

/**
 * Same-day retimes that order and space a day by distance (via `planDayRoute`),
 * one move per stop whose time changes. `originals` supplies the expected state,
 * so retimes after an earlier operation in the same proposal stay checkable.
 */
function retimeOperations(trip: ReplanTrip, dayNumber: number, originals: ReplanTrip): ChatOperation[] {
  const slotted = dayStops(trip, dayNumber).filter(
    (a): a is ReplanActivity & { timeSlot: TimeSlot } => a.timeSlot !== null
  )
  const plan = planDayRoute(slotted, { start: trip.start, transport: trip.transport })
  const ops: ChatOperation[] = []
  for (const { item, startTime } of plan) {
    if (hhmm(item.startTime) === startTime) continue
    const original = originals.activities.find((a) => a.id === item.id) ?? item
    ops.push(moveOp(original, dayNumber, item.timeSlot, startTime))
  }
  return ops
}

/** Other days, lightest first: fewest stops, then least time booked, then earliest. */
function lighterDays(trip: ReplanTrip, exclude: number): number[] {
  return trip.dayNumbers
    .filter((d) => d !== exclude)
    .map((d) => {
      const f = analyzeTripDay(trip, d)
      return { d, stops: f.totals.stops, minutes: f.totals.activityMinutes + f.totals.travelMinutes }
    })
    .sort((x, y) => x.stops - y.stops || x.minutes - y.minutes || x.d - y.d)
    .map((x) => x.d)
}

/** Where `placeActivity` would put a stop moved to `dayNumber` with no time asked for. */
function placedTime(trip: ReplanTrip, a: ReplanActivity, dayNumber: number, slot: TimeSlot): string {
  return applyOperationsInMemory(trip, [moveOp(a, dayNumber, slot, null)]).activities.find(
    (x) => x.id === a.id
  )!.startTime!
}

// ---------------------------------------------------------------------------
// Optimize pace
// ---------------------------------------------------------------------------

/**
 * For a tight or busy day, in order of preference:
 *  1. reorder and re-space the day's own stops (same-day retimes);
 *  2. move one stop to the lightest other day that stays comfortable, and
 *     re-space what's left;
 *  3. as a last resort, remove one stop and re-space what's left.
 * Stops are tried latest first. A fix that only partly helps is kept only if
 * nothing does better.
 */
export function proposePaceFix(trip: ReplanTrip, dayNumber: number): ReplanResult {
  const before = analyzeTripDay(trip, dayNumber)
  const label = (s: FeasibilityStatus) => FEASIBILITY_STATUS_LABEL[s]
  if (before.status !== "tight" && before.status !== "busy") {
    return { ok: false, reply: `Day ${dayNumber} already has a comfortable pace, so there's nothing to optimize.` }
  }

  const done = (operations: ChatOperation[], after: ReplanTrip, how: string): ReplanResult => {
    const status = analyzeTripDay(after, dayNumber).status
    return {
      ok: true,
      operations,
      before: before.status,
      after: status,
      reply: `${how} Day ${dayNumber} goes from ${label(before.status)} to ${label(status)}. Review the changes below and apply them if they suit you.`,
    }
  }

  // 1. Re-space the day as it is.
  const retimes = retimeOperations(trip, dayNumber, trip)
  const spaced = verifyOperations(trip, retimes, dayNumber, "improve")
  if (spaced.ok && analyzeTripDay(spaced.after, dayNumber).status === "comfortable") {
    return done(retimes, spaced.after, `I've reordered Day ${dayNumber}'s stops by distance and spaced them so each leaves time to get to the next.`)
  }

  const latestFirst = [...sortStopsByTime(dayStops(trip, dayNumber))].reverse()

  // 2. Move one stop to the lightest other day that stays comfortable.
  for (const stop of latestFirst) {
    const slot = stop.timeSlot ?? "afternoon"
    for (const destination of lighterDays(trip, dayNumber)) {
      if (analyzeTripDay(trip, destination).status !== "comfortable") continue
      const move = moveOp(stop, destination, slot, placedTime(trip, stop, destination, slot))
      const afterMove = applyOperationsInMemory(trip, [move])
      const operations = [move, ...retimeOperations(afterMove, dayNumber, trip)]
      const check = verifyOperations(trip, operations, dayNumber, "improve")
      if (check.ok && analyzeTripDay(check.after, destination).status === "comfortable") {
        return done(operations, check.after, `I've moved "${stop.title}" to Day ${destination}, which has room for it, and re-spaced the rest of Day ${dayNumber}.`)
      }
    }
  }

  // 3. Last resort: drop one stop.
  for (const stop of latestFirst) {
    const remove = removeOp(stop)
    const afterRemove = applyOperationsInMemory(trip, [remove])
    const operations = [remove, ...retimeOperations(afterRemove, dayNumber, trip)]
    const check = verifyOperations(trip, operations, dayNumber, "improve")
    if (check.ok) {
      return done(operations, check.after, `No other day has room, so as a last resort I suggest dropping "${stop.title}" and re-spacing the rest of Day ${dayNumber}.`)
    }
  }

  if (spaced.ok) {
    return done(retimes, spaced.after, `I've reordered and re-spaced Day ${dayNumber}'s stops; it still won't be fully relaxed.`)
  }
  return {
    ok: false,
    reply: `No safe change found for Day ${dayNumber}: every option I tried either didn't help or made another day tight or busy.`,
  }
}

// ---------------------------------------------------------------------------
// Adapt for weather
// ---------------------------------------------------------------------------

const isOutdoor = (a: ReplanActivity) => a.category !== null && OUTDOOR_CATEGORIES.has(a.category)
const isIndoor = (a: ReplanActivity) => a.category !== null && INDOOR_CATEGORIES.has(a.category)

/**
 * For a day with a severe forecast: move its clearly outdoor stops to days
 * whose known forecast is not severe. A swap with a clearly indoor stop from
 * such a day (they trade slots and times) is tried on every drier day first;
 * only then a plain move, lightest day first. Ambiguous categories are never moved. Days with no known
 * forecast are never used: "better weather" has to be known, not assumed.
 */
export function proposeWeatherFix(
  trip: ReplanTrip,
  dayNumber: number,
  forecasts: Readonly<Record<number, ForecastLike | null>>
): ReplanResult {
  const target = forecasts[dayNumber] ?? null
  if (!target || !isSevereForecast(target)) {
    return { ok: false, reply: `The forecast for Day ${dayNumber} isn't severe enough to plan around.` }
  }
  const outdoor = sortStopsByTime(dayStops(trip, dayNumber)).filter(isOutdoor)
  if (outdoor.length === 0) {
    return {
      ok: false,
      reply: `Nothing on Day ${dayNumber} is clearly outdoors, so there's nothing to move. For indoor ideas, ask the trip assistant.`,
    }
  }
  const betterDays = trip.dayNumbers.filter((d) => {
    const f = forecasts[d]
    return d !== dayNumber && f && !isSevereForecast(f)
  })
  if (betterDays.length === 0) {
    return { ok: false, reply: `No other day has a forecast known to be better, so there's nowhere safe to move outdoor plans.` }
  }

  let operations: ChatOperation[] = []
  const moved: string[] = []
  const used = (id: string) => operations.some((o) => "activityId" in o && o.activityId === id)
  for (const stop of outdoor) {
    const byLightness = lighterDays(trip, dayNumber).filter((d) => betterDays.includes(d))
    // A swap keeps the wet day planned (it gains an indoor stop), so every
    // drier day is tried for a swap before any day is tried for a plain move.
    const attempts: { ops: ChatOperation[]; describe: string }[] = []
    for (const destination of byLightness) {
      const partners = sortStopsByTime(dayStops(trip, destination)).filter((p) => isIndoor(p) && !used(p.id))
      const partner = partners.find((p) => p.timeSlot === stop.timeSlot) ?? partners[0]
      if (partner && stop.timeSlot && partner.timeSlot) {
        attempts.push({
          ops: [
            moveOp(stop, destination, partner.timeSlot, hhmm(partner.startTime)),
            moveOp(partner, dayNumber, stop.timeSlot, hhmm(stop.startTime)),
          ],
          describe: `swapped "${stop.title}" with "${partner.title}" from Day ${destination}`,
        })
      }
    }
    const slot = stop.timeSlot ?? "afternoon"
    for (const destination of byLightness) {
      attempts.push({
        ops: [moveOp(stop, destination, slot, placedTime(applyOperationsInMemory(trip, operations), stop, destination, slot))],
        describe: `moved "${stop.title}" to Day ${destination}`,
      })
    }
    for (const attempt of attempts) {
      const candidate = [...operations, ...attempt.ops]
      if (verifyOperations(trip, candidate, dayNumber, "no-new-problems").ok) {
        operations = candidate
        moved.push(attempt.describe)
        break
      }
    }
  }

  if (operations.length === 0) {
    return {
      ok: false,
      reply: `No safe change found for Day ${dayNumber}: moving its outdoor plans would make another day tight or busy.`,
    }
  }
  const after = applyOperationsInMemory(trip, operations)
  const before = analyzeTripDay(trip, dayNumber).status
  const kept = outdoor.length - moved.length
  return {
    ok: true,
    operations,
    before,
    after: analyzeTripDay(after, dayNumber).status,
    reply:
      `The forecast for Day ${dayNumber} looks wet or windy, so I've ${moved.join(" and ")}.` +
      (kept > 0 ? ` ${kept} outdoor stop${kept === 1 ? "" : "s"} couldn't move without crowding another day.` : "") +
      " Review the changes below and apply them if they suit you.",
  }
}
