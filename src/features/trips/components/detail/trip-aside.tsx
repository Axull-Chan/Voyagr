import Link from "next/link"
import { BedDouble, Plane, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/trips/trip-domain"
import type { HotelRow, TransportRow } from "@/features/trips/queries/trip-detail"
import type { BookingSummary } from "@/features/bookings/queries/bookings"
import {
  bookingPrice,
  bookingStatusView,
  cancellationText,
  showInStaysPanel,
  storedCancellation,
} from "@/features/bookings/services/booking-view"

/**
 * Where you're staying, in three kinds that must never be confused:
 *  - a **booking** (a real reservation): status label, confirmation code and the
 *    exact price — never "est.";
 *  - a **real listing** from the plan: modelled price, marked "est.";
 *  - an **example stay** for budgeting: marked as not a real listing.
 * Bookings come first, and only the ones still held or in progress.
 */
export function StaysPanel({
  hotels,
  currency,
  tripId,
  bookings = [],
  canBook = false,
}: {
  hotels: HotelRow[]
  currency: string
  tripId?: string
  bookings?: BookingSummary[]
  /** Hotel booking is enabled and the trip has dates. */
  canBook?: boolean
}) {
  const shown = bookings.filter((b) => showInStaysPanel(b.status))
  if (hotels.length === 0 && shown.length === 0 && !canBook) return null

  return (
    <section className="p-5">
      <h2 className="flex items-center gap-2 text-day-heading text-foreground">
        <BedDouble aria-hidden="true" className="size-4 text-primary" />
        Where you&apos;re staying
      </h2>
      {shown.length > 0 && tripId ? (
        <ul className="mt-3 space-y-3" aria-label="Hotel bookings">
          {shown.map((b) => (
            <BookingEntry key={b.id} booking={b} tripId={tripId} />
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 space-y-3">
        {hotels.map((hotel) => (
          <li key={hotel.id}>
            <p className="text-sm font-semibold text-foreground">{hotel.name}</p>
            {hotel.address ? (
              <p className="text-caption text-muted-foreground">{hotel.address}</p>
            ) : null}
            <p className="mt-0.5 text-data-sm text-muted-foreground">
              {[
                hotel.nights ? `${hotel.nights} nights` : null,
                // Marked as an estimate even for a real listing: the nightly
                // rate is modelled from a cost index, not quoted by the hotel.
                hotel.price_per_night
                  ? `est. ${formatCurrency(Number(hotel.price_per_night), currency)} / night`
                  : null,
                hotel.rating ? `${Number(hotel.rating)}★` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {/* A real listing carries a real name and a real location; an
                example carries neither, and saying which is which is the
                difference between a suggestion and a claim about a business.
                `--notice` (not `--muted-foreground`) because this is
                specifically an approximation/provenance caveat, the exact
                case that token exists for. */}
            {hotel.source === "mock" ? (
              <p className="mt-1 text-caption text-notice-foreground italic">
                An example stay for budgeting — not a real listing.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {canBook && tripId ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${tripId}/stays`} />}
          className="mt-4 w-full"
        >
          <Search aria-hidden="true" />
          Find a hotel
        </Button>
      ) : null}
    </section>
  )
}

function BookingEntry({ booking, tripId }: { booking: BookingSummary; tripId: string }) {
  const view = bookingStatusView(booking.status)
  const price = bookingPrice(booking)
  const href = `/trips/${tripId}/stays/${booking.id}`
  const linkClass =
    "focus-visible:ring-ring rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
  return (
    <li>
      <div className="flex items-center gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{booking.hotel_name}</p>
        {booking.status === "booked" ? (
          <Badge variant="status" className="rounded-sm border border-primary px-1.5 text-primary">
            Booked
          </Badge>
        ) : null}
      </div>
      {booking.status === "booked" ? (
        <>
          <p className="mt-0.5 text-data-sm text-foreground">
            {formatCurrency(price.amount, booking.currency)}
            {booking.confirmation_code ? ` · Confirmation ${booking.confirmation_code}` : null}
          </p>
          <p className="text-caption text-muted-foreground">
            {cancellationText(storedCancellation(booking.cancellation_policy, booking.refundable_until)).text} ·{" "}
            <Link href={href} className={linkClass}>
              Details
            </Link>
          </p>
        </>
      ) : view.inCheckout ? (
        <p className="mt-0.5 text-caption text-muted-foreground">
          Not booked yet ·{" "}
          <Link href={href} className={linkClass}>
            Continue checkout
          </Link>
        </p>
      ) : (
        <p className="mt-0.5 text-caption text-notice-foreground">
          {view.label}: we&apos;re confirming this with the hotel ·{" "}
          <Link href={href} className={linkClass}>
            Check status
          </Link>
        </p>
      )}
    </li>
  )
}

export function TransportPanel({
  legs,
  currency,
}: {
  legs: TransportRow[]
  currency: string
}) {
  if (legs.length === 0) return null

  return (
    <section className="p-5">
      <h2 className="flex items-center gap-2 text-day-heading text-foreground">
        <Plane aria-hidden="true" className="size-4 text-primary" />
        Getting there and around
      </h2>
      <ul className="mt-3 space-y-3">
        {legs.map((leg) => (
          <li key={leg.id}>
            <p className="text-sm font-semibold text-foreground">
              {leg.from_location} → {leg.to_location}
            </p>
            <p className="text-data-sm text-muted-foreground capitalize">
              {[
                leg.mode,
                // No flight-search or fare provider is wired up (see
                // CLAUDE.md Phase 5/6 notes) — duration and cost are both a
                // cost-index estimate, not a real fare, so both get the same
                // "est." treatment as the hotel rate above.
                leg.duration_minutes
                  ? `est. ${Math.round(leg.duration_minutes / 60)} hr`
                  : null,
                Number(leg.cost) > 0
                  ? `est. ${formatCurrency(Number(leg.cost), currency)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {leg.notes ? (
              <p className="text-caption text-muted-foreground">{leg.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
