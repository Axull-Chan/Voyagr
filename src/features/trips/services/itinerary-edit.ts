import type { TablesInsert } from "@/types/database.types"
import { MAX_TRIP_DAYS, TIME_SLOTS, addDays, tripDurationDays } from "@/lib/trips/trip-domain"

/**
 * The pure rules behind manual itinerary editing: ordering, day totals, building a
 * blank trip's days. No I/O, so every decision that matters is unit-tested without
 * a database. The server actions in `actions/itinerary.actions.ts` do the reading
 * and writing; this file only decides.
 */

// ---------------------------------------------------------------------------
// Who may edit, and when
// ---------------------------------------------------------------------------

/**
 * Why an itinerary can't be edited right now, or null when it can. A trip that is
 * still `generating` is about to have its days rewritten by the generator (it clears
 * and re-inserts them), so an edit made now would be silently lost; an archived trip
 * is one the traveller put away on purpose.
 */
export function editBlockedReason(status: string): string | null {
  if (status === "generating") {
    return "Your itinerary is still being built — try again in a moment."
  }
  if (status === "archived") {
    return "Restore this trip before editing its itinerary."
  }
  return null
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

export type MoveDirection = "up" | "down"

export interface OrderedActivity {
  id: string
  time_slot: string | null
  sort_order: number
  created_at: string
}

/**
 * The one ordering of a day's activities, used by the page and by the reorder rule
 * so they can never disagree. `sort_order` alone is not enough: generation numbers
 * activities 0..n and a later add uses max+1, but two rows can still share a value
 * (an interrupted reorder, or rows written before this existed), and the database
 * returns ties in no defined order — which would make an activity jump about between
 * page loads. Ties fall back to when the row was created, then to its id.
 */
export function orderActivities<T extends OrderedActivity>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  )
}

const KNOWN_SLOTS = new Set<string>(TIME_SLOTS)

/** Activities are shown grouped by time of day; anything unrecognised is its own group. */
function slotKey(slot: string | null): string {
  return slot !== null && KNOWN_SLOTS.has(slot) ? slot : "unscheduled"
}

export interface SortOrderUpdate {
  id: string
  sortOrder: number
}

/**
 * Moves one activity a step earlier or later among the activities in the SAME time
 * of day, which is how the timeline displays them. Returns the `sort_order` values
 * that have to change, or null when there is nothing to do (unknown id, already
 * first or last in its group).
 *
 * The whole day is renumbered 0..n from its current order and the two neighbours
 * swap places, rather than just exchanging two stored numbers. Exchanging is wrong
 * when the two share a value, and leaves gaps and duplicates behind; renumbering
 * always converges on a clean sequence. Only rows whose number actually changes are
 * returned, so a tidy day costs two writes, not n.
 */
export function reorderWithinSlot(
  items: readonly OrderedActivity[],
  activityId: string,
  direction: MoveDirection
): SortOrderUpdate[] | null {
  const ordered = orderActivities(items)
  const target = ordered.find((a) => a.id === activityId)
  if (!target) return null

  const key = slotKey(target.time_slot)
  const group = ordered.filter((a) => slotKey(a.time_slot) === key)
  const at = group.findIndex((a) => a.id === activityId)
  const neighbour = group[direction === "up" ? at - 1 : at + 1]
  if (!neighbour) return null

  const from = ordered.findIndex((a) => a.id === activityId)
  const to = ordered.findIndex((a) => a.id === neighbour.id)
  const next = [...ordered]
  ;[next[from], next[to]] = [next[to]!, next[from]!]

  const current = new Map(items.map((a) => [a.id, a.sort_order]))
  const updates: SortOrderUpdate[] = []
  next.forEach((activity, index) => {
    if (current.get(activity.id) !== index) {
      updates.push({ id: activity.id, sortOrder: index })
    }
  })
  return updates
}

// ---------------------------------------------------------------------------
// Day cost
// ---------------------------------------------------------------------------

/**
 * A day's total from its activities' own costs, rounded to cents. This is exactly
 * how the generator computed `trip_days.daily_cost` in the first place (the sum of
 * the day's activity estimates), so recomputing after an edit keeps the number
 * meaning the same thing rather than leaving the old total behind. Costs are
 * `numeric` in Postgres and can arrive as strings.
 */
export function dayCostFrom(costs: readonly (number | string | null)[]): number {
  const total = costs.reduce<number>((sum, cost) => {
    const value = Number(cost)
    return Number.isFinite(value) && value > 0 ? sum + value : sum
  }, 0)
  return Math.round(total * 100) / 100
}

// ---------------------------------------------------------------------------
// A blank itinerary
// ---------------------------------------------------------------------------

export interface BlankDay {
  dayNumber: number
  date: string
}

/**
 * One day per calendar date, first to last inclusive — the same days the generator
 * would have created, just empty. Returns [] for dates that are missing, reversed or
 * span more than a trip is allowed to, so the caller reports one clear error rather
 * than creating a partial trip.
 */
export function buildBlankDays(
  startDate: string | null,
  endDate: string | null
): BlankDay[] {
  if (!startDate || !endDate) return []
  const count = tripDurationDays(startDate, endDate)
  if (count < 1 || count > MAX_TRIP_DAYS) return []
  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    date: addDays(startDate, index),
  }))
}

/** The placeholder condition for a day with no forecast. Matches what the AI providers store. */
export const FORECAST_UNAVAILABLE = "Forecast not yet available"

export interface ForecastDay {
  condition: string
  tempHighC: number | null
  tempLowC: number | null
  precipitationChance: number | null
  windKph: number | null
  humidity: number | null
  sunrise: string | null
  sunset: string | null
}

/**
 * One weather row per day. A date Open-Meteo returned gets its real reading
 * (`source: "open-meteo"`); every other date gets the plain "not yet available" row
 * (`source: "unavailable"`) with no numbers — never a typical-climate guess, because
 * nothing here has a climate catalogue to draw one from. Those two `source` values
 * are what the trip page uses to label a day honestly.
 */
export function weatherRowsForDays(
  days: readonly { id: string; date: string | null }[],
  byDate: Readonly<Record<string, ForecastDay>>
): TablesInsert<"weather">[] {
  return days.map((day) => {
    const real = day.date ? byDate[day.date] : undefined
    if (real) {
      return {
        trip_day_id: day.id,
        condition: real.condition,
        temp_high_c: real.tempHighC,
        temp_low_c: real.tempLowC,
        precipitation_chance: real.precipitationChance,
        wind_kph: real.windKph,
        humidity: real.humidity,
        sunrise: real.sunrise,
        sunset: real.sunset,
        source: "open-meteo",
      }
    }
    return {
      trip_day_id: day.id,
      condition: FORECAST_UNAVAILABLE,
      temp_high_c: null,
      temp_low_c: null,
      precipitation_chance: null,
      wind_kph: null,
      humidity: null,
      sunrise: null,
      sunset: null,
      source: "unavailable",
    }
  })
}
