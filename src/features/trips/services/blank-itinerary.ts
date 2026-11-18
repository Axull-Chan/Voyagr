import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"
import { reportServerError } from "@/lib/monitoring/report-server"
import { geocodeDestination } from "@/services/map-service"
import { getTripWeather } from "@/services/weather-service"
import {
  getDestinationImage,
  recordImageUse,
  type DestinationImage,
} from "@/services/image-service"
import {
  buildBlankDays,
  weatherRowsForDays,
  type ForecastDay,
} from "@/features/trips/services/itinerary-edit"

type Client = SupabaseClient<Database>

export interface BlankTrip {
  id: string
  destination: string
  start_date: string | null
  end_date: string | null
  cover_image_url: string | null
}

export type BlankItineraryResult =
  | { ok: true; notices: string[] }
  | { ok: false; error: string }

/** Postgres' unique-violation code — here, a second set of days for the same trip. */
const UNIQUE_VIOLATION = "23505"

/**
 * Gives a trip an itinerary with every day created and nothing scheduled in it.
 *
 * This is what lets a traveller plan a whole trip by hand, with no model involved:
 * no quota is reserved and no provider is called. It still fills in what is real and
 * free — the forecast for each date (Open-Meteo, or the plain "not available yet"
 * row beyond its horizon) and a destination photo (Unsplash) — using the same
 * services a generated trip does, so the two kinds of trip look alike.
 *
 * What it never does is invent a plan: no activities, no places to eat, no stay, no
 * budget breakdown. Those come from the traveller, or from the generator if they
 * choose it later.
 *
 * The trip must be a `draft`; the unique `(trip_id, day_number)` constraint is what
 * actually prevents a second set of days if two requests race.
 */
export async function createBlankItinerary(
  supabase: Client,
  trip: BlankTrip
): Promise<BlankItineraryResult> {
  const blank = buildBlankDays(trip.start_date, trip.end_date)
  if (blank.length === 0) {
    return {
      ok: false,
      error: "This trip needs a valid start and end date before it can be planned.",
    }
  }

  const { data: days, error: daysError } = await supabase
    .from("trip_days")
    .insert(
      blank.map((day) => ({
        trip_id: trip.id,
        day_number: day.dayNumber,
        date: day.date,
      }))
    )
    .select("id, date")

  if (daysError) {
    if (daysError.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "This trip already has an itinerary." }
    }
    await reportServerError(daysError, { context: "action:createBlankItinerary" })
    return { ok: false, error: "We couldn't set up the days. Please try again." }
  }
  if (!days || days.length === 0) {
    return { ok: false, error: "We couldn't set up the days. Please try again." }
  }

  // Real-world context, each part independent: a failed photo or forecast leaves a
  // perfectly usable blank itinerary and a plain note, never a failed trip.
  const notices: string[] = []
  const geocoded = await geocodeDestination(trip.destination)
  if (geocoded.notice) notices.push(geocoded.notice)

  let byDate: Record<string, ForecastDay> = {}
  let image: DestinationImage | null = null
  const place = geocoded.data
  if (place && trip.start_date && trip.end_date) {
    const [weather, photo] = await Promise.all([
      getTripWeather(place.latitude, place.longitude, trip.start_date, trip.end_date),
      trip.cover_image_url ? Promise.resolve(null) : getDestinationImage(place.name),
    ])
    if (weather.notice) notices.push(weather.notice)
    if (photo?.notice) notices.push(photo.notice)
    byDate = weather.data.byDate
    image = photo?.data ?? null
  }

  // A forecast row for every day, real where there is one. Best effort.
  const { error: weatherError } = await supabase
    .from("weather")
    .insert(weatherRowsForDays(days, byDate))
  if (weatherError) {
    await reportServerError(weatherError, {
      context: "action:createBlankItinerary:weather",
      severity: "warning",
    })
  }

  const { error: tripError } = await supabase
    .from("trips")
    .update({
      status: "ready",
      ...(image
        ? {
            cover_image_url: image.url,
            // Stored with the URL: the licence requires a visible credit wherever
            // the photo appears, and the page renders from these columns.
            cover_image_credit_name: image.attribution.photographerName,
            cover_image_credit_url: image.attribution.photographerUrl,
            cover_image_link: image.attribution.photoUrl,
          }
        : {}),
    })
    .eq("id", trip.id)
    .eq("status", "draft")
  if (tripError) {
    await reportServerError(tripError, { context: "action:createBlankItinerary:status" })
    return { ok: false, error: "We couldn't finish setting up the trip. Please try again." }
  }

  // Unsplash asks for a usage ping once a photo is actually adopted.
  if (image) await recordImageUse(image)

  return { ok: true, notices }
}
