import { formatCurrency, tripDurationDays } from "@/lib/trips/trip-domain"
import { prebookPriceDecision, type BookingStatus } from "@/lib/bookings/booking-state"

/**
 * Every word the booking screens say about money, dates, cancellation and
 * status, decided here (pure, tested) so the components only lay it out. The
 * rules that matter: a non-refundable rate is never called free to cancel; a
 * booking whose outcome is unknown is never called failed; a confirmed price
 * is never marked "est.".
 */

/** Nights between check-in and check-out (both YYYY-MM-DD). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, tripDurationDays(checkIn, checkOut) - 1)
}

/** "€438 total · 2 nights" */
export function totalText(total: number, currency: string, nights: number): string {
  const n = nights === 1 ? "1 night" : `${nights} nights`
  return `${formatCurrency(total, currency)} total · ${n}`
}

/** "27 Dec 2026, 09:59 UTC" */
export function utcDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
  return `${date}, ${time} UTC`
}

export interface CancellationLike {
  refundable: boolean
  freeUntil: string | null
}

/**
 * The cancellation line. Free only for a refundable rate, and only until its
 * deadline; after that it says so rather than going quiet.
 */
export function cancellationText(c: CancellationLike | null, now: Date = new Date()): {
  text: string
  tone: "positive" | "caution"
} {
  if (!c || !c.refundable) return { text: "Non-refundable", tone: "caution" }
  if (!c.freeUntil) return { text: "Free cancellation", tone: "positive" }
  const deadline = Date.parse(c.freeUntil)
  if (!Number.isNaN(deadline) && deadline <= now.getTime()) {
    return { text: `Free cancellation ended ${utcDateTime(c.freeUntil)}`, tone: "caution" }
  }
  return { text: `Free cancellation until ${utcDateTime(c.freeUntil)}`, tone: "positive" }
}

/** Reads a stored `cancellation_policy` column back into the shape above. */
export function storedCancellation(raw: unknown, refundableUntil: string | null): CancellationLike | null {
  if (typeof raw !== "object" || raw === null) return refundableUntil ? { refundable: true, freeUntil: refundableUntil } : null
  const refundable = (raw as { refundable?: unknown }).refundable === true
  return { refundable, freeUntil: refundable ? refundableUntil : null }
}

/** The price-change notice, or null when the checked price matches what was shown. */
export function priceChangeText(quoted: number, checked: number, currency: string): string | null {
  const decision = prebookPriceDecision(quoted, checked)
  if (decision.kind === "same") return null
  const direction = decision.difference > 0 ? "went up" : "went down"
  return `The price ${direction} from ${formatCurrency(quoted, currency)} to ${formatCurrency(checked, currency)} since you chose this room.`
}

export type StatusTone = "neutral" | "notice" | "positive" | "danger"

export interface StatusView {
  label: string
  tone: StatusTone
  /** One sentence on where things stand. */
  description: string
  /** Still part of an unfinished checkout (shown as "Continue checkout"). */
  inCheckout: boolean
}

const STATUS_VIEWS: Record<BookingStatus, StatusView> = {
  room_selected: {
    label: "Room chosen",
    tone: "neutral",
    description: "Check the live price and availability before booking.",
    inCheckout: true,
  },
  prebooked: {
    label: "Price checked",
    tone: "neutral",
    description: "The hotel has confirmed this price. Add the guest's details to book.",
    inCheckout: true,
  },
  booking: {
    label: "Booking",
    tone: "notice",
    description: "We're sending the booking to the hotel.",
    inCheckout: false,
  },
  pending_confirmation: {
    label: "Confirming",
    tone: "notice",
    description: "We're confirming this booking with the hotel. It may already be booked — check again shortly.",
    inCheckout: false,
  },
  booked: {
    label: "Booked",
    tone: "positive",
    description: "This stay is booked.",
    inCheckout: false,
  },
  failed: {
    label: "Not booked",
    tone: "danger",
    description: "This booking didn't go through. Nothing is held.",
    inCheckout: false,
  },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
    description: "This booking was cancelled.",
    inCheckout: false,
  },
}

export function bookingStatusView(status: string): StatusView {
  return STATUS_VIEWS[status as BookingStatus] ?? {
    label: "Unknown",
    tone: "notice",
    description: "We couldn't read this booking's state. Check again shortly.",
    inCheckout: false,
  }
}

/** Which bookings the trip's Stays panel lists: held, in flight, or mid-checkout. */
export function showInStaysPanel(status: string): boolean {
  return status !== "failed" && status !== "cancelled"
}

/** The price to show for a booking: what was paid once booked, else the latest checked/quoted one. */
export function bookingPrice(b: {
  status: string
  final_total: number | string | null
  prebook_total: number | string | null
  quoted_total: number | string
}): { amount: number; confirmed: boolean } {
  if (b.status === "booked" && b.final_total !== null) return { amount: Number(b.final_total), confirmed: true }
  const latest = b.prebook_total ?? b.quoted_total
  return { amount: Number(latest), confirmed: false }
}

/** Check-out default for a trip: the day after its last day (a one-day trip still needs a night). */
export function defaultStay(startDate: string, endDate: string): { checkIn: string; checkOut: string } {
  const end = endDate > startDate ? endDate : startDate
  if (end === startDate) {
    const next = new Date(Date.parse(`${startDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    return { checkIn: startDate, checkOut: next }
  }
  return { checkIn: startDate, checkOut: end }
}
