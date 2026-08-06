import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Reveal, RevealItem } from "@/components/shared/reveal"
import { CreateTripWizard } from "@/features/trips/components/wizard/create-trip-wizard"

export const metadata: Metadata = {
  title: "New trip",
  description: "Tell Voyagr about your trip and get a day-by-day itinerary.",
}

export default function NewTripPage() {
  return (
    <Reveal mode="mount" className="mx-auto w-full max-w-2xl space-y-6">
      <RevealItem>
        <Link
          href="/trips"
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All trips
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Plan a new trip
        </h1>
        <p className="text-sm text-muted-foreground">
          Four short steps. We&apos;ll build the itinerary from your answers.
        </p>
      </RevealItem>

      <RevealItem>
        <CreateTripWizard />
      </RevealItem>
    </Reveal>
  )
}
