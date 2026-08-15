import type { ItineraryRequest } from "@/lib/ai/types"

/**
 * Small pricing/naming helpers shared by every provider's hotel fallback.
 *
 * Pulled out once a second provider needed the exact same numbers: keeping
 * two copies would let them silently drift, and there's nothing
 * provider-specific about "what a resort costs relative to a hostel."
 */

/** How to describe an example stay of the requested kind. */
export const ACCOMMODATION_NOUN: Record<string, string> = {
  hotel: "hotel",
  boutique: "boutique stay",
  apartment: "apartment",
  hostel: "hostel",
  resort: "resort",
}

/** What the requested standard of accommodation does to a nightly rate. */
export function accommodationMultiplier(request: ItineraryRequest): number {
  return request.accommodation === "hostel"
    ? 0.35
    : request.accommodation === "resort"
      ? 1.8
      : request.accommodation === "boutique"
        ? 1.3
        : request.accommodation === "apartment"
          ? 0.85
          : 1
}
