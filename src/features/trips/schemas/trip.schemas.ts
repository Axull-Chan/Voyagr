import { z } from "zod"

import {
  ACCOMMODATION_VALUES,
  CURRENCY_VALUES,
  INTEREST_VALUES,
  MAX_TRIP_DAYS,
  TRANSPORT_VALUES,
  TRAVEL_STYLE_VALUES,
  tripDurationDays,
} from "@/lib/trips/trip-domain"

/**
 * `z.enum` needs a non-empty tuple, but the vocabularies in trip-domain are
 * derived arrays. This asserts the shape once here instead of scattering casts
 * through the schema.
 */
function enumOf<T extends string>(values: T[]) {
  return z.enum(values as [T, ...T[]])
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const createTripSchema = z
  .object({
    destination: z
      .string()
      .trim()
      .min(2, "Where are you going?")
      .max(120, "That destination name is too long."),
    startingCity: z
      .string()
      .trim()
      .max(120, "That city name is too long.")
      .optional()
      .or(z.literal("")),
    startDate: z.string().regex(ISO_DATE, "Pick a start date."),
    endDate: z.string().regex(ISO_DATE, "Pick an end date."),
    travelers: z
      .number({ invalid_type_error: "Enter a number of travellers." })
      .int("Whole people only.")
      .min(1, "At least one traveller.")
      .max(20, "For groups over 20, plan a few trips."),
    budget: z
      .number({ invalid_type_error: "Enter a number, or leave it blank." })
      .min(0, "Budget can't be negative.")
      .max(10_000_000, "That budget is unrealistically large.")
      .nullable(),
    currency: enumOf([...CURRENCY_VALUES]),
    travelStyle: enumOf([...TRAVEL_STYLE_VALUES]),
    interests: z
      .array(enumOf([...INTEREST_VALUES]))
      .max(INTEREST_VALUES.length),
    accommodation: enumOf([...ACCOMMODATION_VALUES]),
    transportation: enumOf([...TRANSPORT_VALUES]),
    notes: z.string().trim().max(1000, "Keep notes under 1000 characters.").optional().or(z.literal("")),
  })
  // Cross-field rules live here rather than on a single field so the error
  // lands on the input the user can actually fix.
  .refine((data) => data.endDate >= data.startDate, {
    message: "The end date has to be on or after the start date.",
    path: ["endDate"],
  })
  .refine(
    (data) => tripDurationDays(data.startDate, data.endDate) <= MAX_TRIP_DAYS,
    {
      message: `Trips are limited to ${MAX_TRIP_DAYS} days for now.`,
      path: ["endDate"],
    }
  )

export type CreateTripInput = z.infer<typeof createTripSchema>

/**
 * Which fields each wizard step owns.
 *
 * The wizard validates only these on "Next", so a user is never blocked by an
 * error on a step they haven't reached. Declared here beside the schema so
 * adding a field can't silently escape step validation.
 */
export const WIZARD_STEPS = [
  {
    id: "destination",
    title: "Where to?",
    description: "The place you're going, and where you're setting off from.",
    fields: ["destination", "startingCity"],
  },
  {
    id: "dates",
    title: "When, and who with?",
    description: "Dates and party size shape everything else in the plan.",
    fields: ["startDate", "endDate", "travelers"],
  },
  {
    id: "budget",
    title: "What's the budget?",
    description: "Used to size the plan. Leave it blank for an estimate instead.",
    fields: ["budget", "currency", "travelStyle"],
  },
  {
    id: "preferences",
    title: "What do you enjoy?",
    description: "The more we know, the less generic the itinerary.",
    fields: ["interests", "accommodation", "transportation", "notes"],
  },
] as const satisfies readonly {
  id: string
  title: string
  description: string
  fields: readonly (keyof CreateTripInput)[]
}[]

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"]
