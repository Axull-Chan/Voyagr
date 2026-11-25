/**
 * The hotel booking state machine, as pure rules.
 *
 * The database enforces the same transitions in a trigger
 * (migration 20261125090000_add_hotel_bookings.sql); a test reads that file so
 * the two lists can't drift. Code asks here first so it can explain a refusal
 * in words, and the trigger stops anything that slips past — including a
 * server bug, since the service-role key bypasses RLS but not triggers.
 *
 *   room_selected -> prebooked | failed | cancelled
 *   prebooked     -> room_selected | booking | failed | cancelled
 *   booking       -> booked | pending_confirmation | failed | room_selected
 *   pending_confirmation -> booked | failed
 *   booked        -> cancelled
 *   failed, cancelled: final
 *
 * "searching" is page state only: nothing is stored until a room is chosen.
 */

export const BOOKING_STATUSES = [
  "room_selected",
  "prebooked",
  "booking",
  "pending_confirmation",
  "booked",
  "failed",
  "cancelled",
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  room_selected: ["prebooked", "failed", "cancelled"],
  prebooked: ["room_selected", "booking", "failed", "cancelled"],
  booking: ["booked", "pending_confirmation", "failed", "room_selected"],
  pending_confirmation: ["booked", "failed"],
  booked: ["cancelled"],
  failed: [],
  cancelled: [],
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to)
}

export function isFinalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0
}

// ---------------------------------------------------------------------------
// Price and expiry between choosing a room and booking it
// ---------------------------------------------------------------------------

/** Amounts are compared to the cent; anything finer is rounding noise. */
const toCents = (amount: number) => Math.round(amount * 100)

export type PrebookPriceDecision =
  | { kind: "same" }
  /** The traveller must see the new price and accept it before booking. */
  | { kind: "changed"; from: number; to: number; difference: number }

/**
 * The prebook step re-checks the rate. Any change — up *or* down — is shown and
 * must be accepted: a lower price is good news, but silently booking a
 * different figure from the one on screen is still booking something the
 * traveller didn't agree to.
 */
export function prebookPriceDecision(quotedTotal: number, prebookTotal: number): PrebookPriceDecision {
  const difference = (toCents(prebookTotal) - toCents(quotedTotal)) / 100
  return difference === 0
    ? { kind: "same" }
    : { kind: "changed", from: quotedTotal, to: prebookTotal, difference }
}

/** Leeway so a prebook isn't used in its last seconds and expire mid-request. */
export const PREBOOK_EXPIRY_MARGIN_MS = 30_000

export function isPrebookExpired(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false
  const at = Date.parse(expiresAt)
  if (Number.isNaN(at)) return true // unreadable: treat as expired, re-prebook
  return now.getTime() >= at - PREBOOK_EXPIRY_MARGIN_MS
}

export interface BookReadiness {
  status: BookingStatus
  quotedTotal: number
  prebookTotal: number | null
  prebookExpiresAt: string | null
  priceChangeAcceptedAt: string | null
}

export type BookBlock =
  | "not_prebooked"
  | "prebook_expired"
  | "price_change_not_accepted"

/**
 * Whether "Book" may be pressed, or why not. Only a prebooked row, with a live
 * prebook, at a price the traveller has seen — either unchanged from the quote
 * or explicitly accepted.
 */
export function bookBlockedReason(b: BookReadiness, now: Date): BookBlock | null {
  if (b.status !== "prebooked" || b.prebookTotal === null) return "not_prebooked"
  if (isPrebookExpired(b.prebookExpiresAt, now)) return "prebook_expired"
  const price = prebookPriceDecision(b.quotedTotal, b.prebookTotal)
  if (price.kind === "changed" && !b.priceChangeAcceptedAt) return "price_change_not_accepted"
  return null
}

// ---------------------------------------------------------------------------
// The outcome of a book request
// ---------------------------------------------------------------------------

/**
 * What the provider said, reduced to what decides the next state. `unknown`
 * covers timeouts, dropped connections and 5xx: the booking may have been
 * taken, so it is never recorded as a failure.
 */
export type BookOutcome =
  | { kind: "confirmed" }
  | { kind: "declined" }
  | { kind: "price_changed" }
  | { kind: "unknown" }

export function statusAfterBook(outcome: BookOutcome): BookingStatus {
  switch (outcome.kind) {
    case "confirmed":
      return "booked"
    case "declined":
      return "failed"
    case "price_changed":
      // Refused before charging; the traveller picks the room again.
      return "room_selected"
    case "unknown":
      return "pending_confirmation"
  }
}
