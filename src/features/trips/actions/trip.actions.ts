"use server"

import { revalidatePath } from "next/cache"

import { AiGenerationError, getAiProvider, type ItineraryRequest } from "@/lib/ai"
import { createClient } from "@/lib/supabase/server"
import { buildTripContext } from "@/services/itinerary-service"
import { recordImageUse } from "@/services/image-service"
import { persistItinerary } from "@/features/trips/services/itinerary-writer"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  confirmAiQuota,
  reserveAiQuota,
} from "@/features/trips/services/ai-quota"
import {
  createTripSchema,
  type CreateTripInput,
} from "@/features/trips/schemas/trip.schemas"
import { tripIdSchema } from "@/features/trips/schemas/trip-management.schemas"
import {
  effectiveTripStatus,
  regenerateBlockedReason,
  tripRowToCreateInput,
} from "@/features/trips/services/generation-state"
import { recoverStaleGeneration } from "@/features/trips/services/generation-recovery"

export type CreateTripResult =
  | { ok: true; tripId: string; warnings: string[] }
  | { ok: false; error: string }

/**
 * Creates a trip and fills it with a generated itinerary.
 *
 * The trip row is written *before* generation, at status `generating`, so a
 * slow or failed model still leaves the user something they own and can retry
 * from — and so this same shape works unchanged when generation later moves to
 * a background job against a real provider. On failure the trip drops back to
 * `draft` rather than being deleted, because silently discarding a user's
 * input is worse than leaving them a trip to retry.
 */
export async function createTripAction(
  values: CreateTripInput
): Promise<CreateTripResult> {
  const parsed = createTripSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, error: "Please check the form for errors." }
  }
  const input = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to create a trip." }
  }

  // Before anything is written or any provider is called: a traveller over their
  // limit should cost us neither a trip row nor a model request.
  const quota = await reserveAiQuota(supabase, "trip_generation")
  if (!quota.allowed) return { ok: false, error: quota.message }

  const startingCity = input.startingCity?.trim() || null
  const notes = input.notes?.trim() || null

  const { data: trip, error: insertError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      // A placeholder until the provider proposes a better one below.
      title: `Trip to ${input.destination}`,
      destination: input.destination,
      starting_city: startingCity,
      start_date: input.startDate,
      end_date: input.endDate,
      travelers: input.travelers,
      budget: input.budget,
      currency: input.currency,
      travel_style: input.travelStyle,
      accommodation: input.accommodation,
      transportation: input.transportation,
      interests: input.interests,
      additional_notes: notes,
      status: "generating",
    })
    .select("id")
    .single()

  if (insertError || !trip) {
    return { ok: false, error: "We couldn't save your trip. Please try again." }
  }

  return generateIntoTrip({
    supabase,
    tripId: trip.id,
    input,
    usageId: quota.usageId,
    context: "action:createTrip",
  })
}

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Builds and stores an itinerary for a trip already marked `generating`.
 * Shared by creation and regeneration so both leave the same states: `ready`
 * on success, `draft` on any caught failure. (An uncaught kill — the platform
 * timeout — is handled by treating stale `generating` rows as drafts; see
 * `services/generation-state.ts`.)
 */
