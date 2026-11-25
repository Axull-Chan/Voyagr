import type { BookingStatus } from "@/lib/bookings/booking-state"

/**
 * What an active hotel booking forbids elsewhere in the trip, and the words
 * for it. The database refuses the same things in the same words
 * (`hotel_booking_is_active` and the guards in migration
 * 20261125090000_add_hotel_bookings.sql); a test reads that file to keep them
 * identical. The app asks first so a dialog can refuse before a round trip.
 */

/** A booking the hotel is holding (or may be): in flight, unconfirmed, or booked. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ["booking", "pending_confirmation", "booked"]

export interface BookingLike {
  status: string
  /** ISO date, YYYY-MM-DD. */
  check_out: string
}

/** Active until the check-out day has passed: a stay checking out today still counts. */
export function isActiveBooking(booking: BookingLike, today: string): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status) && booking.check_out >= today
}

export const BOOKING_BLOCK_MESSAGES = {
  shiftDates: "This trip has an active hotel booking. Cancel the booking before changing the dates.",
  deleteTrip: "This trip has an active hotel booking. Cancel the booking before deleting the trip.",
  removeStay: "This stay is an active hotel booking. Cancel the booking before removing it.",
} as const

export type BookingBlockedAction = keyof typeof BOOKING_BLOCK_MESSAGES

/** Why `action` is refused because of a booking, or null when it isn't. */
export function bookingBlockReason(
  action: BookingBlockedAction,
  bookings: readonly BookingLike[],
  today: string
): string | null {
  return bookings.some((b) => isActiveBooking(b, today)) ? BOOKING_BLOCK_MESSAGES[action] : null
}

/** The `hotels.source` of a stay that a booking fills. Regeneration spares these. */
export const BOOKED_STAY_SOURCE = "booking"

/**
 * Whether a freshly generated stay should be the trip's primary one. Never
 * while a booked stay exists: the place you've actually reserved is where the
 * trip starts and what the budget counts.
 */
export function generatedStayIsPrimary(generatedIsPrimary: boolean, hasBookedStay: boolean): boolean {
  return generatedIsPrimary && !hasBookedStay
}
