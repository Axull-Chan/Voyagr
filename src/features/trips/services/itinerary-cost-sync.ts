import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"
import { dayCostUpdates, planBudgetLines } from "@/lib/trips/itinerary-costs"
import { legUpdates, tripStartPoint } from "@/lib/trips/feasibility"

type Client = SupabaseClient<Database>

/**
 * Brings `trip_days.daily_cost`, the planned `budget_breakdown` lines and each
 * activity's stored leg (`travel_time_minutes`, `walking_distance_km`) back in
 * line with the activities a trip now holds, using the same rules generation
 * used (`lib/trips/itinerary-costs.ts`). Called after the chat adds, removes or
 * moves activities; the trip page, the PDF and the JSON export all read these
 * stored figures, so fixing them here fixes all three.
 *
 * Writes only rows whose value actually changes. Best effort: the Supabase
 * client has no transactions, so a failure part-way leaves some figures stale
 * (the next edit resyncs them) and is reported to the caller, never thrown.
 */
export async function syncItineraryCosts(
  supabase: Client,
  tripId: string
): Promise<{ ok: boolean; daysUpdated: number; budgetLinesUpdated: number; legsUpdated: number }> {
  const [tripRes, daysRes, hotelsRes, transportRes, budgetRes] = await Promise.all([
    supabase.from("trips").select("budget, transportation").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_days")
      .select(
        "id, daily_cost, activities(id, title, time_slot, start_time, duration_minutes, lat, lng, sort_order, estimated_cost, travel_time_minutes, walking_distance_km)"
      )
      .eq("trip_id", tripId),
    supabase.from("hotels").select("total_cost, is_primary, lat, lng, source").eq("trip_id", tripId),
    supabase.from("transportation").select("cost").eq("trip_id", tripId),
    supabase.from("budget_breakdown").select("id, category, planned_amount").eq("trip_id", tripId),
  ])
  if (tripRes.error || daysRes.error || hotelsRes.error || transportRes.error || budgetRes.error || !tripRes.data) {
    return { ok: false, daysUpdated: 0, budgetLinesUpdated: 0, legsUpdated: 0 }
  }

  const days = daysRes.data ?? []
  const activities = days.flatMap((day) =>
    (day.activities ?? []).map((a) => ({ trip_day_id: day.id, estimated_cost: a.estimated_cost }))
  )

  let ok = true
  const dayUpdates = dayCostUpdates(days, activities)
  for (const update of dayUpdates) {
    const { error } = await supabase
      .from("trip_days")
      .update({ daily_cost: update.dailyCost })
      .eq("id", update.id)
    if (error) ok = false
  }

  const budgetUpdates = budgetLineUpdates({
    budget: tripRes.data.budget,
    hotels: hotelsRes.data ?? [],
    transport: transportRes.data ?? [],
    activities,
    stored: budgetRes.data ?? [],
  })
  for (const update of budgetUpdates) {
    const { error } = await supabase
      .from("budget_breakdown")
      .update({ planned_amount: update.plannedAmount })
      .eq("id", update.id)
    if (error) ok = false
  }

  // Distances between stops, in each day's current order, from the stay. A chat
  // move or add re-sequences the day, so the stored legs would otherwise
  // describe a route the traveller no longer takes.
  const start = tripStartPoint(hotelsRes.data ?? [])
  let legsUpdated = 0
  for (const day of days) {
    const updates = legUpdates(
      (day.activities ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        timeSlot: a.time_slot,
        startTime: a.start_time,
        durationMinutes: a.duration_minutes,
        lat: a.lat,
        lng: a.lng,
        sortOrder: a.sort_order,
        travel_time_minutes: a.travel_time_minutes,
        walking_distance_km: a.walking_distance_km,
      })),
      { start, transport: tripRes.data.transportation }
    )
    for (const update of updates) {
      const { error } = await supabase
        .from("activities")
        .update({
          travel_time_minutes: update.travelTimeMinutes,
          walking_distance_km: update.walkingDistanceKm,
        })
        .eq("id", update.id)
      if (error) ok = false
      else legsUpdated += 1
    }
  }

  return { ok, daysUpdated: dayUpdates.length, budgetLinesUpdated: budgetUpdates.length, legsUpdated }
}

/**
 * Which stored planned budget lines differ from what the plan says now. Pure,
 * exported for tests. Hotel cost counts the primary stay (what generation
 * budgets against), or every stay when none is marked primary.
 */
export function budgetLineUpdates(input: {
  budget: number | string | null
  hotels: { total_cost: number | string | null; is_primary: boolean | null }[]
  transport: { cost: number | string | null }[]
  activities: { estimated_cost: number | string | null }[]
  stored: { id: string; category: string; planned_amount: number | string | null }[]
}): { id: string; plannedAmount: number }[] {
  const num = (value: number | string | null) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const primary = input.hotels.filter((h) => h.is_primary)
  const hotelTotal = (primary.length > 0 ? primary : input.hotels).reduce((s, h) => s + num(h.total_cost), 0)
  const transportTotal = input.transport.reduce((s, t) => s + num(t.cost), 0)
  const activityTotal = input.activities.reduce((s, a) => s + Math.max(0, num(a.estimated_cost)), 0)
  const budget = input.budget === null ? null : num(input.budget)

  const planned = new Map(
    planBudgetLines({ budget, hotelTotal, transportTotal, activityTotal }).lines.map((l) => [
      l.category as string,
      l.plannedAmount,
    ])
  )

  return input.stored.flatMap((row) => {
    const next = planned.get(row.category)
    if (next === undefined || num(row.planned_amount) === next) return []
    return [{ id: row.id, plannedAmount: next }]
  })
}
