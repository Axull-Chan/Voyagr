import { z } from "zod"

import { MEAL_TYPES, TIME_SLOTS } from "@/lib/trips/trip-domain"

/** `z.enum` needs a non-empty tuple; see trip.schemas.ts for the same helper. */
function enumOf<T extends string>(values: readonly T[]) {
  return z.enum(values as [T, ...T[]])
}

export const sendChatMessageSchema = z.object({
  tripId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(1, "Say what you'd like to change.")
    .max(500, "Keep messages under 500 characters."),
})
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>

export const applyChatOperationsSchema = z.object({
  tripId: z.string().uuid(),
  messageId: z.string().uuid(),
})
export type ApplyChatOperationsInput = z.infer<typeof applyChatOperationsSchema>

/**
 * Validates the `proposed_operations` jsonb blob read back from a chat
 * message row before trusting its shape — an internal validation boundary,
 * unrelated to the Gemini/OpenAI request schema dialects in the provider
 * layer. Mirrors `ChatOperation` from `lib/ai/types.ts` field for field.
 */
export const chatOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_activity"),
    dayNumber: z.number().int().min(1),
    timeSlot: enumOf(TIME_SLOTS),
    title: z.string(),
    description: z.string(),
    locationName: z.string(),
    lat: z.number(),
    lng: z.number(),
    // Nullable since activity placement (older stored proposals always carry a string).
    startTime: z.string().nullable(),
    durationMinutes: z.number().int().min(0),
    estimatedCost: z.number().min(0),
    category: z.string(),
  }),
  z.object({
    kind: z.literal("remove_activity"),
    activityId: z.string().uuid(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("move_activity"),
    activityId: z.string().uuid(),
    label: z.string(),
    toDayNumber: z.number().int().min(1),
    toTimeSlot: enumOf(TIME_SLOTS),
    // Optional: proposals stored before this field existed don't carry it.
    toStartTime: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal("add_restaurant"),
    dayNumber: z.number().int().min(1),
    mealType: enumOf(MEAL_TYPES),
    name: z.string(),
    cuisine: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  z.object({
    kind: z.literal("remove_restaurant"),
    restaurantId: z.string().uuid(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("reword_day_summary"),
    dayNumber: z.number().int().min(1),
    summary: z.string(),
  }),
])

export const chatOperationsArraySchema = z.array(chatOperationSchema).max(6)
