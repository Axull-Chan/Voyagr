import type { Metadata } from "next"
import Link from "next/link"
import { Plane, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { Button } from "@/components/ui/button"
import { TripCard } from "@/features/trips/components/trip-card"
import { TripRow } from "@/features/trips/components/trip-row"
import { createClient } from "@/lib/supabase/server"
import { effectiveTripStatus } from "@/features/trips/services/generation-state"

export const metadata: Metadata = { title: "My Trips" }

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: trips } = await supabase
    .from("trips")
    .select(
      "id, title, destination, start_date, end_date, status, cover_image_url, cover_image_credit_name, updated_at"
    )
    .order("created_at", { ascending: false })

  // Archived trips are listed in their own section rather than mixed into
  // Upcoming/Past: a shelved trip says nothing about what is coming next, and
  // it must not be promoted to the "Next" lead.
  // A trip whose generation was killed is shown as the draft it effectively is.
  const now = Date.now()
  const everything = (trips ?? []).map((t) => ({
    ...t,
    status: effectiveTripStatus(t.status, t.updated_at, now),
  }))
  const archived = everything.filter((t) => t.status === "archived")
  const all = everything.filter((t) => t.status !== "archived")
  const today = new Date().toISOString().slice(0, 10)

  /**
   * Grouping and ordering are display concerns only — the query above is
   * unchanged, and both buckets come from `start_date`/`end_date`, which these
   * rows already carry.
   *
   * "Past" requires positive evidence that a trip is over: it has ended, or it
   * started before today and has no end date. Everything else — including a
   * trip with no dates at all — stays under Upcoming, because the absence of a
   * date is not evidence of having happened. Undated trips sort last within it,
   * since they have no departure to be near.
   */
  const isPast = (t: (typeof all)[number]) =>
    t.end_date
      ? t.end_date < today
      : Boolean(t.start_date && t.start_date < today)

  const upcoming = all
    .filter((t) => !isPast(t))
    .sort((a, b) => {
      if (!a.start_date) return 1
      if (!b.start_date) return -1
      return a.start_date < b.start_date ? -1 : 1
    })

  const past = all
    .filter(isPast)
    .sort((a, b) =>
      (a.end_date ?? a.start_date ?? "") > (b.end_date ?? b.start_date ?? "")
        ? -1
        : 1
    )

  // The lead is the nearest trip that actually has a departure date. An undated
  // trip is never promoted — nothing about it says "this one is next".
  const lead = upcoming[0]?.start_date ? upcoming[0] : undefined
  const restUpcoming = lead ? upcoming.slice(1) : upcoming

  return (
    // Same reasoning as the dashboard: a short trip list currently ends
    // abruptly right at its last row, well short of the viewport. This gives
    // it a deliberate close instead.
    <Reveal mode="mount" className="pb-16">
      <RevealItem className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline text-foreground">My trips</h1>
          <p className="text-sm text-muted-foreground">
            Every trip you&apos;ve planned, in one place.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/trips/new" />}>
          <Plus aria-hidden="true" />
          New trip
        </Button>
      </RevealItem>

      {everything.length === 0 ? (
        <RevealItem>
          <EmptyState
            icon={Plane}
            title="No trips yet"
            description="Create your first trip and let AI build the itinerary for you."
            action={
              <Button
                nativeButton={false}
                render={<Link href="/trips/new" />}
                className="mt-1"
              >
                <Plus aria-hidden="true" />
                Plan your first trip
              </Button>
            }
          />
        </RevealItem>
      ) : (
        <>
          {lead ? (
            <RevealItem className="mb-10">
              <h2 className="text-eyebrow mb-3 text-muted-foreground">Next</h2>
              <TripCard trip={lead} featured />
            </RevealItem>
          ) : null}

          {restUpcoming.length > 0 ? (
            <RevealItem className="mb-10">
              <h2 className="text-eyebrow mb-2 text-muted-foreground">
                {lead ? "Also upcoming" : "Upcoming"}
              </h2>
              <ul className="divide-y divide-border border-t border-border">
                {restUpcoming.map((trip) => (
                  <TripRow key={trip.id} trip={trip} />
                ))}
              </ul>
            </RevealItem>
          ) : null}

          {past.length > 0 ? (
            <RevealItem className="mb-10">
              <h2 className="text-eyebrow mb-2 text-muted-foreground">Past</h2>
              <ul className="divide-y divide-border border-t border-border">
                {past.map((trip) => (
                  <TripRow key={trip.id} trip={trip} />
                ))}
              </ul>
            </RevealItem>
          ) : null}

          {archived.length > 0 ? (
            <RevealItem>
              <h2 className="text-eyebrow mb-2 text-muted-foreground">
                Archived
              </h2>
              <ul className="divide-y divide-border border-t border-border">
                {archived.map((trip) => (
                  <TripRow key={trip.id} trip={trip} />
                ))}
              </ul>
            </RevealItem>
          ) : null}
        </>
      )}
    </Reveal>
  )
}
