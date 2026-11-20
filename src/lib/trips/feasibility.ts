import { TIME_SLOTS, type TimeSlot } from "@/lib/trips/trip-domain"
import {
  SLOT_DEFAULT_START,
  SLOT_LATEST_START,
  fromMinutes,
  timeFitsSlot,
  toMinutes,
} from "@/lib/trips/activity-schedule"

/**
 * Route feasibility and ordering for one day of a trip — pure and
 * deterministic, with no routing provider behind it.
 *
 * Everything here is an estimate from straight-line distance between the
 * stops' real coordinates, stretched by a street factor, at assumed speeds. It
 * is labelled "est." wherever it is shown, and anything that can't be worked
 * out (a stop with no location, an activity with no time) is reported as
 * unknown rather than guessed.
 */

// ---------------------------------------------------------------------------
// Assumptions. Every number the rules use lives here.
// ---------------------------------------------------------------------------

/** Streets don't run straight: straight-line km x this ~ walked or driven km. */
export const STREET_FACTOR = 1.3
/** A touch under brisk pace, allowing for crossings and finding the way. */
export const WALK_KMH = 4.5
/** No leg is quicker than this, however close the stops are. */
export const MIN_LEG_MINUTES = 5
/** Street distance above which a traveller who isn't walking-only rides. */
export const MAX_WALKING_LEG_KM = 1.5

export const TRANSIT_PROFILES = {
  public: { kmh: 18, overheadMinutes: 10, label: "public transport" },
  rideshare: { kmh: 25, overheadMinutes: 5, label: "taxi" },
  car: { kmh: 25, overheadMinutes: 5, label: "car" },
} as const

/** Breathing room left between one stop ending and the next starting. */
export const CHANGEOVER_BUFFER_MINUTES = 15

/** Day-level thresholds: past these a day is "busy". */
export const LONG_WALK_KM = 12
export const LONG_DAY_MINUTES = 10 * 60
export const MAX_COMFORTABLE_STOPS = 5
/** A route this many times longer than its best order doubles back... */
export const ZIGZAG_RATIO = 1.4
/** ...and by at least this much, so a few hundred metres never trips it. */
export const ZIGZAG_MIN_EXTRA_KM = 1

// ---------------------------------------------------------------------------
// Distance and legs
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number
  lng: number
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(s))
}

/** Minutes to walk a street distance. */
export function walkMinutesFor(streetKm: number): number {
  return Math.max(MIN_LEG_MINUTES, Math.round((streetKm / WALK_KMH) * 60))
}

export type LegMode = "walk" | keyof typeof TRANSIT_PROFILES

export interface Leg {
  /** Estimated street distance, 1 dp. */
  km: number
  minutes: number
  mode: LegMode
}

/** The trip's "getting around" preference, as a riding mode for long legs. */
function ridingMode(transport: string | null | undefined): LegMode {
  switch (transport) {
    case "walk":
      return "walk"
    case "rideshare":
      return "rideshare"
    case "car":
      return "car"
    default:
      // "public", "mixed", or unknown.
      return "public"
  }
}

export function estimateLeg(from: GeoPoint, to: GeoPoint, transport?: string | null): Leg {
  const streetKm = haversineKm(from, to) * STREET_FACTOR
  const km = Math.round(streetKm * 10) / 10
  const riding = ridingMode(transport)
  if (riding === "walk" || streetKm <= MAX_WALKING_LEG_KM) {
    return { km, minutes: walkMinutesFor(streetKm), mode: "walk" }
  }
  const profile = TRANSIT_PROFILES[riding]
  const minutes = Math.round(profile.overheadMinutes + (streetKm / profile.kmh) * 60)
  return { km, minutes: Math.max(MIN_LEG_MINUTES, minutes), mode: riding }
}

export function legModeLabel(mode: LegMode): string {
  return mode === "walk" ? "on foot" : `by ${TRANSIT_PROFILES[mode].label}`
}

function pointOf(stop: { lat: number | null; lng: number | null }): GeoPoint | null {
  return typeof stop.lat === "number" &&
    typeof stop.lng === "number" &&
    Number.isFinite(stop.lat) &&
    Number.isFinite(stop.lng)
    ? { lat: stop.lat, lng: stop.lng }
    : null
}

