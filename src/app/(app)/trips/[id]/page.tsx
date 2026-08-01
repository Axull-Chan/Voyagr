import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, MapPin, Sparkles } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

const statusLabel: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates not set"
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const startLabel = formatter.format(new Date(start))
  if (!end) return startLabel
  return `${startLabel} – ${formatter.format(new Date(end))}`
}

interface TripDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: TripDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: trip } = await supabase
    .from("trips")
    .select("title")
    .eq("id", id)
    .single()

  return { title: trip?.title ?? "Trip" }
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status")
    .eq("id", id)
    .single()

  if (!trip) {
    notFound()
  }

  return (
    <Reveal mode="mount" className="space-y-6">
      <RevealItem>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/trips" />}
        >
          <ArrowLeft aria-hidden="true" />
          Back to my trips
        </Button>
      </RevealItem>

      <RevealItem className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {trip.title}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="size-4" />
              {trip.destination}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {statusLabel[trip.status] ?? trip.status}
          </Badge>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4" />
          {formatDateRange(trip.start_date, trip.end_date)}
        </div>
      </RevealItem>

      <RevealItem>
        <EmptyState
          icon={Sparkles}
          title="Full itinerary coming soon"
          description="Day-by-day planning, budget breakdowns, and AI-generated activities will appear here soon."
        />
      </RevealItem>
    </Reveal>
  )
}
