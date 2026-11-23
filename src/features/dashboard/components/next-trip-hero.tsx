import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { DestinationFallback } from "@/components/shared/destination-fallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  countdownLabel,
  countdownVariant,
  daysUntil,
  formatCurrency,
  tripDurationDays,
} from "@/lib/trips/trip-domain"
import { formatDateRange, type TripSummary } from "@/features/trips/components/trip-card"
import type { NextTripFacts } from "@/features/trips/queries/next-trip-facts"
import { heroFactLines } from "@/features/dashboard/services/hero-facts"

/**
 * The dashboard's lead: the next trip, with what's worth knowing about it at a
 * glance. Unlike `TripCard`, this is not one big link — it holds its own
 * "Continue planning" button, and a button inside an `<a>` is invalid HTML, so
 * the title and the button are separate links to the same trip.
 */
export function NextTripHero({
  trip,
  facts,
}: {
  trip: TripSummary & { budget: number | string | null; currency: string }
  facts: NextTripFacts
}) {
  const days = daysUntil(trip.start_date)
  const countdown = days !== null && days >= 0 ? countdownLabel(days) : null
  const length =
    trip.start_date && trip.end_date ? tripDurationDays(trip.start_date, trip.end_date) : 0
  const lines = heroFactLines(facts, {
    budget: trip.budget === null ? null : Number(trip.budget),
    formatMoney: (amount) => formatCurrency(amount, trip.currency),
  })

  return (
    <article className="bg-card grid overflow-hidden rounded-xl sm:grid-cols-2">
      <div className="bg-muted relative aspect-video sm:aspect-auto sm:min-h-80">
        {trip.cover_image_url ? (
          <Image
            src={trip.cover_image_url}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <DestinationFallback destination={trip.destination} size="lg" />
        )}
        {countdown || trip.status !== "ready" ? (
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            {countdown ? <Badge variant={countdownVariant(days)}>{countdown}</Badge> : null}
            {trip.status !== "ready" ? (
              <Badge variant="status" className="bg-background/85 px-1.5 capitalize backdrop-blur-sm">
                {trip.status}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {trip.cover_image_url && trip.cover_image_credit_name ? (
          <p className="bg-background/70 text-caption text-foreground/70 absolute right-2 bottom-2 rounded-sm px-1.5 py-0.5 backdrop-blur-sm">
            Photo: {trip.cover_image_credit_name}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-4 p-6">
        <div className="min-w-0">
          <h3 className="text-headline text-foreground truncate" title={trip.title}>
            <Link
              href={`/trips/${trip.id}`}
              className="focus-visible:ring-ring rounded-sm hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              {trip.title}
            </Link>
          </h3>
          <p className="text-muted-foreground truncate text-sm">{trip.destination}</p>
          <p className="text-data-sm text-muted-foreground mt-1">
            {formatDateRange(trip.start_date, trip.end_date)}
            {length > 0 ? ` · ${length} ${length === 1 ? "day" : "days"}` : null}
          </p>
        </div>

        {lines.length > 0 ? (
          <dl className="divide-border border-border divide-y border-y">
            {lines.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-caption text-muted-foreground shrink-0">{line.label}</dt>
                <dd className="text-data-sm text-foreground min-w-0 text-right">{line.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-auto">
          <Button nativeButton={false} render={<Link href={`/trips/${trip.id}`} />}>
            Continue planning
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </article>
  )
}
