"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  renameTripSchema,
  tripIdSchema,
  type RenameTripInput,
} from "@/features/trips/schemas/trip-management.schemas"

export type TripManagementResult = { ok: true } | { ok: false; error: string }
export type DuplicateTripResult =
  | { ok: true; tripId: string }
  | { ok: false; error: string }

/**
 * Rename, archive/restore and duplicate.
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
