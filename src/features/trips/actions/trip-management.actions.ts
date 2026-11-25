"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  renameTripSchema,
  shiftTripDatesSchema,
  tripIdSchema,
  updateTripBudgetSchema,
  type RenameTripInput,
  type ShiftTripDatesInput,
  type UpdateTripBudgetInput,
} from "@/features/trips/schemas/trip-management.schemas"
import {
  budgetEditBlockedReason,
  dateShiftBlockedReason,
  isoToday,
} from "@/features/trips/services/trip-edit"
import { syncItineraryCosts } from "@/features/trips/services/itinerary-cost-sync"
import { deleteBlockedReason } from "@/features/trips/services/trip-delete"
import { bookingBlockReason, type BookingBlockedAction } from "@/lib/bookings/booking-guards"
import { recoverStaleGeneration } from "@/features/trips/services/generation-recovery"

export type TripManagementResult = { ok: true } | { ok: false; error: string }
export type DuplicateTripResult =
  | { ok: true; tripId: string }
  | { ok: false; error: string }

/**
 * Rename, archive/restore, duplicate and delete.
 *
 * Ownership is enforced by RLS, the same as every other action in this
 * feature: each mutation is scoped by id alone, and a trip that isn't the
 * caller's simply matches no row. That is checked explicitly below (via the
 * returned row) rather than assumed, because Supabase reports an update that
 * matched nothing as a success.
 */

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

function revalidateTripViews(tripId: string) {
  revalidatePath(`/trips/${tripId}`)
  revalidatePath("/trips")
  revalidatePath("/dashboard")
}

/**
 * Why a hotel booking forbids `action` on this trip, or null. Asked before the
 * write so the answer is immediate and in plain words; the database refuses
 * the same thing regardless (migration 20261125090000_add_hotel_bookings.sql).
 * A failed read returns null and leaves the refusal to the database.
 */
async function activeBookingBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  action: BookingBlockedAction
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hotel_bookings")
    .select("status, check_out")
    .eq("trip_id", tripId)
  if (error) return null
  return bookingBlockReason(action, data ?? [], isoToday())
}

export async function renameTripAction(
  input: RenameTripInput
): Promise<TripManagementResult> {
  const parsed = renameTripSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the name.",
    }
  }
  const { tripId, title } = parsed.data

  const { supabase, user } = await requireUser()
  if (!user) {
    return { ok: false, error: "You need to be signed in to rename a trip." }
  }

  const { data, error } = await supabase
    .from("trips")
    .update({ title })
    .eq("id", tripId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, error: "We couldn't rename that trip. Please try again." }
  }
  if (!data) return { ok: false, error: "That trip no longer exists." }

  revalidateTripViews(tripId)
  return { ok: true }
}

/**
 * Archiving hides a trip from the dashboard and the main list without
 * deleting anything; restoring puts it back.
 *
 * `status` is one column doing two jobs — lifecycle (`draft`/`generating`/
 * `ready`) and shelving (`archived`) — so archiving overwrites what the trip
 * was. Restoring therefore has to *recompute* the lifecycle state rather than
 * remember it: a trip with an itinerary is `ready`, one without is `draft`.
 * That is exactly what the value was before in every case this app can
 * produce, since `generating` is refused below.
 *
 * A trip that is mid-generation is not archivable. Its row is still being
 * written by `createTripAction`, which sets `ready` when it finishes, and
 * would silently un-archive it.
 */
