import {
  fetchPlaceDetail,
  INTEREST_TO_KINDS,
  isOpenTripMapConfigured,
  OTM_KINDS,
  searchPlaces,
  type PlaceSummary,
} from "@/integrations/opentripmap/places"
import type { Interest } from "@/lib/trips/trip-domain"
import {
  attempt,
  live,
  unavailable,
  type ServiceResult,
} from "@/services/service-result"

/**
 * Real places for a destination, grouped by the role they play in a trip.
 *
 * This is the service that lets the planner stop inventing venues. It asks
 * for more than it needs so the planner has slack to avoid repeating a venue
 * across days.
 */

export interface SourcedPlace {
  id: string
  name: string
  latitude: number
  longitude: number
  /** 0–7 significance from OpenTripMap; higher is more notable. */
  rating: number
  kinds: string[]
  distanceM: number
}

export interface SourcedPlaces {
  attractions: SourcedPlace[]
  restaurants: SourcedPlace[]
  hotels: SourcedPlace[]
}

const EMPTY: SourcedPlaces = { attractions: [], restaurants: [], hotels: [] }

function toSourced(place: PlaceSummary): SourcedPlace {
  return {
    id: place.xid,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    kinds: place.kinds,
    distanceM: place.distanceM,
  }
}

/**
 * Removes near-duplicates that OSM frequently contains.
 *
 * The same museum often appears as both a node and a way with slightly
 * different names ("Museum of Kyoto" / "The Museum of Kyoto"), and an
 * itinerary that lists a venue twice reads as broken.
 */
function dedupe(places: PlaceSummary[]): SourcedPlace[] {
  const seen = new Set<string>()
  const out: SourcedPlace[] = []
  for (const place of places) {
    const key = place.name
      // Strip diacritics first: "Sanjō Ōhashi Bridge" and "Sanjo Ohashi
      // Bridge" are the same crossing, and both appeared on one day before
      // this. OSM transliterates inconsistently.
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/[^a-z0-9]/g, "")
    if (key.length === 0 || seen.has(key)) continue
    seen.add(key)
    out.push(toSourced(place))
  }
  return out
}

/**
 * Categories that are never a sightseeing activity.
 *
 * Restaurants arrive in the attractions pool when "food" is an interest, and
 * scheduling "Food walk through <a specific restaurant>" reads as broken.
 * They still power the meal recommendations, just not the itinerary slots.
 */
const NOT_AN_ACTIVITY = new Set([
  "foods",
  "restaurants",
  "cafes",
  "bars",
  "pubs",
  "fast_food",
  "accomodations",
  "other_hotels",
  "banks",
])

function isVisitable(place: SourcedPlace): boolean {
  return !place.kinds.some((kind) => NOT_AN_ACTIVITY.has(kind))
}

export interface SourcePlacesRequest {
  latitude: number
  longitude: number
  interests: Interest[]
  /** Roughly how many days of material to gather. */
  days: number
  radiusM?: number
}

/**
 * Gathers attractions, restaurants and hotels around a destination.
 *
 * The three searches run concurrently — they are independent, and doing them
 * in sequence would triple the time a traveller waits for their itinerary.
 */
export async function sourcePlaces(
  request: SourcePlacesRequest
): Promise<ServiceResult<SourcedPlaces>> {
  const { latitude, longitude, interests, days, radiusM = 12_000 } = request

  return attempt("Places", EMPTY, async () => {
    if (!isOpenTripMapConfigured()) {
      return unavailable(
        EMPTY,
        "Live places aren't connected, so this itinerary uses example venues."
      )
    }

    // Interests drive attractions; the other two are fixed roles.
    const interestKinds = [
      ...new Set(
        (interests.length > 0 ? interests : (["history", "art", "nature"] as Interest[]))
          .flatMap((interest) => INTEREST_TO_KINDS[interest])
      ),
    ]

    // Ask for several times what a day needs, so the planner can vary venues
    // across days instead of repeating the same three.
    const attractionLimit = Math.min(Math.max(days * 6, 20), 60)

    const [attractions, restaurants, hotels] = await Promise.all([
      searchPlaces({
        latitude,
        longitude,
        kinds: interestKinds,
        limit: attractionLimit,
        minRating: 2,
        radiusM,
      }),
      searchPlaces({
        latitude,
        longitude,
        kinds: [OTM_KINDS.restaurants, OTM_KINDS.cafes, OTM_KINDS.foods],
        limit: Math.min(Math.max(days * 4, 15), 40),
        // Restaurants are rated far lower than monuments; demanding 2 here
        // returns almost nothing in most cities.
        minRating: 1,
        radiusM,
      }),
      searchPlaces({
        latitude,
        longitude,
        kinds: [OTM_KINDS.accommodations],
        limit: 10,
        minRating: 1,
        radiusM,
      }),
    ])

    const sourced: SourcedPlaces = {
      attractions: dedupe(attractions).filter(isVisitable),
      restaurants: dedupe(restaurants),
      hotels: dedupe(hotels),
    }

    // A destination with no attractions at all (a tiny village, or a bad
    // geocode) is better served by the example planner than by a blank day.
    if (sourced.attractions.length === 0) {
      return unavailable(
        EMPTY,
        "We couldn't find enough listed places here, so this itinerary uses example venues."
      )
    }

    return live(sourced)
  })
}

/**
 * Rich detail for one place: description, image, official website.
 *
 * Called lazily by the trip page for the places actually shown, rather than
 * for every candidate gathered above, which would burn the daily allowance.
 */
export async function getPlaceDetail(xid: string) {
  return attempt("Place details", null, async () => {
    const detail = await fetchPlaceDetail(xid)
    return detail ? live(detail) : unavailable(null, "That place is no longer listed.")
  })
}
