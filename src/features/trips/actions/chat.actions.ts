"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  AiGenerationError,
  getAiProvider,
  type ChatEditRequest,
  type ChatOperation,
  type SourcedContext,
} from "@/lib/ai"
import { createClient } from "@/lib/supabase/server"
import { sourcePlaces } from "@/services/places-service"
import {
  confirmAiQuota,
  reserveAiQuota,
} from "@/features/trips/services/ai-quota"
import {
  getTripChatContext,
  getTripChatHistory,
} from "@/features/trips/queries/trip-chat"
import {
  applyChatOperationsSchema,
  chatOperationsArraySchema,
  sendChatMessageSchema,
  type ApplyChatOperationsInput,
  type SendChatMessageInput,
} from "@/features/trips/schemas/chat.schemas"
import type { Database, Json } from "@/types/database.types"

type Client = SupabaseClient<Database>

/** A small constant — enough real candidates to ground one edit, not a whole
 * trip's worth (unlike `buildTripContext`, called once at creation). */
const CHAT_CANDIDATE_DAYS = 3

export type SendChatMessageResult =
  | {
      ok: true
      userMessageId: string
      assistantMessageId: string
      reply: string
      operations: ChatOperation[]
      warnings: string[]
    }
  | { ok: false; error: string }

/**
 * Sends one chat message and gets back a proposed edit. Never writes to
 * `activities`/`restaurants`/`trip_days` — only to the chat log itself, which
 * is not the same thing (see the migration's own comment). The itinerary is
 * only ever mutated by `applyChatOperationsAction`, once the user approves.
 */
export async function sendChatMessageAction(
  values: SendChatMessageInput
): Promise<SendChatMessageResult> {
  const parsed = sendChatMessageSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your message." }
  }
  const { tripId, message } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to do that." }
  }

  const context = await getTripChatContext(tripId)
  if (!context) {
    return { ok: false, error: "Trip not found." }
  }
  if (context.snapshot.days.length === 0) {
    return { ok: false, error: "This trip doesn't have an itinerary yet — generate one first." }
  }

  // After the cheap checks above (so a malformed or pointless request never takes
  // a slot) and before anything is saved or any provider is called.
  const quota = await reserveAiQuota(supabase, "chat_message")
  if (!quota.allowed) return { ok: false, error: quota.message }

  // Persisted before anything else can fail, same "leave what they entered
  // recoverable" philosophy as createTripAction.
  const { data: userRow, error: userInsertError } = await supabase
    .from("trip_chat_messages")
    .insert({ trip_id: tripId, role: "user", content: message })
    .select("id")
    .single()
  if (userInsertError || !userRow) {
    return { ok: false, error: "We couldn't save your message. Please try again." }
  }

  // Fresh candidates near the trip, for grounding a possible add-operation —
  // a small, one-off fetch, not the full geocode+places+weather+image
  // buildTripContext runs once at creation.
  let sourced: SourcedContext | null = null
  if (context.center) {
    const places = await sourcePlaces({
      latitude: context.center.lat,
      longitude: context.center.lng,
      interests: [],
      days: CHAT_CANDIDATE_DAYS,
    })
    if (places.data.attractions.length > 0 || places.data.restaurants.length > 0) {
      sourced = {
        latitude: context.center.lat,
        longitude: context.center.lng,
        resolvedName: context.snapshot.destination,
        attractions: places.data.attractions,
        restaurants: places.data.restaurants,
        hotels: places.data.hotels,
        weatherByDate: {},
      }
    }
  }

  const history = (await getTripChatHistory(tripId))
    .filter((m) => m.id !== userRow.id)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

  const request: ChatEditRequest = {
    tripId,
    message,
    history,
    itinerary: context.snapshot,
    sourced,
  }

  let reply: string
  let operations: ChatOperation[] = []
  let warnings: string[] = []
  let providerId: string | null = null

  try {
    const result = await getAiProvider().proposeItineraryEdit(request)
    reply = result.reply
    operations = result.operations
    warnings = result.warnings
    providerId = result.providerId
    // The provider answered, so the slot now counts. A failed turn (handled in the
    // catch below, which still saves an apology as the reply) is never confirmed
    // and its reservation lapses by itself.
    await confirmAiQuota(supabase, quota.usageId)
  } catch (error) {
    // A failed generation is still a coherent, worth-persisting chat entry —
    // "you asked, here's what went wrong" — not just a toast the user might
    // miss, so this still returns ok:true below.
    reply =
      error instanceof AiGenerationError
        ? error.message
        : "Something went wrong looking at your itinerary. Try again in a moment."
    console.error("[sendChatMessageAction] proposeItineraryEdit failed", error)
  }

  const { data: assistantRow, error: assistantInsertError } = await supabase
    .from("trip_chat_messages")
    .insert({
      trip_id: tripId,
      role: "assistant",
      content: reply,
      proposed_operations: operations.length > 0 ? (operations as unknown as Json) : null,
      provider_id: providerId,
    })
    .select("id")
    .single()
  if (assistantInsertError || !assistantRow) {
    return { ok: false, error: "We couldn't save the assistant's reply. Please try again." }
  }

  return {
    ok: true,
    userMessageId: userRow.id,
    assistantMessageId: assistantRow.id,
    reply,
    operations,
    warnings,
  }
}

