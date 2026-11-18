import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Reveal, RevealItem } from "@/components/shared/reveal"
import { createClient } from "@/lib/supabase/server"
import { CreateTripWizard } from "@/features/trips/components/wizard/create-trip-wizard"
import { getAiQuotaHint } from "@/features/trips/services/ai-quota"

export const metadata: Metadata = {
  title: "New trip",
  description: "Tell Voyagr about your trip and get a day-by-day itinerary.",
}

/**
 * How long this page's server actions may run, in seconds — and it must be a
 * literal, since Next reads it statically.
 *
 * Creating a trip runs `createTripAction` here, which waits on a real model.
 * A measured run took ~79 s including one retry, and the worst case is two
 * 60 s Gemini attempts plus backoff plus the places/forecast/photo lookups
 * (~2.5 min). Left to the platform default this was unknown: a project without
 * Fluid Compute gets 10–15 s, which would kill every real generation and leave
 * the trip stuck as a draft. 150 s covers the worst case while still bounding
 * a hung request. Same value on `/trips/[id]`, where the chat runs.
 */
export const maxDuration = 150

export default async function NewTripPage() {
  // "N trips left today". Never blocks or breaks the page: `getAiQuotaHint`
  // returns null on any failure, a slow database (1.5 s cap) or the free mock
  // provider, and the wizard simply shows no caption.
  const supabase = await createClient()
  const quotaHint = await getAiQuotaHint(supabase, "trip_generation")

  return (
    // space-y-8, not -6: a form this narrow already reads as a deliberately
    // editorial, single-column page rather than a dashboard tool — matching
    // that requires the same "narrative gets room" treatment the day
    // summary and trip hero use, not a tighter, denser gap.
    <Reveal mode="mount" className="mx-auto w-full max-w-2xl space-y-8">
      <RevealItem>
        <Link
          href="/trips"
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All trips
        </Link>
        <h1 className="mt-3 text-headline text-foreground">
          Plan a new trip
        </h1>
        <p className="text-sm text-muted-foreground">
          Four short steps. We&apos;ll build the itinerary from your answers.
        </p>
      </RevealItem>

      <RevealItem>
        <CreateTripWizard quotaHint={quotaHint} />
      </RevealItem>
    </Reveal>
  )
}