/** Street km along a path, from `start` (if any) through every point. */
export function pathKm(points: readonly GeoPoint[], start: GeoPoint | null = null): number {
  let total = 0
  let previous = start
  for (const point of points) {
    if (previous) total += haversineKm(previous, point) * STREET_FACTOR
    previous = point
  }
  return total
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/** Up to this many located stops, every order is tried and the best kept. */
export const EXACT_ORDERING_MAX_STOPS = 7

/**
 * Orders stops to cut travel. Up to `EXACT_ORDERING_MAX_STOPS` it tries every
 * order (at most 5,040) and keeps the shortest; beyond that, nearest-next from
 * `start` then 2-opt swaps until nothing improves (a heuristic: close, not
 * always best). Deterministic: ties keep input order. Without a start point the
 * first located stop stays first. Stops with no location keep their relative
 * order, after the located ones.
 */
export function orderByProximity<T extends { lat: number | null; lng: number | null }>(
  stops: readonly T[],
  start: GeoPoint | null
): T[] {
  const located = stops.filter((s) => pointOf(s))
  const unlocated = stops.filter((s) => !pointOf(s))
  if (located.length <= 1) return [...located, ...unlocated]
  if (located.length <= EXACT_ORDERING_MAX_STOPS) {
    return [...exactOrder(located, start), ...unlocated]
  }

  // Nearest neighbour.
  const remaining = [...located]
  const path: T[] = []
  let anchor = start
  if (!anchor) {
    const first = remaining.shift()!
    path.push(first)
    anchor = pointOf(first)
  }
  while (remaining.length > 0) {
    let best = 0
    let bestKm = Infinity
    remaining.forEach((stop, index) => {
      const km = haversineKm(anchor!, pointOf(stop)!)
      if (km < bestKm) {
        bestKm = km
        best = index
      }
    })
    const [next] = remaining.splice(best, 1)
    path.push(next!)
    anchor = pointOf(next!)
  }

  // 2-opt on an open path. When there's no start point the first stop is the
  // anchor and never moves.
  const fixed = start ? 0 : 1
  const pts = () => [start, ...path.map((s) => pointOf(s)!)]
  const d = (a: GeoPoint | null, b: GeoPoint | null) => (a && b ? haversineKm(a, b) : 0)
  let improved = true
  let guard = 0
  while (improved && guard < 100) {
    improved = false
    guard += 1
    for (let i = fixed; i < path.length - 1; i += 1) {
      for (let k = i + 1; k < path.length; k += 1) {
        const p = pts()
        // p is offset by one: p[0] is the start (or null), p[i + 1] is path[i].
        const before = d(p[i]!, p[i + 1]!) + d(p[k + 1]!, p[k + 2] ?? null)
        const after = d(p[i]!, p[k + 1]!) + d(p[i + 1]!, p[k + 2] ?? null)
        if (after < before - 1e-9) {
          const reversed = path.slice(i, k + 1).reverse()
          path.splice(i, k - i + 1, ...reversed)
          improved = true
        }
      }
    }
  }
  return [...path, ...unlocated]
}

/** Shortest open path through every stop, by exhaustive search with pruning. */
function exactOrder<T extends { lat: number | null; lng: number | null }>(
  stops: readonly T[],
  start: GeoPoint | null
): T[] {
  const points = stops.map((s) => pointOf(s)!)
  const fixedFirst = start ? null : 0
  let bestKm = Infinity
  let best: number[] = stops.map((_, i) => i)
  const used = new Array<boolean>(stops.length).fill(false)
  const path: number[] = []

  const visit = (from: GeoPoint | null, km: number) => {
    // Strictly shorter only, so the first-found (input-order) path wins ties.
    if (km >= bestKm - 1e-9) return
    if (path.length === stops.length) {
      bestKm = km
      best = [...path]
      return
    }
    for (let i = 0; i < stops.length; i += 1) {
      if (used[i]) continue
      if (path.length === 0 && fixedFirst !== null && i !== fixedFirst) continue
      used[i] = true
      path.push(i)
      visit(points[i]!, km + (from ? haversineKm(from, points[i]!) : 0))
      path.pop()
      used[i] = false
    }
  }
  visit(start, 0)
  return best.map((i) => stops[i]!)
}

function slotRank(slot: string | null): number {
  const index = TIME_SLOTS.indexOf(slot as TimeSlot)
  return index === -1 ? TIME_SLOTS.length : index
}

/**
 * Keeps each stop in its slot and the slots in order, and orders stops within
 * a slot by proximity, carrying on from where the previous slot ended.
 */
export function orderWithinSlots<T extends { lat: number | null; lng: number | null }>(
  stops: readonly T[],
  slotOf: (stop: T) => string | null,
  start: GeoPoint | null
): T[] {
  const groups = new Map<number, T[]>()
  for (const stop of stops) {
    const rank = slotRank(slotOf(stop))
    groups.set(rank, [...(groups.get(rank) ?? []), stop])
  }
  const ordered: T[] = []
  let from = start
  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    const group = orderByProximity(groups.get(rank)!, from)
    ordered.push(...group)
    const lastLocated = [...group].reverse().map(pointOf).find(Boolean)
    if (lastLocated) from = lastLocated
  }
  return ordered
}

