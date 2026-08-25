import Image from "next/image"
import Link from "next/link"
import { CalendarDays, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  countdownLabel,
  countdownVariant,
  daysUntil,
} from "@/lib/trips/trip-domain"
import type { Tables } from "@/types/database.types"

export type TripSummary = Pick<
  Tables<"trips">,
  | "id"
  | "title"
  | "destination"
  | "start_date"
  | "end_date"
  | "status"
  | "cover_image_url"
  | "cover_image_credit_name"
>

const statusLabel: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
}

/** Shared with `TripRow` so the index and the cards can never format a trip's
 *  dates differently from each other. */
export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates not set"
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
  const startLabel = formatter.format(new Date(start))
  if (!end) return startLabel
  return `${startLabel} – ${formatter.format(new Date(end))}`
}

/**
 * The image is real Unsplash cover art when the trip has one (same source
 * `TripHero` renders full-size) and a plain gradient otherwise — never a
 * stand-in photo. Credit stays plain text, not a link: the whole card is
 * already an `<a>`, and a nested anchor is invalid HTML. The full, licence-
 * compliant linked credit lives one click away on the trip's own hero.
 */
export function TripCard({
  trip,
  featured = false,
}: {
  trip: TripSummary
  /**
   * The lead trip on a page — the one the reader is meant to look at first.
   *
   * Deliberately one boolean rather than a variant system: it changes scale,
   * image ratio and layout, and nothing else. The visual language is identical
   * to an ordinary card, which is the point — dominance here comes from
   * composition, not from a second card design.
   */
  featured?: boolean
}) {
  const days = daysUntil(trip.start_date)
  // Only trips still ahead get a countdown here. A past trip is already
  // grouped under "Past", and gold means *imminent* — the one thing a
  // finished trip is not.
  const countdown = days !== null && days >= 0 ? countdownLabel(days) : null

  return (
    <Link
      href={`/trips/${trip.id}`}
      // Stage 3C: the card is now carried by its tonal step alone — no border,
      // no hover shadow (DESIGN.md § Components forbids both on a card, and
      // border+fill+radius+shadow together is the dashboard signature this
      // system exists to remove). Hover is a tone shift, which is the only
      // hover vocabulary DESIGN.md's motion table allows.
      //
      // Stage 2A press timing is untouched: 0.98 rather than Button's 0.97,
      // since a card-sized surface reads a firmer squeeze as heavy-handed.
      className={cn(
        "group flex overflow-hidden rounded-xl bg-card transition-all duration-100 ease-out motion-reduce:transition-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]",
        featured ? "flex-col sm:h-72 sm:flex-row" : "flex-col"
      )}
    >
      <div
        className={cn(
          "relative bg-muted",
          featured
            ? "aspect-video sm:aspect-auto sm:h-full sm:w-1/2 sm:shrink-0"
            : "aspect-4/3"
        )}
      >
        {trip.cover_image_url ? (
          <Image
            src={trip.cover_image_url}
            alt={trip.destination}
            fill
            sizes={
              featured
                ? "(min-width: 640px) 50vw, 100vw"
                : "(min-width: 1024px) 340px, (min-width: 640px) 45vw, 90vw"
            }
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full items-center justify-center bg-muted"
          >
            <MapPin aria-hidden="true" className="size-6 text-primary/60" />
          </div>
        )}

        {/* The countdown is the point of a trip card — how soon is this? —
            so it sits over the photo exactly as it does on the trip hero.
            "Ready" is the ordinary state and is no longer badged: it was the
            loudest element on the card while saying nothing, and TripRow
            already suppressed it. Only genuinely unusual states show. */}
        {countdown || trip.status !== "ready" ? (
          <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
            {countdown ? (
              <Badge variant={countdownVariant(days)}>{countdown}</Badge>
            ) : null}
            {trip.status !== "ready" ? (
              <Badge
                variant="status"
                className="bg-background/85 px-1.5 backdrop-blur-sm"
              >
                {statusLabel[trip.status] ?? trip.status}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {trip.cover_image_url && trip.cover_image_credit_name ? (
          <p className="absolute right-2 bottom-2 rounded-sm bg-background/70 px-1.5 py-0.5 text-caption text-foreground/70 backdrop-blur-sm">
            Photo: {trip.cover_image_credit_name}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-2",
          featured ? "justify-center p-6" : "p-4"
        )}
      >
        <p
          className={cn(
            "truncate text-foreground",
            featured ? "text-headline" : "text-destination"
          )}
          title={trip.title}
        >
          {trip.title}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {trip.destination}
        </p>
        <div
          className={cn(
            "flex items-center gap-1.5 text-data-sm text-muted-foreground",
            featured ? "mt-1" : "mt-auto pt-2"
          )}
        >
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {formatDateRange(trip.start_date, trip.end_date)}
        </div>
      </div>
    </Link>
  )
}
