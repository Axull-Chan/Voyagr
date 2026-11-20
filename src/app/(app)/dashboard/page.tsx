import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Plane, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { Button } from "@/components/ui/button"
import { TripCard } from "@/features/trips/components/trip-card"
import { TripRow } from "@/features/trips/components/trip-row"
import { createClient } from "@/lib/supabase/server"
import { effectiveTripStatus } from "@/features/trips/services/generation-state"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: tripsData }] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("trips")
      .select(
        "id, title, destination, start_date, end_date, status, created_at, cover_image_url, cover_image_credit_name, updated_at"
      )
      // Archived trips are shelved: they stay on /trips, but the dashboard's
      // upcoming trip and its totals describe what is still in play.
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
  ])

  // A trip whose generation was killed is shown as the draft it effectively is.
  const now = Date.now()
  const trips = (tripsData ?? []).map((t) => ({
    ...t,
    status: effectiveTripStatus(t.status, t.updated_at, now),
  }))
  const firstName = profile?.full_name?.split(" ")[0]
  const today = new Date().toISOString().slice(0, 10)

  // Nearest departure first. `recentTrips` (the three most recently *created*)
  // used to render alongside this and overlapped it heavily, so the same trip
  // commonly appeared twice on one page — see DESIGN.md's "same information in
  // two places" anti-pattern. The recency grid is gone; /trips is the complete
  // list and is one click away in the sidebar.
  const upcoming = trips
    .filter((trip) => trip.start_date && trip.start_date >= today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
  const [nextTrip, ...laterTrips] = upcoming

  const destinationCount = new Set(trips.map((trip) => trip.destination)).size
  const totalDays = trips.reduce((sum, trip) => {
    if (!trip.start_date || !trip.end_date) return sum
    const days =
      Math.round(
        (new Date(trip.end_date).getTime() -
          new Date(trip.start_date).getTime()) /
          86_400_000
      ) + 1
    return sum + Math.max(days, 0)
  }, 0)

  // Overview figures, kept but demoted: a quiet measured line, not four boxes.
  // Rendered once and placed differently below — beside the featured card
  // when there is one, otherwise as its own full-width band — rather than
  // duplicating the four `<dd>/<dt>` pairs in both branches.
  const overview = [
    { label: "Trips", value: trips.length },
    { label: "Upcoming", value: upcoming.length },
    { label: "Destinations", value: destinationCount },
    { label: "Days planned", value: totalDays },
  ]
  const overviewItems = overview.map((item) => (
    <div key={item.label}>
      <dd className="text-data-md text-foreground">{item.value}</dd>
      <dt className="text-caption text-muted-foreground">{item.label}</dt>
    </div>
  ))

  return (
    // pb-16: a page this short otherwise ends right at its last row's bottom
    // border — a hard stop rather than a settled one. Trip Detail and other
    // longer pages already end with enough of their own trailing content
    // that this isn't needed there, so it's set here rather than in the
    // shared (app) shell, which every page inherits.
    <Reveal mode="mount" className="pb-16">
      {/* The action lives in the page header rather than in a bordered box.
          "View all trips" is gone entirely — the sidebar already links there,
          and a card whose only job is to duplicate navigation is exactly the
          filler DESIGN.md calls out. */}
      <RevealItem className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline text-foreground">
            {firstName ? `Welcome back, ${firstName}` : "Your trips"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {nextTrip
              ? "Here's what's coming up."
              : "Everything you're planning, in one place."}
          </p>
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/trips/new" />}>
          <Plus aria-hidden="true" />
          New trip
        </Button>
      </RevealItem>

      {trips.length === 0 ? (
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
          {nextTrip ? (
            <RevealItem className="mb-10">
              <h2 className="text-eyebrow mb-3 text-muted-foreground">
                Next trip
              </h2>
              {/* The featured card here was structurally identical to Trips'
                  own opener — same heading, same card, nothing beside it — so
                  the two pages read as the same screen at a glance. Rather
                  than invent a second card treatment, this reuses the one
                  asymmetric device DESIGN.md already establishes (Trip
                  Detail's `1fr / rail` split): the overview figures move
                  beside the card instead of into their own full-width band
                  below it, which is a real difference at the exact point the
                  pages used to collide, and is unique to Dashboard — Trips
                  has no such figures to show. */}
              <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
                <TripCard trip={nextTrip} featured />
                <dl className="flex flex-wrap gap-x-10 gap-y-4 border-y border-border py-4 lg:flex-col lg:flex-nowrap lg:gap-y-5 lg:border-none lg:py-1">
                  {overviewItems}
                </dl>
              </div>
            </RevealItem>
          ) : (
            // No upcoming trip to sit beside — every trip is in the past.
            // The figures still matter on their own, so they keep the
            // original full-width quiet band rather than disappearing.
            <RevealItem className="mb-10 border-y border-border py-4">
              <dl className="flex flex-wrap gap-x-10 gap-y-4">
                {overviewItems}
              </dl>
            </RevealItem>
          )}

          {laterTrips.length > 0 ? (
            <RevealItem className="mb-8">
              <h2 className="text-eyebrow mb-2 text-muted-foreground">
                Also coming up
              </h2>
              <ul className="divide-y divide-border border-t border-border">
                {laterTrips.slice(0, 4).map((trip) => (
                  <TripRow key={trip.id} trip={trip} />
                ))}
              </ul>
            </RevealItem>
          ) : null}

          <RevealItem>
            <Link
              href="/trips"
              className="group inline-flex items-center gap-1.5 rounded-sm text-label-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              All trips
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </RevealItem>
        </>
      )}
    </Reveal>
  )
}
