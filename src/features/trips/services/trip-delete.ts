/**
 * The rules and wording for deleting a trip, kept pure so both the server
 * action and the confirmation dialog read from one place and tests can pin
 * them. (The action itself touches the database and is not unit-tested.)
 */

/**
 * Why a trip cannot be deleted right now, or null when it can.
 *
 * A trip that is mid-generation is still being written by `createTripAction`,
 * which would otherwise keep inserting rows for a trip that no longer exists
 * (or fail half-way through). Same reason archive and duplicate refuse it.
 */
export function deleteBlockedReason(status: string): string | null {
  return status === "generating"
    ? "This trip is still being generated. Try again in a moment."
    : null
}

export interface TripDeletionCopy {
  title: string
  description: string
  /** What is NOT removed, so nobody assumes more is lost than really is. */
  reassurance: string
  confirmLabel: string
  pendingLabel: string
}

/**
 * Dialog wording. It names the trip (a bare "Delete this trip?" is how the
 * wrong one gets deleted) and lists exactly what goes with it. Every table
 * that references a trip cascades on delete, so the list is the full set the
 * database removes: itinerary (days, activities, restaurants, weather, hotel,
 * transport, notes), budget and expenses, packing list, and chat history.
 *
 * Saved Favorites are deliberately not in the list: `favorites.trip_id` is
 * `on delete set null`, so they survive as saved places.
 */
export function tripDeletionCopy(tripTitle: string): TripDeletionCopy {
  const name = tripTitle.trim()
  const subject = name ? `“${name}”` : "This trip"
  return {
    title: "Delete this trip?",
    description: `${subject} will be permanently deleted, along with its itinerary, expenses, packing list and chat history. This can't be undone.`,
    reassurance: "Places you've saved to Favorites are kept.",
    confirmLabel: "Delete trip",
    pendingLabel: "Deleting…",
  }
}
