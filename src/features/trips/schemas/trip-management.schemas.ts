import { z } from "zod"

import { MAX_BUDGET } from "@/features/trips/services/trip-edit"

export const tripIdSchema = z.string().uuid()

/**
 * `trips.title` is `not null` with no length limit in the database, so the
 * bounds live here. 120 also matches the cap `duplicate_trip` applies to
 * "Copy of …", so a renamed trip can always be duplicated without truncation
 * surprising anyone beyond the prefix.
 */
export const renameTripSchema = z.object({
  tripId: tripIdSchema,
  title: z
    .string()
    .trim()
    .min(1, "Give the trip a name.")
    .max(120, "Keep the name under 120 characters."),
})

export type RenameTripInput = z.infer<typeof renameTripSchema>

/** A new start date; the rest (length, bounds, status) is checked in trip-edit and the database. */
export const shiftTripDatesSchema = z.object({
  tripId: tripIdSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a new start date."),
})

export type ShiftTripDatesInput = z.infer<typeof shiftTripDatesSchema>

/** A budget above 0 and at most the wizard's ceiling, or null for "no budget". */
export const updateTripBudgetSchema = z.object({
  tripId: tripIdSchema,
  budget: z
    .number({ invalid_type_error: "Enter an amount, or leave it empty." })
    .finite()
    .positive("A budget has to be more than 0. Leave it empty for no budget.")
    .max(MAX_BUDGET, "That budget is unrealistically large.")
    .nullable(),
})

export type UpdateTripBudgetInput = z.infer<typeof updateTripBudgetSchema>
