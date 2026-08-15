import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/types/database.types"

/**
 * Everything the trip page renders, loaded in one place.
 *
 * Nested selects rather than a query per section: a five-day trip has days,
 * activities, restaurants and weather, and fetching those separately would be
 * four round trips that Postgres can do as one. RLS still applies, so a trip
 * belonging to someone else simply returns nothing.
 */

export type TripRow = Tables<"trips">
export type ActivityRow = Tables<"activities">
export type RestaurantRow = Tables<"restaurants">
export type WeatherRow = Tables<"weather">
export type HotelRow = Tables<"hotels">
export type TransportRow = Tables<"transportation">
export type BudgetRow = Tables<"budget_breakdown">
export type ExpenseRow = Tables<"expenses">
export type PackingItemRow = Tables<"packing_lists">

export interface TripDay {
  id: string
  dayNumber: number
  date: string | null
  summary: string | null
  dailyCost: number | null
  activities: ActivityRow[]
  restaurants: RestaurantRow[]
  weather: WeatherRow | null
}

export interface TripDetail {
  trip: TripRow
  days: TripDay[]
  hotels: HotelRow[]
  transportation: TransportRow[]
  budget: BudgetRow[]
  expenses: ExpenseRow[]
  packing: PackingItemRow[]
}

export async function getTripDetail(tripId: string): Promise<TripDetail> {
  const supabase = await createClient()

  const [
    tripResult,
    daysResult,
    hotelsResult,
    transportResult,
    budgetResult,
    expensesResult,
    packingResult,
  ] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_days")
      .select(
        "*, activities(*), restaurants(*), weather(*)"
      )
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true }),
    supabase.from("hotels").select("*").eq("trip_id", tripId),
    supabase
      .from("transportation")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true }),
    supabase.from("budget_breakdown").select("*").eq("trip_id", tripId),
    supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("expense_date", { ascending: false }),
    supabase
      .from("packing_lists")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true }),
  ])

  // A missing trip and a trip owned by someone else are indistinguishable
  // here by design — RLS filters the latter, and both should 404 rather than
  // reveal that an id exists.
  if (!tripResult.data) notFound()

  const days: TripDay[] = (daysResult.data ?? []).map((row) => {
    // Supabase returns embedded one-to-one relations as an array or object
    // depending on how it infers the relationship; normalise both.
    const weatherRel = row.weather as WeatherRow | WeatherRow[] | null
    const weather = Array.isArray(weatherRel) ? (weatherRel[0] ?? null) : weatherRel

    return {
      id: row.id,
      dayNumber: row.day_number,
      date: row.date,
      summary: row.summary,
      dailyCost: row.daily_cost,
      activities: [...((row.activities as ActivityRow[]) ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      ),
      restaurants: (row.restaurants as RestaurantRow[]) ?? [],
      weather,
    }
  })

  return {
    trip: tripResult.data,
    days,
    hotels: hotelsResult.data ?? [],
    transportation: transportResult.data ?? [],
    budget: budgetResult.data ?? [],
    expenses: expensesResult.data ?? [],
    packing: packingResult.data ?? [],
  }
}
