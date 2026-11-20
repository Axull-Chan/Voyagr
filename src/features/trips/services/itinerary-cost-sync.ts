import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"
import { dayCostUpdates, planBudgetLines } from "@/lib/trips/itinerary-costs"

type Client = SupabaseClient<Database>

/**
 * Brings `trip_days.daily_cost` and the planned `budget_breakdown` lines back in
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
): Promise<{ ok: boolean; daysUpdated: number; budgetLinesUpdated: number }> {
  const [tripRes, daysRes, hotelsRes, transportRes, budgetRes] = await Promise.all([
    supabase.from("trips").select("budget").eq("id", tripId).maybeSingle(),
    supabase.from("trip_days").select("id, daily_cost, activities(estimated_cost)").eq("trip_id", tripId),
    supabase.from("hotels").select("total_cost, is_primary").eq("trip_id", tripId),
    supabase.from("transportation").select("cost").eq("trip_id", tripId),
    supabase.from("budget_breakdown").select("id, category, planned_amount").eq("trip_id", tripId),
  ])
  if (tripRes.error || daysRes.error || hotelsRes.error || transportRes.error || budgetRes.error || !tripRes.data) {
    return { ok: false, daysUpdated: 0, budgetLinesUpdated: 0 }
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

  return { ok, daysUpdated: dayUpdates.length, budgetLinesUpdated: budgetUpdates.length }
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