export async function setTripArchivedAction(
  tripId: string,
  archived: boolean
): Promise<TripManagementResult> {
  if (!tripIdSchema.safeParse(tripId).success) {
    return { ok: false, error: "That trip couldn't be found." }
  }

  const { supabase, user } = await requireUser()
  if (!user) {
    return { ok: false, error: "You need to be signed in to change a trip." }
  }

  // A trip whose generation was killed is a draft, not "still generating".
  await recoverStaleGeneration(supabase, tripId)

  const { data: trip, error: readError } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .maybeSingle()
  if (readError) {
    return { ok: false, error: "We couldn't update that trip. Please try again." }
  }
  if (!trip) return { ok: false, error: "That trip no longer exists." }

  if (trip.status === "generating") {
    return {
      ok: false,
      error: "This trip is still being generated. Try again in a moment.",
    }
  }

  let nextStatus: "archived" | "ready" | "draft" = "archived"
  if (!archived) {
    const { count, error: countError } = await supabase
      .from("trip_days")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
    if (countError) {
      return {
        ok: false,
        error: "We couldn't restore that trip. Please try again.",
      }
    }
    nextStatus = (count ?? 0) > 0 ? "ready" : "draft"
  }

  // Compare-and-set on the status we just read: if generation started between
  // the read and this write, the update matches nothing instead of clobbering it.
  const { data: updated, error } = await supabase
    .from("trips")
    .update({ status: nextStatus })
    .eq("id", tripId)
    .eq("status", trip.status)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, error: "We couldn't update that trip. Please try again." }
  }
  if (!updated) {
    return {
      ok: false,
      error: "That trip just changed. Refresh the page and try again.",
    }
  }

  revalidateTripViews(tripId)
  return { ok: true }
}

export async function duplicateTripAction(
  tripId: string
): Promise<DuplicateTripResult> {
  if (!tripIdSchema.safeParse(tripId).success) {
    return { ok: false, error: "That trip couldn't be found." }
  }

  const { supabase, user } = await requireUser()
  if (!user) {
    return { ok: false, error: "You need to be signed in to duplicate a trip." }
  }

  // `duplicate_trip` refuses a stored `generating` status (55000); a stale one
  // is recovered first so a killed generation doesn't block it forever.
  await recoverStaleGeneration(supabase, tripId)

  // One transactional database function rather than a chain of client calls —
  // see the migration for why. It raises with a user-facing message for the
  // cases a person can act on (not found, still generating).
  const { data, error } = await supabase.rpc("duplicate_trip", {
    source_trip_id: tripId,
  })

  if (error || !data) {
    const actionable =
      error?.code === "P0002" || error?.code === "55000"
    if (!actionable) await reportServerError(error, { context: "action:duplicateTrip" })
    return {
      ok: false,
      error: actionable
        ? error.message
        : "We couldn't duplicate that trip. Please try again.",
    }
  }

  revalidatePath("/trips")
  revalidatePath("/dashboard")
  return { ok: true, tripId: data }
}

/**
 * Permanently deletes a trip and everything under it.
 *
 * Every table that references `trips` does so `on delete cascade` (days and
 * their activities/restaurants/weather, hotels, transportation, notes, packing,
 * budget, expenses, chat messages), so one `delete` removes the lot atomically.
 * `favorites.trip_id` is `on delete set null`: saved places outlive the trip.
 *
 * Ownership is enforced twice: by the `trips_delete_own` RLS policy, and by an
 * explicit `user_id` filter here so the intent is readable and still holds if
 * the client is ever swapped for one that bypasses RLS.
 *
 * The delete is itself a compare-and-set against `generating` (`neq`), not just
 * the up-front read, so a generation that starts between the two cannot have
 * its trip pulled out from under it. Supabase reports a delete that matched
 * nothing as a success, hence `select("id")` to see what was actually removed.
 *
 * Deliberately does NOT revalidate `/trips/:id`: the caller is on that page, and
 * re-rendering a trip that no longer exists would flash a 404 before the
 * client's redirect to `/trips` lands.
 */
