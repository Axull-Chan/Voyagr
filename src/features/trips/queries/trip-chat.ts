import { createClient } from "@/lib/supabase/server"
import type { ChatItinerarySnapshot } from "@/lib/ai/types"
import type { Tables } from "@/types/database.types"
import type { MealType, TimeSlot } from "@/lib/trips/trip-domain"

/**
 * Reads for chat-based itinerary editing (Phase 9).
 *
 * A sibling to `trip-detail.ts`, not merged into it: `getTripDetail` calls
 * Next's `notFound()` on a missing trip, which is correct for a page render
 * but wrong for a Server Action, which needs a value it can turn into
 * `{ ok: false, error }` rather than a thrown redirect.
 */

export type TripChatMessageRow = Tables<"trip_chat_messages">

interface RawDay {
  day_number: number
  date: string | null
  summary: string | null
  activities: {
    id: string
    time_slot: string | null
    title: string
    location_name: string | null
    start_time: string | null
    duration_minutes: number | null
    estimated_cost: number | null
    category: string | null
    lat: number | null
    lng: number | null
  }[]
  restaurants: {
    id: string
    meal_type: string | null
    name: string
    cuisine: string | null
    lat: number | null
    lng: number | null
  }[]
}

export interface TripChatContextResult {
  snapshot: ChatItinerarySnapshot
  /** For sourcing fresh venue candidates when the assistant proposes an
   * addition — never sent to the model itself. */
  center: { lat: number; lng: number } | null
}

export async function getTripChatContext(
  tripId: string
): Promise<TripChatContextResult | null> {
  const supabase = await createClient()

  const [tripResult, daysResult, hotelsResult] = await Promise.all([
    supabase.from("trips").select("destination, currency").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_days")
      .select(
        "day_number, date, summary, activities(id, time_slot, title, location_name, start_time, duration_minutes, estimated_cost, category, lat, lng), restaurants(id, meal_type, name, cuisine, lat, lng)"
      )
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true }),
    supabase
      .from("hotels")
      .select("lat, lng")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .limit(1),
  ])

  if (!tripResult.data) return null

  const days = (daysResult.data ?? []) as unknown as RawDay[]

  const snapshot: ChatItinerarySnapshot = {
    tripId,
    destination: tripResult.data.destination,
    currency: tripResult.data.currency,
    days: days.map((d) => ({
      dayNumber: d.day_number,
      date: d.date,
      summary: d.summary,
    })),
    activities: days.flatMap((d) =>
      d.activities.map((a) => ({
        id: a.id,
        dayNumber: d.day_number,
        timeSlot: a.time_slot as TimeSlot | null,
        title: a.title,
        locationName: a.location_name,
        startTime: a.start_time,
        durationMinutes: a.duration_minutes,
        estimatedCost: a.estimated_cost,
        category: a.category,
      }))
    ),
    restaurants: days.flatMap((d) =>
      d.restaurants.map((r) => ({
        id: r.id,
        dayNumber: d.day_number,
        mealType: r.meal_type as MealType | null,
        name: r.name,
        cuisine: r.cuisine,
      }))
    ),
  }

  const firstHotel = hotelsResult.data?.[0]
  const firstActivityWithPoint = days
    .flatMap((d) => d.activities)
    .find((a) => a.lat !== null && a.lng !== null)

  const center =
    firstHotel && firstHotel.lat !== null && firstHotel.lng !== null
      ? { lat: firstHotel.lat, lng: firstHotel.lng }
      : firstActivityWithPoint
        ? { lat: firstActivityWithPoint.lat as number, lng: firstActivityWithPoint.lng as number }
        : null

  return { snapshot, center }
}

/** Full conversation, oldest-first. No pagination — a trip's chat volume
 * never remotely approaches a scale where that matters yet. */
export async function getTripChatHistory(tripId: string): Promise<TripChatMessageRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("trip_chat_messages")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })
  return data ?? []
}
