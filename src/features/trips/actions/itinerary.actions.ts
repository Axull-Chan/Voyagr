"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  addActivitySchema,
  deleteActivitySchema,
  moveActivitySchema,
  startManualItinerarySchema,
  updateActivitySchema,
  type AddActivityInput,
  type DeleteActivityInput,
  type MoveActivityInput,
  type UpdateActivityInput,
} from "@/features/trips/schemas/itinerary.schemas"
import {
  dayBelongsToTrip,
  findActivityInTrip,
  loadEditableTrip,
  nextActivitySortOrder,
  refreshDayCost,
} from "@/features/trips/services/activity-store"
import { createBlankItinerary } from "@/features/trips/services/blank-itinerary"
import { reorderWithinSlot } from "@/features/trips/services/itinerary-edit"

export type ItineraryActionResult = { ok: true } | { ok: false; error: string }

/**
 * Manual itinerary editing: add, change, remove and reorder activities by hand.
 *
 * Nothing here calls a model or reserves AI quota — this is the part of the product
 * a traveller can always use, however the trip was started.
 *
 * Every action follows the same order: validate the input, require a signed-in user,
 * confirm the trip exists for that user and is in a state that can be edited, and
 * confirm the day or activity really belongs to THAT trip. Row Level Security decides
 * whose rows are visible at all; the trip check is what stops an edit landing on a
 * trip that is mid-generation (the generator would erase it) or archived.
 */

async function currentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

const SIGN_IN = "You need to be signed in to edit an itinerary."

export async function addActivityAction(
  input: AddActivityInput
): Promise<ItineraryActionResult> {
  const parsed = addActivitySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the activity details.",
    }
  }
  const { tripId, dayId, ...fields } = parsed.data

  const { supabase, user } = await currentUser()
  if (!user) return { ok: false, error: SIGN_IN }

  const trip = await loadEditableTrip(supabase, tripId)
  if (!trip.ok) return trip
  if (!(await dayBelongsToTrip(supabase, dayId, tripId))) {
    return { ok: false, error: "That day couldn't be found." }
  }

  const { error } = await supabase.from("activities").insert({
    trip_day_id: dayId,
    time_slot: fields.timeSlot,
    title: fields.title,
    description: fields.description || null,
    location_name: fields.locationName || null,
    start_time: fields.startTime,
    duration_minutes: fields.durationMinutes,
    estimated_cost: fields.estimatedCost,
    // Coordinates, travel time and walking distance stay null on purpose: nothing
    // has resolved this place, so there is nothing true to put there.
    sort_order: await nextActivitySortOrder(supabase, dayId),
  })
  if (error) {
    await reportServerError(error, { context: "action:addActivity" })
    return { ok: false, error: "We couldn't save that activity. Please try again." }
  }

  await refreshDayCost(supabase, dayId)
  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function updateActivityAction(
  input: UpdateActivityInput
): Promise<ItineraryActionResult> {
  const parsed = updateActivitySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the activity details.",
    }
  }
  const { tripId, activityId, ...fields } = parsed.data

  const { supabase, user } = await currentUser()
  if (!user) return { ok: false, error: SIGN_IN }

  const trip = await loadEditableTrip(supabase, tripId)
  if (!trip.ok) return trip
  const activity = await findActivityInTrip(supabase, activityId, tripId)
  if (!activity) return { ok: false, error: "That activity couldn't be found." }

  const { data, error } = await supabase
    .from("activities")
    .update({
      time_slot: fields.timeSlot,
      title: fields.title,
      description: fields.description || null,
      location_name: fields.locationName || null,
      start_time: fields.startTime,
      duration_minutes: fields.durationMinutes,
      estimated_cost: fields.estimatedCost,
    })
    .eq("id", activityId)
    .select("id")
  if (error) {
    await reportServerError(error, { context: "action:updateActivity" })
    return { ok: false, error: "We couldn't update that activity. Please try again." }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "That activity couldn't be found." }
  }

  await refreshDayCost(supabase, activity.tripDayId)
  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function deleteActivityAction(
  input: DeleteActivityInput
): Promise<ItineraryActionResult> {
  const parsed = deleteActivitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request." }
  const { tripId, activityId } = parsed.data

  const { supabase, user } = await currentUser()
  if (!user) return { ok: false, error: SIGN_IN }

  const trip = await loadEditableTrip(supabase, tripId)
  if (!trip.ok) return trip
  const activity = await findActivityInTrip(supabase, activityId, tripId)
  if (!activity) return { ok: false, error: "That activity was already removed." }

  const { data, error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId)
    .select("id")
  if (error) {
    await reportServerError(error, { context: "action:deleteActivity" })
    return { ok: false, error: "We couldn't remove that activity. Please try again." }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "That activity was already removed." }
  }

  await refreshDayCost(supabase, activity.tripDayId)
  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

