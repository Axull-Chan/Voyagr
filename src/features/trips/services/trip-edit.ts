import { addDays, tripDurationDays } from "@/lib/trips/trip-domain"

/**
 * The rules for changing a trip's dates and budget, kept pure so the dialogs,
 * the server actions and tests all read from one place.
 *
 * The date rules mirror `shift_trip_dates` (migration
 * 20261121090000_add_shift_trip_dates.sql), which is authoritative: the same
 * checks in the same order with the same wording, so the dialog can refuse
 * early and a direct database call can't do what the app would refuse.
 */

/** A new start may be at most this many days before today (time zones). */
export const MAX_DAYS_IN_PAST = 1
/** ...and at most this many years after today. */
export const MAX_YEARS_AHEAD = 2
/** Same ceiling as the creation wizard. */
export const MAX_BUDGET = 10_000_000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Today as `YYYY-MM-DD` in UTC, the same calendar the database's `current_date` uses. */
export function isoToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * `date` plus whole years, clamping 29 Feb to 28 Feb the way Postgres's
 * `date + interval 'N years'` does.
 */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y + years, m - 1, d))
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0)
  return target.toISOString().slice(0, 10)
}

export interface DatedTrip {
  status: string
  startDate: string | null
  endDate: string | null
}

/** Why a trip can't move to `newStart`, or null when it can. */
export function dateShiftBlockedReason(
  trip: DatedTrip,
  newStart: string | null,
  today: string
): string | null {
  if (trip.status === "generating") return "This trip is still being generated. Try again in a moment."
  if (!trip.startDate || !trip.endDate) return "This trip has no dates to change."
  if (!newStart || !ISO_DATE.test(newStart) || Number.isNaN(Date.parse(`${newStart}T00:00:00Z`))) {
    return "Choose a new start date."
  }
  if (newStart === trip.startDate) return "The trip already starts on that date."
  if (newStart < addDays(today, -MAX_DAYS_IN_PAST)) return "The new start date is in the past."
  if (newStart > addYears(today, MAX_YEARS_AHEAD)) return "Trips can start at most two years ahead."
  return null
}

export interface DateShiftPreview {
  startDate: string
  endDate: string
  /** Unchanged by a shift. */
  days: number
  /** Positive moves later, negative earlier. */
  offsetDays: number
}

/** Where the trip would land: same length, every date moved by the same offset. */
export function previewDateShift(startDate: string, endDate: string, newStart: string): DateShiftPreview {
  const days = tripDurationDays(startDate, endDate)
  const offsetDays = Math.round(
    (Date.parse(`${newStart}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000
  )
  return { startDate: newStart, endDate: addDays(newStart, Math.max(days, 1) - 1), days, offsetDays }
}

/** Why a trip's budget can't be edited right now, or null when it can. */
export function budgetEditBlockedReason(status: string): string | null {
  return status === "generating" ? "This trip is still being generated. Try again in a moment." : null
}

export type BudgetInput = { ok: true; budget: number | null } | { ok: false; error: string }

/**
 * The budget field's text as a value. Empty means "no budget" (as in the
 * wizard); otherwise a number above 0 and at most MAX_BUDGET, with up to two
 * decimals. Thousands separators and spaces are tolerated.
 */
export function parseBudgetInput(text: string): BudgetInput {
  const cleaned = text.replace(/[\s,]/g, "")
  if (cleaned === "") return { ok: true, budget: null }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, error: "Enter an amount, like 1500 or 1500.50." }
  const budget = Number(cleaned)
  if (!(budget > 0)) return { ok: false, error: "A budget has to be more than 0. Leave it empty for no budget." }
  if (budget > MAX_BUDGET) return { ok: false, error: "That budget is unrealistically large." }
  return { ok: true, budget }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Mon 1 Dec 2026" — formatted by hand so server, browser and tests agree (no ICU variance). */
function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** "Mon 1 Dec 2026 – Wed 3 Dec 2026 · 3 days, same length" */
export function describeShiftPreview(preview: DateShiftPreview): string {
  const length = `${preview.days} day${preview.days === 1 ? "" : "s"}`
  return `${formatDay(preview.startDate)} – ${formatDay(preview.endDate)} · ${length}, same length`
}
