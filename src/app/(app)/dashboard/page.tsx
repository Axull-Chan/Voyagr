import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Globe2,
  Luggage,
  Plane,
  Plus,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealGroup, RevealItem } from "@/components/shared/reveal"
import { buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatCard } from "@/features/trips/components/stat-card"
import { TripCard } from "@/features/trips/components/trip-card"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

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
      .select("id, title, destination, start_date, end_date, status, created_at")
      .order("created_at", { ascending: false }),
  ])

  const trips = tripsData ?? []
  const firstName = profile?.full_name?.split(" ")[0]
  const today = new Date().toISOString().slice(0, 10)

  const upcomingTrips = trips
    .filter((trip) => trip.start_date && trip.start_date >= today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
    .slice(0, 3)
  const recentTrips = trips.slice(0, 3)

  const upcomingCount = trips.filter(
    (trip) => trip.start_date && trip.start_date >= today
  ).length
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

  return (
    <Reveal mode="mount" className="space-y-8">
      <RevealItem>
        <h1 className="text-2xl font-semibold text-foreground">
          {firstName ? `Welcome back, ${firstName}` : "Your trips"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;re planning, in one place.
        </p>
      </RevealItem>

      <RevealGroup className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RevealItem>
          <StatCard icon={Luggage} label="Total trips" value={trips.length} />
        </RevealItem>
        <RevealItem>
          <StatCard
            icon={CalendarClock}
            label="Upcoming"
            value={upcomingCount}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            icon={Globe2}
            label="Destinations"
            value={destinationCount}
          />
        </RevealItem>
        <RevealItem>
          <StatCard icon={CalendarDays} label="Days planned" value={totalDays} />
        </RevealItem>
      </RevealGroup>

      <RevealGroup className="grid gap-4 sm:grid-cols-2">
        <RevealItem className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <div>
            <p className="font-medium text-foreground">Plan a new trip</p>
            <p className="text-sm text-muted-foreground">
              AI builds the itinerary for you
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  aria-disabled="true"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "cursor-not-allowed opacity-60"
                  )}
                />
              }
            >
              <Plus aria-hidden="true" />
              New trip
            </TooltipTrigger>
            <TooltipContent>Coming in Phase 3</TooltipContent>
          </Tooltip>
        </RevealItem>
        <RevealItem
          className="rounded-xl"
        >
          <Link
            href="/trips"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <div>
              <p className="font-medium text-foreground">View all trips</p>
              <p className="text-sm text-muted-foreground">
                Browse everything you&apos;re planning
              </p>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Link>
        </RevealItem>
      </RevealGroup>

      {trips.length === 0 ? (
        <RevealItem>
          <EmptyState
            icon={Plane}
            title="No trips yet"
            description="Create your first trip and let AI build the itinerary for you."
          />
        </RevealItem>
      ) : (
        <>
          <RevealItem className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Upcoming trips
            </h2>
            {upcomingTrips.length > 0 ? (
              <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingTrips.map((trip) => (
                  <RevealItem key={trip.id}>
                    <TripCard trip={trip} />
                  </RevealItem>
                ))}
              </RevealGroup>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming trips right now.
              </p>
            )}
          </RevealItem>

          <RevealItem className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Recent trips
            </h2>
            <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentTrips.map((trip) => (
                <RevealItem key={trip.id}>
                  <TripCard trip={trip} />
                </RevealItem>
              ))}
            </RevealGroup>
          </RevealItem>
        </>
      )}
    </Reveal>
  )
}