// ---------------------------------------------------------------------------
// Planning a generated day: reorder, then re-time
// ---------------------------------------------------------------------------

export interface PlanInput {
  timeSlot: TimeSlot
  startTime: string | null
  durationMinutes: number | null
  lat: number | null
  lng: number | null
}

export interface PlannedStop<T> {
  item: T
  /** `HH:MM` inside the stop's slot. */
  startTime: string
  /** Travel from the previous stop (or the start point); null if unknown. */
  leg: Leg | null
}

/**
 * Orders a freshly generated day's activities within their slots and re-times
 * them so each leaves room to get to the next.
 *
 * Reordering moves stops, not the plan's shape: a slot's original times (those
 * inside the slot, earliest first) stay attached to its positions, so a
 * morning the model started at 09:00 still starts at 09:00. Each stop then
 * starts at its position's time, or once the previous stop has ended plus
 * travel and a buffer if that's later, rounded up to 5 minutes and capped at
 * the slot's latest start. A day that still doesn't fit keeps the cap, and
 * `analyzeDay` reports it rather than this hiding it.
 */
export function planDayRoute<T extends PlanInput>(
  items: readonly T[],
  options: { start: GeoPoint | null; transport?: string | null }
): PlannedStop<T>[] {
  const ordered = orderWithinSlots(items, (item) => item.timeSlot, options.start)

  // Each slot's usable original times, earliest first, handed out by position.
  const anchors = new Map<TimeSlot, number[]>()
  for (const item of items) {
    if (!timeFitsSlot(item.startTime, item.timeSlot)) continue
    anchors.set(item.timeSlot, [...(anchors.get(item.timeSlot) ?? []), toMinutes(item.startTime)!])
  }
  for (const list of anchors.values()) list.sort((a, b) => a - b)
  const positionInSlot = new Map<TimeSlot, number>()

  const planned: PlannedStop<T>[] = []
  let previousPoint = options.start
  let previousEnd: number | null = null

  for (const item of ordered) {
    const point = pointOf(item)
    const leg = previousPoint && point ? estimateLeg(previousPoint, point, options.transport) : null
    const position = positionInSlot.get(item.timeSlot) ?? 0
    positionInSlot.set(item.timeSlot, position + 1)
    const own = anchors.get(item.timeSlot)?.[position] ?? toMinutes(SLOT_DEFAULT_START[item.timeSlot])!
    let start = own
    if (previousEnd !== null) {
      const earliest =
        Math.ceil((previousEnd + (leg?.minutes ?? 0) + CHANGEOVER_BUFFER_MINUTES) / 5) * 5
      start = Math.min(Math.max(own, earliest), Math.max(own, toMinutes(SLOT_LATEST_START[item.timeSlot])!))
    }
    planned.push({ item, startTime: fromMinutes(start), leg })
    previousEnd = start + Math.max(0, item.durationMinutes ?? 0)
    if (point) previousPoint = point
  }
  return planned
}

// ---------------------------------------------------------------------------
// Analysing a stored day
// ---------------------------------------------------------------------------

export interface RouteStop {
  id: string
  title: string
  timeSlot: string | null
  startTime: string | null
  durationMinutes: number | null
  lat: number | null
  lng: number | null
  sortOrder: number
}

/** Stops in the order the day is lived: slot, then time, then list position. */
export function sortStopsByTime<T extends Pick<RouteStop, "timeSlot" | "startTime" | "sortOrder">>(
  stops: readonly T[]
): T[] {
  return [...stops].sort((a, b) => {
    const bySlot = slotRank(a.timeSlot) - slotRank(b.timeSlot)
    if (bySlot !== 0) return bySlot
    const ta = toMinutes(a.startTime)
    const tb = toMinutes(b.startTime)
    if (ta !== null && tb !== null && ta !== tb) return ta - tb
    if (ta === null && tb !== null) return 1
    if (tb === null && ta !== null) return -1
    return a.sortOrder - b.sortOrder
  })
}

/**
 * The leg into each stop, in the given order. The first stop's leg is from
 * `start` (null without one); a stop with no location has a null leg, and the
 * next leg is measured from the last stop that had one.
 */
export function legsInOrder<T extends { lat: number | null; lng: number | null }>(
  stops: readonly T[],
  start: GeoPoint | null,
  transport?: string | null
): (Leg | null)[] {
  let previous = start
  return stops.map((stop) => {
    const point = pointOf(stop)
    const leg = previous && point ? estimateLeg(previous, point, transport) : null
    if (point) previous = point
    return leg
  })
}

