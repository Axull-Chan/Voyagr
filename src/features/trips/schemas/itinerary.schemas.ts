import { z } from "zod"

import { TIME_SLOTS } from "@/lib/trips/trip-domain"

function enumOf<T extends string>(values: readonly T[]) {
  return z.enum(values as unknown as [T, ...T[]])
}

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""))

/**
 * The fields a traveller can set on an activity by hand.
 *
 * Deliberately a subset of the `activities` columns. Coordinates, travel time and
 * walking distance are NOT here: they describe a real, resolved place, and a person
 * typing a venue name into a box has not resolved one. Leaving them null means a
 * manual activity simply has no map pin and no "est. km walk" — rather than a
 * guessed location that could put a pin in the wrong city.
 *
 * The form sends `null` (not "") for a number or time left blank.
 */
export const activityFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the activity a title.")
    .max(120, "Keep the title under 120 characters."),
  timeSlot: enumOf(TIME_SLOTS),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.")
    .nullable(),
  durationMinutes: z
    .number({ invalid_type_error: "Enter the length in minutes." })
    .int("Whole minutes only.")
    .min(5, "At least 5 minutes.")
    .max(1440, "An activity can't be longer than a day.")
    .nullable(),
  estimatedCost: z
    .number({ invalid_type_error: "Enter a cost, or leave it blank." })
    .min(0, "Cost can't be negative.")
    .max(1_000_000, "That cost is unrealistically large.")
    .nullable(),
  locationName: optionalText(120, "Keep the place name under 120 characters."),
  description: optionalText(500, "Keep notes under 500 characters."),
})

export type ActivityFields = z.infer<typeof activityFieldsSchema>

export const addActivitySchema = activityFieldsSchema.extend({
  tripId: z.string().uuid(),
  dayId: z.string().uuid(),
})
export type AddActivityInput = z.infer<typeof addActivitySchema>

export const updateActivitySchema = activityFieldsSchema.extend({
  tripId: z.string().uuid(),
  activityId: z.string().uuid(),
})
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>

export const deleteActivitySchema = z.object({
  tripId: z.string().uuid(),
  activityId: z.string().uuid(),
})
export type DeleteActivityInput = z.infer<typeof deleteActivitySchema>

export const moveActivitySchema = z.object({
  tripId: z.string().uuid(),
  activityId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
})
export type MoveActivityInput = z.infer<typeof moveActivitySchema>

export const startManualItinerarySchema = z.object({
  tripId: z.string().uuid(),
})
