import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/types/database.types"

/**
 * Reads of a traveller's own hotel bookings. Through the user's own session, so
 * row-level security (select own rows only) decides what comes back — never the
 * service-role client, which is for writes in the booking actions.
 */

export type BookingSummary = Pick<
  Tables<"hotel_bookings">,
  | "id"
  | "status"
  | "hotel_name"
  | "check_in"
  | "check_out"
  | "currency"
  | "quoted_total"
  | "prebook_total"
  | "final_total"
  | "confirmation_code"
  | "refundable_until"
  | "cancellation_policy"
  | "created_at"
>

const SUMMARY_COLUMNS =
  "id, status, hotel_name, check_in, check_out, currency, quoted_total, prebook_total, final_total, confirmation_code, refundable_until, cancellation_policy, created_at"

/** The trip's bookings, newest first. An error reads as none (the panel is extra, not essential). */
export async function getTripBookings(tripId: string): Promise<BookingSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("hotel_bookings")
    .select(SUMMARY_COLUMNS)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
  return error ? [] : (data ?? [])
}

/** What the checkout screen needs about one booking — no idempotency key, no provider ids. */
export type CheckoutBooking = Pick<
  Tables<"hotel_bookings">,
  | "id"
  | "trip_id"
  | "status"
  | "hotel_name"
  | "address"
  | "room_name"
  | "board_type"
  | "check_in"
  | "check_out"
  | "adults"
  | "children"
  | "currency"
  | "quoted_total"
  | "prebook_total"
  | "final_total"
  | "price_change_accepted_at"
  | "confirmation_code"
  | "refundable_until"
  | "cancellation_policy"
  | "failure_message"
  | "guest_first_name"
  | "guest_last_name"
  | "guest_email"
>

export async function getCheckoutBooking(tripId: string, bookingId: string): Promise<CheckoutBooking | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("hotel_bookings")
    .select(
      "id, trip_id, status, hotel_name, address, room_name, board_type, check_in, check_out, adults, children, currency, quoted_total, prebook_total, final_total, price_change_accepted_at, confirmation_code, refundable_until, cancellation_policy, failure_message, guest_first_name, guest_last_name, guest_email"
    )
    .eq("id", bookingId)
    .eq("trip_id", tripId)
    .maybeSingle()
  return data ?? null
}