export type FeasibilityStatus = "comfortable" | "busy" | "tight" | "unknown"

export type FeasibilityIssueKind =
  | "overlap"
  | "tight-gap"
  | "long-walk"
  | "long-day"
  | "too-many-stops"
  | "zigzag"
  | "missing-location"
  | "missing-time"

export interface FeasibilityIssue {
  kind: FeasibilityIssueKind
  /** "tight" and "busy" set the day's status; "info" never does. */
  severity: "tight" | "busy" | "info"
  message: string
  stopIds: string[]
}

export interface DayFeasibility {
  status: FeasibilityStatus
  /** Leg into each stop, by stop id. */
  legs: Record<string, Leg | null>
  totals: {
    stops: number
    walkingKm: number
    ridingKm: number
    travelMinutes: number
    activityMinutes: number
  }
  issues: FeasibilityIssue[]
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * How workable one day is. Checks, in time order from `start` (the stay):
 * a stop starting before the previous ends (tight), a gap shorter than the
 * estimated travel (tight), and, for the day as a whole, too far on foot, too
 * long, too many stops, or a route that doubles back (busy). Missing locations
 * and times are reported as info and never guessed.
 */
export function analyzeDay(
  stops: readonly RouteStop[],
  options: { start: GeoPoint | null; transport?: string | null }
): DayFeasibility {
  const ordered = sortStopsByTime(stops)
  const legs = legsInOrder(ordered, options.start, options.transport)
  const issues: FeasibilityIssue[] = []

  const legById: Record<string, Leg | null> = {}
  let walkingKm = 0
  let ridingKm = 0
  let travelMinutes = 0
  let activityMinutes = 0
  ordered.forEach((stop, index) => {
    const leg = legs[index] ?? null
    legById[stop.id] = leg
    if (leg) {
      if (leg.mode === "walk") walkingKm += leg.km
      else ridingKm += leg.km
      travelMinutes += leg.minutes
    }
    activityMinutes += Math.max(0, stop.durationMinutes ?? 0)
    if (!pointOf(stop)) {
      issues.push({
        kind: "missing-location",
        severity: "info",
        message: `"${stop.title}" has no location, so travel to and from it isn't estimated.`,
        stopIds: [stop.id],
      })
    }
    if (toMinutes(stop.startTime) === null) {
      issues.push({
        kind: "missing-time",
        severity: "info",
        message: `"${stop.title}" has no start time, so its timing isn't checked.`,
        stopIds: [stop.id],
      })
    }
  })

  // Back-to-back checks between consecutive timed stops.
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1]!
    const next = ordered[i]!
    const prevStart = toMinutes(prev.startTime)
    const nextStart = toMinutes(next.startTime)
    if (prevStart === null || nextStart === null || prev.durationMinutes === null) continue
    const prevEnd = prevStart + Math.max(0, prev.durationMinutes)
    const gap = nextStart - prevEnd
    if (gap < 0) {
      issues.push({
        kind: "overlap",
        severity: "tight",
        message: `"${next.title}" starts at ${fromMinutes(nextStart)}, before "${prev.title}" ends (${fromMinutes(prevEnd)}).`,
        stopIds: [prev.id, next.id],
      })
      continue
    }
    const leg = legs[i]
    // Only a leg actually between these two stops says anything about the gap.
    if (leg && pointOf(prev) && gap < leg.minutes) {
      issues.push({
        kind: "tight-gap",
        severity: "tight",
        message: `Only ${formatMinutes(gap)} between "${prev.title}" and "${next.title}", but getting there takes about ${formatMinutes(leg.minutes)} ${legModeLabel(leg.mode)}.`,
        stopIds: [prev.id, next.id],
      })
    }
  }

  if (walkingKm > LONG_WALK_KM) {
    issues.push({
      kind: "long-walk",
      severity: "busy",
      message: `About ${round1(walkingKm)} km on foot between stops, a lot for one day.`,
      stopIds: [],
    })
  }
  if (activityMinutes + travelMinutes > LONG_DAY_MINUTES) {
    issues.push({
      kind: "long-day",
      severity: "busy",
      message: `About ${formatMinutes(activityMinutes + travelMinutes)} of activities and travel.`,
      stopIds: [],
    })
  }
  if (ordered.length > MAX_COMFORTABLE_STOPS) {
    issues.push({
      kind: "too-many-stops",
      severity: "busy",
      message: `${ordered.length} stops, more than a comfortable day holds.`,
      stopIds: [],
    })
  }

  // Doubling back: compare against the best order that keeps every slot.
  const located = ordered.filter((s) => pointOf(s))
  if (located.length >= 3) {
    const actual = pathKm(located.map((s) => pointOf(s)!), options.start)
    const best = pathKm(
      orderWithinSlots(located, (s) => s.timeSlot, options.start).map((s) => pointOf(s)!),
      options.start
    )
    if (actual >= best * ZIGZAG_RATIO && actual - best >= ZIGZAG_MIN_EXTRA_KM) {
      issues.push({
        kind: "zigzag",
        severity: "busy",
        message: `The route doubles back: about ${round1(actual)} km between stops, where a different order would be about ${round1(best)} km.`,
        stopIds: [],
      })
    }
  }

  const hasTight = issues.some((i) => i.severity === "tight")
  const hasBusy = issues.some((i) => i.severity === "busy")
  const anythingChecked =
    Object.values(legById).some(Boolean) ||
    ordered.filter((s) => toMinutes(s.startTime) !== null).length >= 2
  const status: FeasibilityStatus = hasTight
    ? "tight"
    : hasBusy
      ? "busy"
      : ordered.length > 0 && !anythingChecked
        ? "unknown"
        : "comfortable"

  return {
    status,
    legs: legById,
    totals: {
      stops: ordered.length,
      walkingKm: round1(walkingKm),
      ridingKm: round1(ridingKm),
      travelMinutes,
      activityMinutes,
    },
    issues,
  }
}

