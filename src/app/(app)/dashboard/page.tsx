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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {firstName ? `Welcome back, ${firstName}` : "Your trips"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;re planning, in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Luggage} label="Total trips" value={trips.length} />
        <StatCard
          icon={CalendarClock}
          label="Upcoming"
          value={upcomingCount}
        />
        <StatCard icon={Globe2} label="Destinations" value={destinationCount} />
        <StatCard
          icon={CalendarDays}
          label="Days planned"
          value={totalDays}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
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
              <Plus />
              New trip
            </TooltipTrigger>
            <TooltipContent>Coming in Phase 3</TooltipContent>
          </Tooltip>
        </div>
        <Link
          href="/trips"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <div>
            <p className="font-medium text-foreground">View all trips</p>
            <p className="text-sm text-muted-foreground">
              Browse everything you&apos;re planning
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No trips yet"
          description="Create your first trip and let AI build the itinerary for you."
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Upcoming trips
            </h2>
            {upcomingTrips.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming trips right now.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Recent trips
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
