import { z } from "zod"

import { MAX_TRIP_DAYS } from "@/lib/trips/trip-domain"

/**
 * Inputs to the booking actions. Everything that reaches the provider or the
 * database passes through these first; prices and offers sent back by the
 * browser are only ever what the traveller *saw* — the provider's prebook is
 * the price that counts, and it is re-checked server-side.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
const MS_PER_DAY = 86_400_000

const stay = z
  .object({
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.number().int().min(1).max(20),
    childrenAges: z.array(z.number().int().min(0).max(17)).max(6).default([]),
  })
  .refine((s) => s.checkOut > s.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] })
  .refine(
    (s) => (Date.parse(`${s.checkOut}T00:00:00Z`) - Date.parse(`${s.checkIn}T00:00:00Z`)) / MS_PER_DAY <= MAX_TRIP_DAYS,
    { message: `A stay can be at most ${MAX_TRIP_DAYS} nights.`, path: ["checkOut"] }
  )

export const searchHotelsSchema = z.object({
  tripId: z.string().uuid(),
  stay,
  /** ISO 3166-1 alpha-2; rates and taxes depend on it. */
  guestNationality: z.string().regex(/^[A-Z]{2}$/, "Choose a nationality."),
})
export type SearchHotelsInput = z.input<typeof searchHotelsSchema>

const policy = z.object({
  cancelTime: z.string().max(40),
  amount: z.number().min(0),
  currency: z.string().max(3),
})

export const selectRoomSchema = z.object({
  tripId: z.string().uuid(),
  stay,
  offerId: z.string().min(1).max(2000),
  hotel: z.object({
    providerHotelId: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    address: z.string().max(300).nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
  }),
  roomName: z.string().max(300).nullable(),
  boardType: z.string().max(40).nullable(),
  quotedTotal: z.number().min(0).max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  cancellation: z.object({
    refundable: z.boolean(),
    freeUntil: z.string().max(40).nullable(),
    policies: z.array(policy).max(20),
  }),
})
export type SelectRoomInput = z.input<typeof selectRoomSchema>

export const bookingIdSchema = z.string().uuid()

export const bookRoomSchema = z.object({
  bookingId: bookingIdSchema,
  guest: z.object({
    firstName: z.string().trim().min(1, "Enter a first name.").max(60),
    lastName: z.string().trim().min(1, "Enter a last name.").max(60),
    email: z.string().trim().email("Enter a valid email.").max(200),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,24}$/, "Enter a valid phone number.")
      .nullable()
      .optional(),
  }),
})
export type BookRoomInput = z.input<typeof bookRoomSchema>