// ---------------------------------------------------------------------------
// Keeping stored legs current after an edit
// ---------------------------------------------------------------------------

export interface StoredLegRow extends RouteStop {
  travel_time_minutes: number | null
  walking_distance_km: number | string | null
}

/**
 * Which stored legs (`travel_time_minutes`, `walking_distance_km`) differ from
 * what the day's current order and locations give. Without a start point the
 * first stop's stored leg is left alone (it was measured at generation from a
 * point not stored on the trip); a stop with no location is set to null.
 */
export function legUpdates(
  stops: readonly StoredLegRow[],
  options: { start: GeoPoint | null; transport?: string | null }
): { id: string; travelTimeMinutes: number | null; walkingDistanceKm: number | null }[] {
  const ordered = sortStopsByTime(stops)
  const legs = legsInOrder(ordered, options.start, options.transport)
  const updates: { id: string; travelTimeMinutes: number | null; walkingDistanceKm: number | null }[] = []
  ordered.forEach((stop, index) => {
    if (index === 0 && !options.start && pointOf(stop)) return
    const leg = legs[index] ?? null
    const minutes = leg ? leg.minutes : null
    const km = leg ? leg.km : null
    const storedKm = stop.walking_distance_km === null ? null : Number(stop.walking_distance_km)
    if (stop.travel_time_minutes !== minutes || storedKm !== km) {
      updates.push({ id: stop.id, travelTimeMinutes: minutes, walkingDistanceKm: km })
    }
  })
  return updates
}

/** Where a day starts: the primary real stay, if it has a location. */
export function tripStartPoint(
  hotels: readonly { lat: number | null; lng: number | null; is_primary?: boolean | null; source?: string | null }[]
): GeoPoint | null {
  const real = hotels.filter((h) => h.source !== "mock")
  const primary = real.find((h) => h.is_primary) ?? real[0]
  return primary ? pointOf(primary) : null
}

// ---------------------------------------------------------------------------
// Wording for the trip page (kept here so it is tested with the rules)
// ---------------------------------------------------------------------------

export const FEASIBILITY_STATUS_LABEL: Record<FeasibilityStatus, string> = {
  comfortable: "Comfortable pace",
  busy: "Busy day",
  tight: "Tight timing",
  unknown: "Pace not checked",
}

/** "est. 1.2 km · ~16 min on foot" */
export function legText(leg: Leg): string {
  return `est. ${leg.km} km · ~${formatMinutes(leg.minutes)} ${legModeLabel(leg.mode)}`
}

/** "est. 4.2 km on foot · est. 3.1 km riding · ~1 h 10 min getting around", or null. */
export function dayTotalsText(feasibility: DayFeasibility): string | null {
  const { walkingKm, ridingKm, travelMinutes } = feasibility.totals
  const parts: string[] = []
  if (walkingKm > 0) parts.push(`est. ${walkingKm} km on foot`)
  if (ridingKm > 0) parts.push(`est. ${ridingKm} km riding`)
  if (travelMinutes > 0) parts.push(`~${formatMinutes(travelMinutes)} getting around`)
  return parts.length > 0 ? parts.join(" · ") : null
}
