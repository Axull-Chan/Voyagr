import type { ItineraryRequest, SourcedContext } from "@/lib/ai"
import { getDestinationImage, type DestinationImage } from "@/services/image-service"
import { geocodeDestination, type GeocodedDestination } from "@/services/map-service"
import { sourcePlaces } from "@/services/places-service"
import { getTripWeather } from "@/services/weather-service"
import { tripDurationDays } from "@/lib/trips/trip-domain"

/**
 * Gathers the real-world context an itinerary is built from.
 *
 * This is the brief's data flow in one place — geocode, then weather, places
 * and imagery — so that no page or action has to remember the order or the
 * failure handling. Every step degrades independently: losing photos should
 * not cost you the itinerary.
 */

export interface TripContext {
  destination: GeocodedDestination | null
  sourced: SourcedContext | null
  image: DestinationImage | null
  /** Anything the user should be told, e.g. "places aren't connected". */
  notices: string[]
  /** True when the plan will be built from example venues, not real ones. */
  usingFallbackPlaces: boolean
}

export async function buildTripContext(
  request: Pick<
    ItineraryRequest,
    "destination" | "startDate" | "endDate" | "interests"
  >
): Promise<TripContext> {
  const notices: string[] = []

  // Everything downstream needs coordinates, so this one is sequential.
  const geocoded = await geocodeDestination(request.destination)
  if (geocoded.notice) notices.push(geocoded.notice)

  const destination = geocoded.data
  if (!destination) {
    return {
      destination: null,
      sourced: null,
      image: null,
      notices,
      usingFallbackPlaces: true,
    }
  }

  const days = tripDurationDays(request.startDate, request.endDate)

  // Independent of one another — run concurrently rather than making the
  // traveller wait for three round trips in series.
  const [places, weather, image] = await Promise.all([
    sourcePlaces({
      latitude: destination.latitude,
      longitude: destination.longitude,
      interests: request.interests,
      days,
    }),
    getTripWeather(
      destination.latitude,
      destination.longitude,
      request.startDate,
      request.endDate
    ),
    getDestinationImage(destination.name),
  ])

  for (const notice of [places.notice, weather.notice, image.notice]) {
    if (notice) notices.push(notice)
  }

  const hasRealPlaces = places.data.attractions.length > 0

  const sourced: SourcedContext | null = hasRealPlaces
    ? {
        latitude: destination.latitude,
        longitude: destination.longitude,
        resolvedName: destination.name,
        attractions: places.data.attractions,
        restaurants: places.data.restaurants,
        hotels: places.data.hotels,
        weatherByDate: weather.data.byDate,
      }
    : null

  return {
    destination,
    sourced,
    image: image.data,
    notices,
    usingFallbackPlaces: !hasRealPlaces,
  }
}
