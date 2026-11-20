import type { CreateTripInput } from "@/features/trips/schemas/trip.schemas"

/**
 * When a trip stuck at `generating` stops counting as "still generating".
 *
 * A trip is set to `generating` before the model is called, and only the same
 * request sets it back (`ready` on success, `draft` on a caught failure). If
 * that request is killed instead — the platform's 150 s `maxDuration` on
 * `/trips/new` and `/trips/[id]`, a crash, a deploy — nothing ever resets it,
 * and archive, duplicate and delete all refuse a generating trip. So a
 * `generating` row whose last update is older than any request could still be
 * running is treated as a failed generation: recoverable as a `draft`.
 *
 * `trips.updated_at` is maintained by a trigger on every update, and nothing
 * else updates a trip while it generates, so it marks when generation began.
 */

/** Must match `export const maxDuration` on the pages that generate. */
export const GENERATION_MAX_DURATION_MS = 150_000

/** Twice the platform limit: no live request can still own the row by then. */
export const STALE_GENERATION_AFTER_MS = GENERATION_MAX_DURATION_MS * 2

/** Rows last updated before this instant are stale if still `generating`. */
export function staleGenerationCutoff(now: number): string {
  return new Date(now - STALE_GENERATION_AFTER_MS).toISOString()
}

export function isStaleGeneration(
  status: string,
  updatedAt: string | null | undefined,
  now: number
): boolean {
  if (status !== "generating") return false
  // No timestamp to judge by: recoverable rather than bricked forever.
  if (!updatedAt) return true
  const updated = Date.parse(updatedAt)
  if (Number.isNaN(updated)) return true
  return now - updated >= STALE_GENERATION_AFTER_MS
}

/** The status to show and act on: a stale `generating` trip is a `draft`. */
export function effectiveTripStatus(
  status: string,
  updatedAt: string | null | undefined,
  now: number
): string {
  return isStaleGeneration(status, updatedAt, now) ? "draft" : status
}

/** Only a draft (including a recovered stale generation) can be (re)generated. */
export function regenerateBlockedReason(effectiveStatus: string): string | null {
  switch (effectiveStatus) {
    case "draft":
      return null
    case "generating":
      return "This trip is still being generated. Try again in a moment."
    case "archived":
      return "Restore this trip before generating its itinerary."
    default:
      return "This trip already has an itinerary."
  }
}

/** The stored trip fields generation needs, as `trips` returns them. */
export interface TripGenerationRow {
  destination: string
  starting_city: string | null
  start_date: string | null
  end_date: string | null
  travelers: number
  budget: number | string | null
  currency: string
  travel_style: string | null
  interests: string[] | null
  accommodation: string | null
  transportation: string | null
  additional_notes: string | null
}

/**
 * A stored trip as wizard input, so regeneration is validated by exactly the
 * same schema as creation. Missing values become ones the schema rejects
 * (rather than defaults it accepts), so a malformed row is refused, not guessed.
 */
export function tripRowToCreateInput(row: TripGenerationRow): Record<keyof CreateTripInput, unknown> {
  const budget = row.budget === null || row.budget === "" ? null : Number(row.budget)
  return {
    destination: row.destination,
    startingCity: row.starting_city ?? "",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    travelers: row.travelers,
    budget,
    currency: row.currency,
    travelStyle: row.travel_style ?? "",
    interests: row.interests ?? [],
    accommodation: row.accommodation ?? "",
    transportation: row.transportation ?? "",
    notes: row.additional_notes ?? "",
  }
}
