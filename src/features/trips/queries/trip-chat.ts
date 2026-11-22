import { createClient } from "@/lib/supabase/server"
import type { ChatItinerarySnapshot } from "@/lib/ai/types"
import type { Tables } from "@/types/database.types"
import { getTripWeather, type DayWeather } from "@/services/weather-service"
import {
  buildChatSnapshot,
  type ChatDayRow,
  type ChatHotelRow,
  type ChatTransportRow,
  type ChatTripRow,
} from "@/features/trips/services/chat-snapshot"

/**
 * Reads for chat-based itinerary editing (Phase 9).
 *
 * A sibling to `trip-detail.ts`, not merged into it: `getTripDetail` calls
 * Next's `notFound()` on a missing trip, which is correct for a page render
 * but wrong for a Server Action, which needs a value it can turn into
 * `{ ok: false, error }` rather than a thrown redirect.
 */

export type TripChatMessageRow = Tables<"trip_chat_messages">

export interface TripChatContextResult {
  snapshot: ChatItinerarySnapshot
  /** For sourcing fresh venue candidates when the assistant proposes an
   * addition — never sent to the model itself. */
  center: { lat: number; lng: number } | null
}

/** The live forecast is a nicety: past this, the chat goes on without it. */
export const CHAT_WEATHER_TIMEOUT_MS = 4_000

/**
 * The live forecast for the trip's dates, or `{}` on any failure or after
 * `CHAT_WEATHER_TIMEOUT_MS` — a missing forecast becomes "no forecast" in the
 * prompt, never an error for the traveller.
 */
async function liveForecast(
  center: { lat: number; lng: number } | null,
  startDate: string | null,
  endDate: string | null
): Promise<Record<string, DayWeather>> {
  if (!center || !startDate || !endDate) return {}
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<Record<string, DayWeather>>((resolve) => {
      timer = setTimeout(() => resolve({}), CHAT_WEATHER_TIMEOUT_MS)
    })
    const fetched = getTripWeather(center.lat, center.lng, startDate, endDate).then(
      (result) => result.data.byDate
    )
    return await Promise.race([fetched, timeout])
  } catch {
    return {}
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Everything the trip page shows, read with the traveller's own session (RLS
 * decides what they can see), and shaped by `buildChatSnapshot`. The only
 * outside call is the live forecast the trip page itself makes.
 */
export async function getTripChatContext(
  tripId: string
): Promise<TripChatContextResult | null> {
  const supabase = await createClient()

  const [tripResult, daysResult, hotelsResult, transportResult, budgetResult, expensesResult, packingResult] =
    await Promise.all([
      supabase
        .from("trips")
        .select(
          "title, destination, currency, start_date, end_date, status, travelers, travel_style, interests, accommodation, transportation, starting_city, additional_notes, budget"
        )
        .eq("id", tripId)
        .maybeSingle(),
      supabase
        .from("trip_days")
        .select(
          "day_number, date, summary, daily_cost, activities(id, time_slot, title, description, location_name, start_time, duration_minutes, estimated_cost, category, lat, lng, sort_order), restaurants(id, meal_type, name, cuisine, opening_hours), weather(condition, temp_high_c, temp_low_c, precipitation_chance, wind_kph, source)"
        )
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true }),
      supabase
        .from("hotels")
        .select("name, nights, price_per_night, source, is_primary, lat, lng")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true }),
      supabase
        .from("transportation")
        .select("mode, from_location, to_location, depart_at")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true }),
      supabase.from("budget_breakdown").select("category, planned_amount").eq("trip_id", tripId),
      supabase.from("expenses").select("amount, currency").eq("trip_id", tripId),
      supabase.from("packing_lists").select("is_checked").eq("trip_id", tripId),
    ])

  if (!tripResult.data) return null
  const trip = tripResult.data as ChatTripRow
  const days = (daysResult.data ?? []) as unknown as ChatDayRow[]
  const hotels = (hotelsResult.data ?? []) as ChatHotelRow[]

  const firstHotel = hotels.find((h) => h.lat !== null && h.lng !== null)
  const firstActivityWithPoint = days
    .flatMap((d) => d.activities)
    .find((a) => a.lat !== null && a.lng !== null)

  const center = firstHotel
    ? { lat: firstHotel.lat as number, lng: firstHotel.lng as number }
    : firstActivityWithPoint
      ? { lat: firstActivityWithPoint.lat as number, lng: firstActivityWithPoint.lng as number }
      : null

  const snapshot = buildChatSnapshot({
    tripId,
    trip,
    days,
    hotels,
    transportation: (transportResult.data ?? []) as ChatTransportRow[],
    budgetLines: budgetResult.data ?? [],
    expenses: expensesResult.data ?? [],
    packing: packingResult.data ?? [],
    liveWeather: days.length > 0 ? await liveForecast(center, trip.start_date, trip.end_date) : {},
  })

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
