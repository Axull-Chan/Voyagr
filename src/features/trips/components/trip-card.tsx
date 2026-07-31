import Link from "next/link"
import { CalendarDays, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Tables } from "@/types/database.types"

type Trip = Pick<
  Tables<"trips">,
  "id" | "title" | "destination" | "start_date" | "end_date" | "status"
>

const statusLabel: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates not set"
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
  const startLabel = formatter.format(new Date(start))
  if (!end) return startLabel
  return `${startLabel} – ${formatter.format(new Date(end))}`
}

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
        <MapPin className="size-6 text-primary/60" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-foreground">{trip.title}</p>
          <Badge variant="outline" className="shrink-0">
            {statusLabel[trip.status] ?? trip.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{trip.destination}</p>
        <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {formatDateRange(trip.start_date, trip.end_date)}
        </div>
      </div>
    </Link>
  )
}
