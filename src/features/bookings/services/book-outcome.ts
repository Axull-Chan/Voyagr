import { isIntegrationError } from "@/integrations/core/errors"
import type { BookOutcome } from "@/lib/bookings/booking-state"

/**
 * What a failed LiteAPI book call means for our booking, from the provider's
 * documented error codes (API errors for the hotel booking workflow, Nov 2026).
 *
 * The rule that matters most: anything we can't positively read as "refused"
 * is `unknown`, which becomes `pending_confirmation` and is resolved by looking
 * the booking up — never `failed`. A timeout, a dropped connection, a 5xx, an
 * unreadable 200 or "booking incomplete" may all hide a booking that went
 * through, and recording that as a failure is how people get booked twice.
 */

export type BookFailure =
  | { outcome: BookOutcome; code: string | null; message: string }
  /** 4005: our clientReference was already used — the booking may exist; look it up. */
  | { outcome: { kind: "duplicate" }; code: "4005"; message: string }

/** Provider codes that mean the booking was refused before anything was booked. */
const REFUSED: Record<string, string> = {
  "2001": "That room is no longer available. Please search again.",
  "2013": "The hotel declined the booking. Please search again or choose another room.",
  "4000": "The booking request was rejected.",
  "4002": "Some booking details were missing or invalid.",
  "4003": "Some booking details were invalid.",
  "4004": "This checkout session has expired. Please choose the room again.",
  "4006": "The payment details were rejected.",
  "4007": "The payment details expired.",
  "40010": "The payment details were rejected.",
  "4290": "The booking service is busy. Please try again in a few minutes.",
}

export function classifyBookFailure(error: unknown): BookFailure {
  if (!isIntegrationError(error)) {
    return { outcome: { kind: "unknown" }, code: null, message: "We couldn't confirm the booking yet." }
  }
  const code = error.providerCode ?? null
  if (code === "4005") {
    return { outcome: { kind: "duplicate" }, code, message: "This booking was already submitted." }
  }
  if (code !== null && REFUSED[code]) {
    return { outcome: { kind: "declined" }, code, message: REFUSED[code]! }
  }
  // 2014 "booking incomplete", 5000, timeouts, network faults, 5xx, an
  // unreadable success body, and any code we don't recognise.
  return { outcome: { kind: "unknown" }, code, message: "We couldn't confirm the booking yet. We'll check with the hotel." }
}

/** Prebook failures that mean "this offer is gone — search again", vs. worth retrying. */
export function prebookFailureMessage(error: unknown): { retryable: boolean; message: string } {
  const code = isIntegrationError(error) ? error.providerCode : undefined
  if (code === "2001" || code === "4020") {
    return { retryable: false, message: "That room is no longer available at that price. Please search again." }
  }
  if (code === "4016" || (isIntegrationError(error) && error.isRetryable)) {
    return { retryable: true, message: "Checking the room took too long. Please try again." }
  }
  return { retryable: false, message: "We couldn't check that room. Please search again." }
}

/** Why "Book" can't be pressed yet, in words (see `bookBlockedReason`). */
export const BOOK_BLOCK_MESSAGES = {
  not_prebooked: "Check the room's price first.",
  prebook_expired: "This price check has expired. Check the room again.",
  price_change_not_accepted: "The price changed. Review and accept the new price to continue.",
} as const