async function generateIntoTrip(args: {
  supabase: ServerClient
  tripId: string
  input: CreateTripInput
  usageId: number | null
  context: string
}): Promise<CreateTripResult> {
  const { supabase, tripId, input, usageId, context: reportContext } = args
  const startingCity = input.startingCity?.trim() || null
  const notes = input.notes?.trim() || null

  try {
    // Real-world data first: coordinates, listed venues, live forecast and a
    // destination photo. Each degrades independently, so a missing photo or
    // an unreachable places API still yields a usable itinerary.
    const context = await buildTripContext({
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      interests: input.interests,
    })

    const request: ItineraryRequest = {
      destination: input.destination,
      startingCity,
      startDate: input.startDate,
      endDate: input.endDate,
      travelers: input.travelers,
      budget: input.budget,
      currency: input.currency,
      travelStyle: input.travelStyle,
      interests: input.interests,
      accommodation: input.accommodation,
      transportation: input.transportation,
      notes,
      sourced: context.sourced,
    }

    const itinerary = await getAiProvider().generateItinerary(request)
    // The model call succeeded, so the slot now counts. Done before persisting:
    // the request has been spent whether or not our own write goes well.
    await confirmAiQuota(supabase, usageId)
    await persistItinerary(supabase, tripId, itinerary)

    await supabase
      .from("trips")
      .update({
        title: itinerary.title,
        status: "ready",
        cover_image_url: context.image?.url ?? null,
        // Stored alongside the URL, not derived later: the licence requires a
        // visible credit wherever the photo appears, and the trip page renders
        // from these rows rather than from a live API response.
        cover_image_credit_name:
          context.image?.attribution.photographerName ?? null,
        cover_image_credit_url:
          context.image?.attribution.photographerUrl ?? null,
        cover_image_link: context.image?.attribution.photoUrl ?? null,
      })
      .eq("id", tripId)

    // Unsplash requires a usage ping when a photo is actually adopted, which
    // is here — once per trip — rather than on every page view.
    if (context.image) await recordImageUse(context.image)

    revalidatePath("/trips")
    revalidatePath("/dashboard")
    revalidatePath(`/trips/${tripId}`)

    // Context notices ("photos aren't connected") matter to the user as much
    // as the planner's own warnings, so they surface together.
    return {
      ok: true,
      tripId,
      warnings: [...context.notices, ...itinerary.warnings],
    }
  } catch (error) {
    // Leave the trip recoverable rather than throwing away what they entered.
    await supabase.from("trips").update({ status: "draft" }).eq("id", tripId)
    revalidatePath("/trips")
    revalidatePath(`/trips/${tripId}`)

    const message =
      error instanceof AiGenerationError
        ? error.message
        : "We couldn't build your itinerary. Your trip was saved as a draft — try generating again."

    await reportServerError(error, { context: reportContext })
    return { ok: false, error: message }
  }
}

/**
 * Generates an itinerary for an existing `draft` trip — one whose first
 * generation failed or was killed — from the details already stored on it.
 *
 * A trip stuck at `generating` past any possible request lifetime is first
 * recovered to `draft`. The switch back to `generating` is a compare-and-set on
 * `draft`, so two clicks (or two tabs) cannot run two generations for one trip.
 */
export async function regenerateTripAction(tripId: string): Promise<CreateTripResult> {
  if (!tripIdSchema.safeParse(tripId).success) {
    return { ok: false, error: "That trip couldn't be found." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to generate an itinerary." }
  }

  await recoverStaleGeneration(supabase, tripId)

  const { data: row, error: readError } = await supabase
    .from("trips")
    .select(
      "status, updated_at, destination, starting_city, start_date, end_date, travelers, budget, currency, travel_style, interests, accommodation, transportation, additional_notes"
    )
    .eq("id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (readError) {
    await reportServerError(readError, { context: "action:regenerateTrip:read" })
    return { ok: false, error: "We couldn't load that trip. Please try again." }
  }
  if (!row) return { ok: false, error: "That trip no longer exists." }

  const blocked = regenerateBlockedReason(effectiveTripStatus(row.status, row.updated_at, Date.now()))
  if (blocked) return { ok: false, error: blocked }

  const parsed = createTripSchema.safeParse(tripRowToCreateInput(row))
  if (!parsed.success) {
    return {
      ok: false,
      error: "This trip is missing details needed to plan it. Create a new trip instead.",
    }
  }

  const quota = await reserveAiQuota(supabase, "trip_generation")
  if (!quota.allowed) return { ok: false, error: quota.message }

  const { data: claimed, error: claimError } = await supabase
    .from("trips")
    .update({ status: "generating" })
    .eq("id", tripId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle()
  if (claimError) {
    await reportServerError(claimError, { context: "action:regenerateTrip:claim" })
    return { ok: false, error: "We couldn't start generating. Please try again." }
  }
  if (!claimed) {
    return { ok: false, error: "That trip just changed. Refresh the page and try again." }
  }

  return generateIntoTrip({
    supabase,
    tripId,
    input: parsed.data,
    usageId: quota.usageId,
    context: "action:regenerateTrip",
  })
}
