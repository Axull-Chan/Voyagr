import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"
import {
  dayCostFrom,
  editBlockedReason,
} from "@/features/trips/services/itinerary-edit"

type Client = SupabaseClient<Database>

/**
 * Database reads shared by the manual-itinerary actions.
 *
 * Ownership is enforced by Row Level Security — every query here runs as the
 * signed-in user, so a trip or activity that isn't theirs simply comes back empty.
 * The explicit `trip_id` checks below are not a second ownership check; they stop a
 * caller from pairing an activity with a DIFFERENT trip id of their own to slip past
 * the "is this trip editable?" test.
 */

export type EditableTrip =
  | { ok: true; id: string; status: string }
  | { ok: false; error: string }

/** The trip, if it exists for this user and is in a state that can be edited. */
export async function loadEditableTrip(
  supabase: Client,
  tripId: string
): Promise<EditableTrip> {
  const { data: trip } = await supabase
    .from("trips")
    .select("id, status")
    .eq("id", tripId)
    .maybeSingle()
  // A missing trip and someone else's trip are the same answer on purpose.
  if (!trip) return { ok: false, error: "That trip couldn't be found." }

  const blocked = editBlockedReason(trip.status)
  if (blocked) return { ok: false, error: blocked }
  return { ok: true, id: trip.id, status: trip.status }
}

/** Where a new activity goes: after everything already on the day. */
export async function nextActivitySortOrder(
  supabase: Client,
  tripDayId: string
): Promise<number> {
  const { data } = await supabase
    .from("activities")
    .select("sort_order")
    .eq("trip_day_id", tripDayId)
    .order("sort_order", { ascending: false })
    .limit(1)
  const max = data?.[0]?.sort_order
  return typeof max === "number" ? max + 1 : 0
}

/** True when `dayId` is one of this trip's days. */
export async function dayBelongsToTrip(
  supabase: Client,
  dayId: string,
  tripId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("trip_days")
    .select("id")
    .eq("id", dayId)
    .eq("trip_id", tripId)
    .maybeSingle()
  return Boolean(data)
}

export interface ActivityLocation {
  id: string
  tripDayId: string
}

/** The activity's day, when the activity belongs to a day of THIS trip. */
export async function findActivityInTrip(
  supabase: Client,
  activityId: string,
  tripId: string
): Promise<ActivityLocation | null> {
  const { data } = await supabase
    .from("activities")
    .select("id, trip_day_id, trip_days!inner(trip_id)")
    .eq("id", activityId)
    .maybeSingle()
  if (!data) return null

  // An embedded to-one relation comes back as an object or a one-element array
  // depending on how the client infers it; accept both.
  const rel = data.trip_days as { trip_id: string } | { trip_id: string }[] | null
  const owner = Array.isArray(rel) ? rel[0]?.trip_id : rel?.trip_id
  if (owner !== tripId) return null
  return { id: data.id, tripDayId: data.trip_day_id }
}

/**
 * Brings a day's stored total back in line with its activities. The total was the
 * sum of the activities' costs when the generator wrote it, so after an add, edit or
 * delete it is recomputed the same way — otherwise the PDF and the export would keep
 * printing a figure for a day that no longer exists. Best effort: the edit itself
 * has already succeeded, and a stale total is the lesser failure than reporting the
 * edit as failed.
 */
export async function refreshDayCost(supabase: Client, tripDayId: string): Promise<void> {
  const { data, error } = await supabase
    .from("activities")
    .select("estimated_cost")
    .eq("trip_day_id", tripDayId)
  if (error || !data) return
  await supabase
    .from("trip_days")
    .update({ daily_cost: dayCostFrom(data.map((row) => row.estimated_cost)) })
    .eq("id", tripDayId)
}
