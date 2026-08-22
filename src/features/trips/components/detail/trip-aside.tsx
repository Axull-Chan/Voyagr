import { BedDouble, Plane } from "lucide-react"

import { formatCurrency } from "@/lib/trips/trip-domain"
import type { HotelRow, TransportRow } from "@/features/trips/queries/trip-detail"

export function StaysPanel({
  hotels,
  currency,
}: {
  hotels: HotelRow[]
  currency: string
}) {
  if (hotels.length === 0) return null

  return (
    <section className="p-5">
      <h2 className="flex items-center gap-2 text-day-heading text-foreground">
        <BedDouble aria-hidden="true" className="size-4 text-primary" />
        Where you&apos;re staying
      </h2>
      <ul className="mt-3 space-y-3">
        {hotels.map((hotel) => (
          <li key={hotel.id}>
            <p className="text-sm font-semibold text-foreground">{hotel.name}</p>
            {hotel.address ? (
              <p className="text-xs text-muted-foreground">{hotel.address}</p>
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
              <p className="mt-1 text-xs text-notice-foreground italic">
                An example stay for budgeting — not a real listing.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
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
              <p className="text-xs text-muted-foreground">{leg.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
