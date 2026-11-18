"use server"

import { revalidatePath } from "next/cache"

import { AiGenerationError, getAiProvider, type ItineraryRequest } from "@/lib/ai"
import { createClient } from "@/lib/supabase/server"
import { buildTripContext } from "@/services/itinerary-service"
import { recordImageUse } from "@/services/image-service"
import { persistItinerary } from "@/features/trips/services/itinerary-writer"
import { createBlankItinerary } from "@/features/trips/services/blank-itinerary"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  confirmAiQuota,
  reserveAiQuota,
} from "@/features/trips/services/ai-quota"
import {
  createTripSchema,
  type CreateTripInput,
} from "@/features/trips/schemas/trip.schemas"

export type CreateTripResult =
  | { ok: true; tripId: string; warnings: string[] }
  | { ok: false; error: string }

/**
 * The `trips` row for what the wizard collected. Shared by both ways of starting a
 * trip so the two can never store the same answers differently.
 */
function tripRow(
  userId: string,
  input: CreateTripInput,
  status: "draft" | "generating"
) {
  return {
    user_id: userId,
    // A placeholder until a generated itinerary proposes a better one.
    title: `Trip to ${input.destination}`,
    destination: input.destination,
    starting_city: input.startingCity?.trim() || null,
    start_date: input.startDate,
    end_date: input.endDate,
    travelers: input.travelers,
    budget: input.budget,
    currency: input.currency,
    travel_style: input.travelStyle,
    accommodation: input.accommodation,
    transportation: input.transportation,
    interests: input.interests,
    additional_notes: input.notes?.trim() || null,
    status,
  }
}

/**
 * Creates a trip with every day set up and nothing scheduled in it, for a traveller
 * who wants to plan it themselves.
 *
 * No model is involved: it never reserves AI quota, never calls a provider, and never
 * writes a made-up place. It does what is free and real — the forecast for each date
 * and a destination photo — so the trip looks like any other. The same wizard answers
 * are stored (budget, currency, party size, notes), so budget tracking works as usual.
 *
 * Written as a `draft` first and flipped to `ready` once its days exist, so a failure
 * part-way leaves a trip the traveller can finish with "plan it by hand" rather than
 * a trip with no way forward.
 */
export async function createEmptyTripAction(
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

  const { data: trip, error: insertError } = await supabase
    .from("trips")
    .insert(tripRow(user.id, input, "draft"))
    .select("id, destination, start_date, end_date, cover_image_url")
    .single()
  if (insertError || !trip) {
    return { ok: false, error: "We couldn't save your trip. Please try again." }
  }

  const blank = await createBlankItinerary(supabase, trip)
  revalidatePath("/trips")
  revalidatePath("/dashboard")

  if (!blank.ok) {
    // The trip row exists, as a draft. Reporting a failure here would leave the
    // traveller on the wizard, one click from creating a duplicate; taking them to
    // the draft instead puts a "Plan it by hand" button in front of them that
    // finishes the same job.
    return { ok: true, tripId: trip.id, warnings: [blank.error] }
  }
  return { ok: true, tripId: trip.id, warnings: blank.notices }
}

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
    .insert(tripRow(user.id, input, "generating"))
    .select("id")
    .single()

  if (insertError || !trip) {
    return { ok: false, error: "We couldn't save your trip. Please try again." }
  }

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
    await confirmAiQuota(supabase, quota.usageId)
    await persistItinerary(supabase, trip.id, itinerary)

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
      .eq("id", trip.id)

    // Unsplash requires a usage ping when a photo is actually adopted, which
    // is here — once per trip — rather than on every page view.
    if (context.image) await recordImageUse(context.image)

    revalidatePath("/trips")
    revalidatePath("/dashboard")

    // Context notices ("photos aren't connected") matter to the user as much
    // as the planner's own warnings, so they surface together.
    return {
      ok: true,
      tripId: trip.id,
      warnings: [...context.notices, ...itinerary.warnings],
    }
  } catch (error) {
    // Leave the trip recoverable rather than throwing away what they entered.
    await supabase.from("trips").update({ status: "draft" }).eq("id", trip.id)
    revalidatePath("/trips")

    const message =
      error instanceof AiGenerationError
        ? error.message
        : "We couldn't build your itinerary. Your trip was saved as a draft — try generating again."

    await reportServerError(error, { context: "action:createTrip" })
    return { ok: false, error: message }
  }
}