/** `max(sort_order)+1` scoped to one day — append-at-end, for a new or moved
 * activity. Restaurants have no `sort_order` column at all, so no equivalent
 * is needed there. */
async function nextActivitySortOrder(supabase: Client, tripDayId: string): Promise<number> {
  const { data } = await supabase
    .from("activities")
    .select("sort_order")
    .eq("trip_day_id", tripDayId)
    .order("sort_order", { ascending: false })
    .limit(1)
  const max = data?.[0]?.sort_order
  return typeof max === "number" ? max + 1 : 0
}

export type ApplyChatOperationsResult =
  | {
      ok: true
      appliedCount: number
      skipped: { operation: ChatOperation; reason: string }[]
    }
  | { ok: false; error: string }

/**
 * The only action that writes to `activities`/`restaurants`/`trip_days`.
 *
 * Re-reads `proposed_operations` from the message row itself rather than
 * trusting a client-supplied payload — the server always re-validates
 * against its own stored state, never whatever JSON the client resends.
 */
export async function applyChatOperationsAction(
  values: ApplyChatOperationsInput
): Promise<ApplyChatOperationsResult> {
  const parsed = applyChatOperationsSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." }
  }
  const { tripId, messageId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to do that." }
  }

  const { data: messageRow } = await supabase
    .from("trip_chat_messages")
    .select("id, applied_at, proposed_operations")
    .eq("id", messageId)
    .eq("trip_id", tripId)
    .maybeSingle()

  if (!messageRow) {
    return { ok: false, error: "That proposal could not be found." }
  }
  if (messageRow.applied_at) {
    return { ok: false, error: "That change was already applied." }
  }
  if (!messageRow.proposed_operations) {
    return { ok: false, error: "There's nothing to apply for that message." }
  }

  const validated = chatOperationsArraySchema.safeParse(messageRow.proposed_operations)
  if (!validated.success) {
    return { ok: false, error: "That proposal's data looks corrupted and can't be applied." }
  }
  const operations = validated.data

  const { data: dayRows } = await supabase
    .from("trip_days")
    .select("id, day_number")
    .eq("trip_id", tripId)
  const dayIdByNumber = new Map<number, string>((dayRows ?? []).map((d) => [d.day_number, d.id]))

  let appliedCount = 0
  const skipped: { operation: ChatOperation; reason: string }[] = []

  // Sequential, not Promise.all — two operations can touch the same day, and
  // the user-approved order matters; the array is capped at 6, so this costs
  // nothing. No transaction wrapping, same documented limitation
  // itinerary-writer.ts already lives with (the Supabase client can't do
  // this) — the skip list is the honest reflection of that, not a false
  // all-or-nothing guarantee.
  for (const op of operations) {
    switch (op.kind) {
      case "add_activity": {
        const dayId = dayIdByNumber.get(op.dayNumber)
        if (!dayId) {
          skipped.push({ operation: op, reason: "That day no longer exists." })
          continue
        }
        const sortOrder = await nextActivitySortOrder(supabase, dayId)
        const { error } = await supabase.from("activities").insert({
          trip_day_id: dayId,
          time_slot: op.timeSlot,
          title: op.title,
          description: op.description,
          location_name: op.locationName,
          lat: op.lat,
          lng: op.lng,
          start_time: op.startTime,
          duration_minutes: op.durationMinutes,
          estimated_cost: op.estimatedCost,
          category: op.category,
          sort_order: sortOrder,
        })
        if (error) skipped.push({ operation: op, reason: "Couldn't save the new activity." })
        else appliedCount += 1
        break
      }
      case "add_restaurant": {
        const dayId = dayIdByNumber.get(op.dayNumber)
        if (!dayId) {
          skipped.push({ operation: op, reason: "That day no longer exists." })
          continue
        }
        const { error } = await supabase.from("restaurants").insert({
          trip_day_id: dayId,
          meal_type: op.mealType,
          name: op.name,
          cuisine: op.cuisine,
          lat: op.lat,
          lng: op.lng,
        })
        if (error) skipped.push({ operation: op, reason: "Couldn't save the new restaurant." })
        else appliedCount += 1
        break
      }
      case "remove_activity": {
        const { data } = await supabase
          .from("activities")
          .delete()
          .eq("id", op.activityId)
          .select("id")
        if (!data || data.length === 0) {
          skipped.push({ operation: op, reason: "Already removed." })
        } else {
          appliedCount += 1
        }
        break
      }
      case "remove_restaurant": {
        const { data } = await supabase
          .from("restaurants")
          .delete()
          .eq("id", op.restaurantId)
          .select("id")
        if (!data || data.length === 0) {
          skipped.push({ operation: op, reason: "Already removed." })
        } else {
          appliedCount += 1
        }
        break
      }
      case "move_activity": {
        const dayId = dayIdByNumber.get(op.toDayNumber)
        if (!dayId) {
          skipped.push({ operation: op, reason: "That day no longer exists." })
          continue
        }
        const sortOrder = await nextActivitySortOrder(supabase, dayId)
        const { data } = await supabase
          .from("activities")
          .update({ trip_day_id: dayId, time_slot: op.toTimeSlot, sort_order: sortOrder })
          .eq("id", op.activityId)
          .select("id")
        if (!data || data.length === 0) {
          skipped.push({ operation: op, reason: "That activity no longer exists." })
        } else {
          appliedCount += 1
        }
        break
      }
      case "reword_day_summary": {
        const dayId = dayIdByNumber.get(op.dayNumber)
        if (!dayId) {
          skipped.push({ operation: op, reason: "That day no longer exists." })
          continue
        }
        const { error } = await supabase
          .from("trip_days")
          .update({ summary: op.summary })
          .eq("id", dayId)
        if (error) skipped.push({ operation: op, reason: "Couldn't update the day summary." })
        else appliedCount += 1
        break
      }
    }
  }

  // Set regardless of partial skips — "we processed this" is distinct from
  // "every line item succeeded," and the skip list is what communicates the
  // difference; this also stops a confusing "click Apply again" loop once
  // everything in the proposal is already gone.
  await supabase
    .from("trip_chat_messages")
    .update({ applied_at: new Date().toISOString() })
    .eq("id", messageId)

  revalidatePath(`/trips/${tripId}`)

  return { ok: true, appliedCount, skipped }
}
