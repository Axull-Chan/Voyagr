import type { Metadata } from "next"
import Link from "next/link"
import { Plane, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealGroup, RevealItem } from "@/components/shared/reveal"
import { Button } from "@/components/ui/button"
import { TripCard } from "@/features/trips/components/trip-card"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "My Trips" }

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status")
    .order("created_at", { ascending: false })

  return (
    <Reveal mode="mount" className="space-y-6">
      <RevealItem className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My trips</h1>
          <p className="text-sm text-muted-foreground">
            Every trip you&apos;ve planned, in one place.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/trips/new" />}>
          <Plus aria-hidden="true" />
          New trip
        </Button>
      </RevealItem>

      {trips && trips.length > 0 ? (
        <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <RevealItem key={trip.id}>
              <TripCard trip={trip} />
            </RevealItem>
          ))}
        </RevealGroup>
      ) : (
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
      )}
    </Reveal>
  )
}
