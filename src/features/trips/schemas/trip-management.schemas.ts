import { z } from "zod"

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
