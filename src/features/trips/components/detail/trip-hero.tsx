import Image from "next/image"
import { CalendarDays, MapPin, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { UNSPLASH_REFERRAL_URL } from "@/integrations/unsplash/images"
import { formatCurrency } from "@/lib/trips/trip-domain"
import type { TripRow } from "@/features/trips/queries/trip-detail"

interface TripHeroProps {
  trip: TripRow
  nights: number
}

/** Whole days until departure; negative once the trip has started. */
function daysUntil(startDate: string | null): number | null {
  if (!startDate) return null
  const start = Date.parse(`${startDate}T00:00:00Z`)
  if (Number.isNaN(start)) return null
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((start - today) / 86_400_000)
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "Dates not set"
  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const from = fmt.format(new Date(`${start}T00:00:00Z`))
  if (!end) return from
  return `${from} – ${fmt.format(new Date(`${end}T00:00:00Z`))}`
}

function countdownLabel(days: number | null): string | null {
  if (days === null) return null
  if (days > 1) return `In ${days} days`
  if (days === 1) return "Tomorrow"
  if (days === 0) return "Today"
  return "Past trip"
}

/**
 * Gold escalates as the trip nears — quiet for "In N days", bold for
 * Tomorrow/Today. A past trip deliberately gets neither: gold reads as
 * *imminent*, which a finished trip is the opposite of.
 */
function countdownVariant(
  days: number | null
): "countdown" | "countdown-urgent" | "secondary" {
  if (days === null || days < 0) return "secondary"
  return days <= 1 ? "countdown-urgent" : "countdown"
}

/**
 * The destination hero.
 *
 * The photo is hotlinked straight from Unsplash and credited inline, which
 * their licence requires — we store the URL, never the file. With no photo it
 * falls back to a gradient rather than a stand-in image, which looks
 * deliberate instead of broken.
 */
export function TripHero({ trip, nights }: TripHeroProps) {
  const days = daysUntil(trip.start_date)
  const countdown = countdownLabel(days)

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border">
      {trip.cover_image_url ? (
        <Image
          src={trip.cover_image_url}
          alt={`${trip.destination}`}
          width={1600}
          height={600}
          priority
          className="h-56 w-full object-cover sm:h-72"
          // Unsplash serves from its own CDN; sizing here keeps CLS at zero.
          sizes="(min-width: 1024px) 900px, 100vw"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-56 w-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_70%),transparent_60%),linear-gradient(to_bottom_right,var(--muted),var(--background))] sm:h-72"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />

      {/* The photographer-and-Unsplash credit is a licence condition, not a
          courtesy, and both halves must link back with referral parameters.
          Sits top-right so it never collides with the title block below. */}
      {trip.cover_image_url && trip.cover_image_credit_name ? (
        <p className="absolute top-2 right-3 text-[0.65rem] text-foreground/60">
          Photo by{" "}
          <a
            href={trip.cover_image_credit_url ?? UNSPLASH_REFERRAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground focus-visible:ring-ring rounded-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            {trip.cover_image_credit_name}
          </a>{" "}
          on{" "}
          <a
            href={trip.cover_image_link ?? UNSPLASH_REFERRAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground focus-visible:ring-ring rounded-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            Unsplash
          </a>
        </p>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          {countdown ? (
            <Badge variant={countdownVariant(days)}>{countdown}</Badge>
          ) : null}
          {trip.status !== "ready" ? (
            <Badge variant="secondary" className="capitalize">
              {trip.status}
            </Badge>
          ) : null}
        </div>

        <h1 className="text-destination text-balance text-foreground">
          {trip.title}
        </h1>

        <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-4" />
            <dt className="sr-only">Destination</dt>
            <dd>{trip.destination}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4" />
            <dt className="sr-only">Dates</dt>
            <dd className="text-data-sm">
              {formatRange(trip.start_date, trip.end_date)}
              {nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-4" />
            <dt className="sr-only">Travellers</dt>
            <dd className="text-data-sm">
              {trip.travelers} traveller{trip.travelers === 1 ? "" : "s"}
            </dd>
          </div>
          {trip.budget ? (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Budget</dt>
              <dd className="text-data-sm">{formatCurrency(Number(trip.budget), trip.currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  )
}
