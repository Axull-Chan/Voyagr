"use server"

import { revalidatePath } from "next/cache"

import { AiGenerationError, getAiProvider, type ItineraryRequest } from "@/lib/ai"
import { createClient } from "@/lib/supabase/server"
import { persistItinerary } from "@/features/trips/services/itinerary-writer"
import {
  createTripSchema,
  type CreateTripInput,
} from "@/features/trips/schemas/trip.schemas"

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
  }

  try {
    const itinerary = await getAiProvider().generateItinerary(request)
    await persistItinerary(supabase, trip.id, itinerary)

    await supabase
      .from("trips")
      .update({ title: itinerary.title, status: "ready" })
      .eq("id", trip.id)

    revalidatePath("/trips")
    revalidatePath("/dashboard")

    return { ok: true, tripId: trip.id, warnings: itinerary.warnings }
  } catch (error) {
    // Leave the trip recoverable rather than throwing away what they entered.
    await supabase.from("trips").update({ status: "draft" }).eq("id", trip.id)
    revalidatePath("/trips")

    const message =
      error instanceof AiGenerationError
        ? error.message
        : "We couldn't build your itinerary. Your trip was saved as a draft — try generating again."

    console.error("[createTripAction] itinerary generation failed", error)
    return { ok: false, error: message }
  }
}
