import type { Metadata } from "next"
import { Plane } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Your trips</h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;re planning, in one place.
        </p>
      </div>

      {trips && trips.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="font-medium text-foreground">{trip.title}</p>
              <p className="text-sm text-muted-foreground">
                {trip.destination}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Plane}
          title="No trips yet"
          description="Create your first trip and let AI build the itinerary for you."
        />
      )}
    </div>
  )
}
