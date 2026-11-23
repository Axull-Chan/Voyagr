import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Plane, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { Button } from "@/components/ui/button"
import { TripCard } from "@/features/trips/components/trip-card"
import { createClient } from "@/lib/supabase/server"
import { effectiveTripStatus } from "@/features/trips/services/generation-state"
import { getNextTripFacts } from "@/features/trips/queries/next-trip-facts"
import { dashboardStats, pickDashboardTrips } from "@/features/dashboard/services/dashboard"
import { NextTripHero } from "@/features/dashboard/components/next-trip-hero"
import { DashboardStats } from "@/features/dashboard/components/dashboard-stats"
import { QuickStartRail } from "@/features/dashboard/components/quick-start-rail"

export const metadata: Metadata = { title: "Dashboard" }

/**
 * The command center. Reads top to bottom: greeting and New trip; the next
 * trip with its live details beside the overview figures; one-click starters;
 * then up to three *other* trips. No trip appears twice on the page — the
 * hero is excluded from the grid by `pickDashboardTrips`, which is tested.
 *
 * `loading.tsx` mirrors this composition and changes in the same commit.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: tripsData }] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("trips")
      .select(
        "id, title, destination, start_date, end_date, status, created_at, cover_image_url, cover_image_credit_name, updated_at, budget, currency"
      )
      // Archived trips are shelved: they stay on /trips, but the dashboard
      // describes what is still in play.
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

  const { nextTrip, upcoming, yourTrips } = pickDashboardTrips(trips, today)
  const stats = dashboardStats(trips, upcoming.length)
  const facts = nextTrip ? await getNextTripFacts(nextTrip.id, nextTrip.start_date, today) : null

  return (
    <Reveal mode="mount" className="pb-16">
      <RevealItem className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-headline text-foreground">
            {firstName ? `Welcome back, ${firstName}` : "Your trips"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {nextTrip ? "Here's what's coming up." : "Everything you're planning, in one place."}
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/trips/new" />} className="w-full sm:w-auto">
          <Plus aria-hidden="true" />
          New trip
        </Button>
      </RevealItem>

      {trips.length === 0 ? (
        <>
          <RevealItem className="mb-10">
            <EmptyState
              icon={Plane}
              title="No trips yet"
              description="Create your first trip and let AI build the itinerary for you — or start from one of the ideas below."
              action={
                <Button nativeButton={false} render={<Link href="/trips/new" />} className="mt-1">
                  <Plus aria-hidden="true" />
                  Plan your first trip
                </Button>
              }
            />
          </RevealItem>
          <RevealItem>
            <QuickStartRail />
          </RevealItem>
        </>
      ) : (
        <>
          {nextTrip && facts ? (
            <RevealItem className="mb-10">
              <h2 className="text-eyebrow text-muted-foreground mb-3">Next trip</h2>
              <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
                <NextTripHero trip={nextTrip} facts={facts} />
                <section aria-label="Overview">
                  <DashboardStats stats={stats} />
                </section>
              </div>
            </RevealItem>
          ) : (
            <RevealItem className="mb-10">
              <section aria-label="Overview">
                <DashboardStats stats={stats} layout="band" />
              </section>
            </RevealItem>
          )}

          <RevealItem className="mb-10">
            <QuickStartRail />
          </RevealItem>

          {yourTrips.length > 0 ? (
            <RevealItem>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="text-eyebrow text-muted-foreground">
                  {nextTrip ? "Your other trips" : "Your trips"}
                </h2>
                <Link
                  href="/trips"
                  className="group text-label-md text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-0"
                >
                  View all
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Link>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {yourTrips.map((trip) => (
                  <li key={trip.id} className="grid min-w-0">
                    <TripCard trip={trip} />
                  </li>
                ))}
              </ul>
            </RevealItem>
          ) : null}
        </>
      )}
    </Reveal>
  )
}