export async function deleteTripAction(
  tripId: string
): Promise<TripManagementResult> {
  if (!tripIdSchema.safeParse(tripId).success) {
    return { ok: false, error: "That trip couldn't be found." }
  }

  const { supabase, user } = await requireUser()
  if (!user) {
    return { ok: false, error: "You need to be signed in to delete a trip." }
  }

  await recoverStaleGeneration(supabase, tripId)

  const { data: trip, error: readError } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (readError) {
    await reportServerError(readError, { context: "action:deleteTrip:read" })
    return { ok: false, error: "We couldn't delete that trip. Please try again." }
  }
  if (!trip) return { ok: false, error: "That trip no longer exists." }

  const blocked = deleteBlockedReason(trip.status) ?? (await activeBookingBlock(supabase, tripId, "deleteTrip"))
  if (blocked) return { ok: false, error: blocked }

  const { data: deleted, error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("user_id", user.id)
    .neq("status", "generating")
    .select("id")
    .maybeSingle()

  if (error) {
    // The database's own booking guard (trips_no_delete_with_active_booking).
    if (error.code === "55000") return { ok: false, error: error.message }
    await reportServerError(error, { context: "action:deleteTrip" })
    return { ok: false, error: "We couldn't delete that trip. Please try again." }
  }
  if (!deleted) {
    return {
      ok: false,
      error: "That trip just changed. Refresh the page and try again.",
    }
  }

  revalidatePath("/trips")
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Moves the whole trip to a new start date, keeping its length.
 *
 * The work is one database function, `shift_trip_dates`, so the trip, its
 * days, the stay, any transport, the stale stored weather and pending replan
 * proposals all change together or not at all (see its migration). The same
 * rules are checked here first only to answer quickly and in plain words; the
 * function enforces them regardless, against the database's own `current_date`.
 * Expenses keep their dates: they record when money was actually spent.
 */
export async function shiftTripDatesAction(
  input: ShiftTripDatesInput
): Promise<TripManagementResult> {
  const parsed = shiftTripDatesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Choose a new start date." }
  }
  const { tripId, startDate } = parsed.data

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in to change a trip's dates." }

  const { data: trip, error: readError } = await supabase
    .from("trips")
    .select("status, start_date, end_date")
    .eq("id", tripId)
    .maybeSingle()
  if (readError) {
    await reportServerError(readError, { context: "action:shiftTripDates:read" })
    return { ok: false, error: "We couldn't change the dates. Please try again." }
  }
  if (!trip) return { ok: false, error: "That trip no longer exists." }

  const blocked = dateShiftBlockedReason(
    { status: trip.status, startDate: trip.start_date, endDate: trip.end_date },
    startDate,
    isoToday()
  ) ?? (await activeBookingBlock(supabase, tripId, "shiftDates"))
  if (blocked) return { ok: false, error: blocked }

  const { error } = await supabase.rpc("shift_trip_dates", {
    p_trip_id: tripId,
    p_new_start: startDate,
  })
  if (error) {
    // The function's own refusals carry a user-facing message.
    const userFacing = error.code === "22023" || error.code === "55000"
    if (error.code === "P0002") return { ok: false, error: "That trip no longer exists." }
    if (userFacing) return { ok: false, error: error.message }
    await reportServerError(error, { context: "action:shiftTripDates" })
    return { ok: false, error: "We couldn't change the dates. Please try again." }
  }

  revalidateTripViews(tripId)
  return { ok: true }
}

/**
 * Sets (or clears) the trip's budget, keeping its currency, then re-derives the
 * planned budget lines from it (`syncItineraryCosts`), so the Budget section's
 * plan and "Remaining" follow. Refused while generating: generation writes the
 * budget lines itself when it finishes, from the budget it started with.
 */
export async function updateTripBudgetAction(
  input: UpdateTripBudgetInput
): Promise<TripManagementResult> {
  const parsed = updateTripBudgetSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the amount." }
  }
  const { tripId, budget } = parsed.data

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in to change a trip." }

  const { data: trip, error: readError } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .maybeSingle()
  if (readError) {
    await reportServerError(readError, { context: "action:updateTripBudget:read" })
    return { ok: false, error: "We couldn't update the budget. Please try again." }
  }
  if (!trip) return { ok: false, error: "That trip no longer exists." }
  const blocked = budgetEditBlockedReason(trip.status)
  if (blocked) return { ok: false, error: blocked }

  // Compare-and-set against generating, like archive and delete.
  const { data: updated, error } = await supabase
    .from("trips")
    .update({ budget })
    .eq("id", tripId)
    .neq("status", "generating")
    .select("id")
    .maybeSingle()
  if (error) {
    await reportServerError(error, { context: "action:updateTripBudget" })
    return { ok: false, error: "We couldn't update the budget. Please try again." }
  }
  if (!updated) return { ok: false, error: "That trip just changed. Refresh the page and try again." }

  const sync = await syncItineraryCosts(supabase, tripId)
  if (!sync.ok) {
    // The budget itself is saved; only the derived plan lines lag until the next edit.
    await reportServerError(new Error("Budget lines resync failed after a budget edit"), {
      context: "action:updateTripBudget:sync",
      severity: "warning",
    })
  }

  revalidateTripViews(tripId)
  return { ok: true }
}
