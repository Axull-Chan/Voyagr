import type { SupabaseClient } from "@supabase/supabase-js"

import type { GeneratedItinerary } from "@/lib/ai"
import type { Database, TablesInsert } from "@/types/database.types"
import { BOOKED_STAY_SOURCE, generatedStayIsPrimary } from "@/lib/bookings/booking-guards"
import { syncItineraryCosts } from "@/features/trips/services/itinerary-cost-sync"

type Client = SupabaseClient<Database>

/**
 * Writes a generated itinerary to the database.
 *
 * This is the only place that knows both the AI contract and the table shapes;
 * keeping the translation here is what lets a column rename stay inside the
 * schema and a provider's response format stay inside the AI layer.
 *
 * Every child table is written with a single batched insert rather than a
 * per-row loop — a 14-day trip is ~40 activities and ~35 restaurants, which
 * would otherwise be 75 round trips.
 */
export async function persistItinerary(
  supabase: Client,
  tripId: string,
  itinerary: GeneratedItinerary
): Promise<void> {
  // Start from a clean trip.
  //
  // The Supabase client can't wrap these inserts in a transaction, so a
  // failure part-way through leaves some child tables written and others not.
  // Because a failed generation deliberately leaves the trip as a retryable
  // draft rather than deleting it, a retry would otherwise stack a second
  // itinerary on top of the debris. Clearing first makes this function
  // idempotent, so a retry always converges on one correct itinerary.
  //
  // Deleting the days is enough to take activities, restaurants and weather
  // with them — all three cascade from trip_days.
  //
  // A booked stay is the one exception: it stands for a reservation the hotel
  // holds, so it survives regeneration (the database refuses to delete it
  // anyway — see the hotel_bookings migration). The new plan's stays are added
  // beside it, never as the primary one.
  const { data: bookedStays, error: bookedError } = await supabase
    .from("hotels")
    .select("id")
    .eq("trip_id", tripId)
    .eq("source", BOOKED_STAY_SOURCE)
  if (bookedError) throw bookedError
  const hasBookedStay = (bookedStays ?? []).length > 0

  const cleanup = await Promise.all([
    supabase.from("trip_days").delete().eq("trip_id", tripId),
    supabase.from("hotels").delete().eq("trip_id", tripId).neq("source", BOOKED_STAY_SOURCE),
    supabase.from("transportation").delete().eq("trip_id", tripId),
    supabase.from("budget_breakdown").delete().eq("trip_id", tripId),
    supabase.from("packing_lists").delete().eq("trip_id", tripId),
  ])
  for (const result of cleanup) {
    if (result.error) throw result.error
  }

  // Days first: their generated ids are the parent for almost everything else.
  const dayRows: TablesInsert<"trip_days">[] = itinerary.days.map((day) => ({
    trip_id: tripId,
    day_number: day.dayNumber,
    date: day.date,
    summary: day.summary,
    daily_cost: day.estimatedCost,
  }))

  const { data: insertedDays, error: daysError } = await supabase
    .from("trip_days")
    .insert(dayRows)
    .select("id, day_number")

  if (daysError) throw daysError
  if (!insertedDays) throw new Error("Trip days were not returned after insert.")

  const dayIdByNumber = new Map<number, string>(
    insertedDays.map((row) => [row.day_number, row.id])
  )

  const activityRows: TablesInsert<"activities">[] = []
  const restaurantRows: TablesInsert<"restaurants">[] = []
  const weatherRows: TablesInsert<"weather">[] = []

  for (const day of itinerary.days) {
    const dayId = dayIdByNumber.get(day.dayNumber)
    // A day we can't resolve would silently drop its contents, so fail loudly.
    if (!dayId) {
      throw new Error(`No inserted trip_day found for day ${day.dayNumber}.`)
    }

    day.activities.forEach((activity, index) => {
      activityRows.push({
        trip_day_id: dayId,
        time_slot: activity.timeSlot,
        title: activity.title,
        description: activity.description,
        location_name: activity.locationName,
        lat: activity.lat,
        lng: activity.lng,
        start_time: activity.startTime,
        duration_minutes: activity.durationMinutes,
        travel_time_minutes: activity.travelTimeMinutes,
        walking_distance_km: activity.walkingDistanceKm,
        estimated_cost: activity.estimatedCost,
        category: activity.category,
        sort_order: index,
      })
    })

    for (const restaurant of day.restaurants) {
      restaurantRows.push({
        trip_day_id: dayId,
        meal_type: restaurant.mealType,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        rating: restaurant.rating,
        price_level: restaurant.priceLevel,
        distance_km: restaurant.distanceKm,
        opening_hours: restaurant.openingHours,
        lat: restaurant.lat,
        lng: restaurant.lng,
      })
    }

    weatherRows.push({
      trip_day_id: dayId,
      condition: day.weather.condition,
      temp_high_c: day.weather.tempHighC,
      temp_low_c: day.weather.tempLowC,
      precipitation_chance: day.weather.precipitationChance,
      wind_kph: day.weather.windKph,
      humidity: day.weather.humidity,
      sunrise: day.weather.sunrise,
      sunset: day.weather.sunset,
      // The reading's own provenance — a trip straddling the forecast
      // horizon has real rows for the near days and modelled ones after.
      source: day.weather.source,
    })
  }

  const hotelRows: TablesInsert<"hotels">[] = itinerary.hotels.map((hotel) => ({
    trip_id: tripId,
    name: hotel.name,
    address: hotel.address,
    check_in_date: hotel.checkInDate,
    check_out_date: hotel.checkOutDate,
    nights: hotel.nights,
    price_per_night: hotel.pricePerNight,
    total_cost: hotel.totalCost,
    rating: hotel.rating,
    amenities: hotel.amenities,
    lat: hotel.lat,
    lng: hotel.lng,
    is_primary: generatedStayIsPrimary(hotel.isPrimary, hasBookedStay),
    // Whether a real listing backs this name, so the page can keep saying so
    // long after the creation notice has gone.
    source: hotel.source,
  }))

  const transportRows: TablesInsert<"transportation">[] =
    itinerary.transportation.map((leg, index) => ({
      trip_id: tripId,
      trip_day_id:
        leg.dayNumber === null
          ? null
          : (dayIdByNumber.get(leg.dayNumber) ?? null),
      mode: leg.mode,
      provider: leg.provider,
      from_location: leg.fromLocation,
      to_location: leg.toLocation,
      duration_minutes: leg.durationMinutes,
      cost: leg.cost,
      notes: leg.notes,
      sort_order: index,
    }))

  const budgetRows: TablesInsert<"budget_breakdown">[] = itinerary.budget.map(
    (line) => ({
      trip_id: tripId,
      category: line.category,
      planned_amount: line.plannedAmount,
    })
  )

  const packingRows: TablesInsert<"packing_lists">[] = itinerary.packing.map(
    (entry, index) => ({
      trip_id: tripId,
      category: entry.category,
      item: entry.item,
      sort_order: index,
    })
  )

  // These are independent of one another, so they go out concurrently rather
  // than in sequence. Each `insert` resolves with an error field instead of
  // throwing, so results are inspected explicitly below.
  const results = await Promise.all([
    activityRows.length
      ? supabase.from("activities").insert(activityRows)
      : null,
    restaurantRows.length
      ? supabase.from("restaurants").insert(restaurantRows)
      : null,
    weatherRows.length ? supabase.from("weather").insert(weatherRows) : null,
    hotelRows.length ? supabase.from("hotels").insert(hotelRows) : null,
    transportRows.length
      ? supabase.from("transportation").insert(transportRows)
      : null,
    budgetRows.length
      ? supabase.from("budget_breakdown").insert(budgetRows)
      : null,
    packingRows.length
      ? supabase.from("packing_lists").insert(packingRows)
      : null,
  ])

  for (const result of results) {
    if (result?.error) throw result.error
  }

  // The generated budget lines priced the generated stay. With a booked stay
  // kept as primary, re-derive them so the hotels line is what was booked.
  // Best effort, like every other caller: a failure leaves figures that the
  // next edit resyncs, never a failed generation.
  if (hasBookedStay) await syncItineraryCosts(supabase, tripId)
}
