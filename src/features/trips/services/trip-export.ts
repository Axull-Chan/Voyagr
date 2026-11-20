import type { TripDetail } from "@/features/trips/queries/trip-detail"
import { restaurantHoursForExport } from "@/features/trips/services/restaurant-hours"

/**
 * The portable, human-readable form of a trip.
 *
 * This is a deliberate *shape*, not a dump of table rows. Database ids, foreign
 * keys and the owner's user id mean nothing outside this database — and
 * `user_id` is an account identifier the file has no reason to carry around —
 * so they are dropped, and children are nested under what they belong to.
 * `version` is there so a future importer (or a changed shape) can tell which
 * file it is looking at.
 *
 * Provenance travels with the data. Weather and hotel rows record whether they
 * came from a real provider or an example, and that is kept: an exported file
 * with the label stripped would read as fact once it left the app.
 */

export const TRIP_EXPORT_FORMAT = "voyagr-trip"
export const TRIP_EXPORT_VERSION = 1

type Row = Record<string, unknown>

/** Copies a row without the listed keys. */
function omit<T extends Row>(row: T, keys: readonly string[]): Row {
  const copy: Row = { ...row }
  for (const key of keys) delete copy[key]
  return copy
}

const CHILD_KEYS = ["id", "trip_id", "trip_day_id", "created_at"] as const

export function buildTripExport(detail: TripDetail, exportedAt = new Date()) {
  const { trip, days, hotels, transportation, budget, expenses, packing } =
    detail

  return {
    format: TRIP_EXPORT_FORMAT,
    version: TRIP_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    trip: omit(trip, ["id", "user_id", "created_at", "updated_at"]),
    days: days.map((day) => ({
      dayNumber: day.dayNumber,
      date: day.date,
      summary: day.summary,
      dailyCost: day.dailyCost,
      weather: day.weather ? omit(day.weather, CHILD_KEYS) : null,
      activities: day.activities.map((a) => omit(a, CHILD_KEYS)),
      // Guessed meal-window hours are dropped, so a file can't state them as fact.
      restaurants: day.restaurants.map((r) => ({
        ...omit(r, CHILD_KEYS),
        opening_hours: restaurantHoursForExport(r.opening_hours),
      })),
    })),
    hotels: hotels.map((h) => omit(h, CHILD_KEYS)),
    transportation: transportation.map((t) => omit(t, CHILD_KEYS)),
    budget: budget.map((b) => omit(b, CHILD_KEYS)),
    expenses: expenses.map((e) => omit(e, CHILD_KEYS)),
    packing: packing.map((p) => omit(p, CHILD_KEYS)),
  }
}

/**
 * A safe download filename for a trip title.
 *
 * Titles are user-controlled free text, so this is a whitelist rather than an
 * escape: anything outside letters, digits and single hyphens is dropped, which
 * rules out path separators, quotes and header-injection characters in one
 * move. `normalize("NFKD")` first so "Lisboa — São Paulo" becomes "sao-paulo"
 * rather than losing the accented letters.
 */
function filenameSlug(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || "trip"
}

export function exportFilename(title: string): string {
  return `${filenameSlug(title)}.voyagr.json`
}

/** Same whitelist slug as the JSON export, so the PDF can't be steered by a title either. */
export function pdfFilename(title: string): string {
  return `${filenameSlug(title)}.pdf`
}
