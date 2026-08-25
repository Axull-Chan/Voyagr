import Image from "next/image"
import Link from "next/link"
import { MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  formatDateRange,
  type TripSummary,
} from "@/features/trips/components/trip-card"

const statusLabel: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
}

/**
 * A trip as an index entry rather than an object.
 *
 * Once a page has a lead trip, repeating the same large card for everything
 * behind it says every journey carries equal weight — which is exactly the
 * "these are database records" reading DESIGN.md warns about. This is the same
 * row language the day timeline and favourites already use: page ground, a
 * dividing rule rather than an enclosing box, a small thumbnail so the imagery
 * still counts, and compact metadata with dates in mono.
 *
 * Renders the `<li>` itself, so callers supply the `<ul>` and its dividers.
 */
export function TripRow({ trip }: { trip: TripSummary }) {
  return (
    <li>
      <Link
        href={`/trips/${trip.id}`}
        // Hover is a tone shift, matching TripCard. The negative margin lets
        // that fill breathe past the text without indenting the rule above it.
        className="group -mx-2 flex items-center gap-3 rounded-sm px-2 py-3 transition-colors duration-100 ease-out motion-reduce:transition-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-muted">
          {trip.cover_image_url ? (
            <Image
              src={trip.cover_image_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full items-center justify-center"
            >
              <MapPin className="size-4 text-muted-foreground" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{trip.title}</p>
          <p className="flex min-w-0 items-baseline gap-2 text-caption text-muted-foreground">
            <span className="truncate">{trip.destination}</span>
            <span className="shrink-0 text-data-sm">
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>
          </p>
        </div>

        {/* "Ready" is the ordinary state; badging it would make the index noisy
            for no information. Same rule the trip hero already applies. */}
        {trip.status !== "ready" ? (
          <Badge variant="status" className="shrink-0">
            {statusLabel[trip.status] ?? trip.status}
          </Badge>
        ) : null}
      </Link>
    </li>
  )
}