/**
 * Moves an activity one place earlier or later among the activities in the same
 * time of day. The new order is computed from the database's current state (not from
 * whatever order the browser was showing), so two quick clicks or two open tabs
 * converge instead of fighting.
 *
 * Not atomic: the Supabase client has no transactions, so a failure after the first of
 * the two writes leaves two activities sharing a position. That is harmless — ties are
 * broken deterministically by `orderActivities` — and the next move tidies it.
 */
export async function moveActivityAction(
  input: MoveActivityInput
): Promise<ItineraryActionResult> {
  const parsed = moveActivitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request." }
  const { tripId, activityId, direction } = parsed.data

  const { supabase, user } = await currentUser()
  if (!user) return { ok: false, error: SIGN_IN }

  const trip = await loadEditableTrip(supabase, tripId)
  if (!trip.ok) return trip
  const activity = await findActivityInTrip(supabase, activityId, tripId)
  if (!activity) return { ok: false, error: "That activity couldn't be found." }

  const { data: siblings, error: readError } = await supabase
    .from("activities")
    .select("id, time_slot, sort_order, created_at")
    .eq("trip_day_id", activity.tripDayId)
  if (readError || !siblings) {
    await reportServerError(readError ?? new Error("no rows"), {
      context: "action:moveActivity",
    })
    return { ok: false, error: "We couldn't reorder that. Please try again." }
  }

  const updates = reorderWithinSlot(siblings, activityId, direction)
  // Already first or last: not an error, just nothing to do.
  if (!updates || updates.length === 0) return { ok: true }

  for (const update of updates) {
    const { error } = await supabase
      .from("activities")
      .update({ sort_order: update.sortOrder })
      .eq("id", update.id)
    if (error) {
      await reportServerError(error, { context: "action:moveActivity" })
      return { ok: false, error: "We couldn't reorder that. Please try again." }
    }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

/**
 * Starts a draft trip that has no itinerary as a blank one the traveller fills in.
 * This is the way out of a draft left behind by a failed generation, and what the
 * "plan it by hand" button on such a trip calls.
 */
export async function startManualItineraryAction(
  tripId: string
): Promise<ItineraryActionResult> {
  const parsed = startManualItinerarySchema.safeParse({ tripId })
  if (!parsed.success) return { ok: false, error: "Invalid request." }

  const { supabase, user } = await currentUser()
  if (!user) return { ok: false, error: SIGN_IN }

  const { data: trip } = await supabase
    .from("trips")
    .select("id, status, destination, start_date, end_date, cover_image_url")
    .eq("id", parsed.data.tripId)
    .maybeSingle()
  if (!trip) return { ok: false, error: "That trip couldn't be found." }
  if (trip.status !== "draft") {
    return { ok: false, error: "This trip already has an itinerary." }
  }

  const result = await createBlankItinerary(supabase, trip)
  if (!result.ok) return result

  revalidatePath(`/trips/${trip.id}`)
  revalidatePath("/trips")
  revalidatePath("/dashboard")
  return { ok: true }
}
