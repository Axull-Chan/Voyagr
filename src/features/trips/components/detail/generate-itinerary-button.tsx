"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { regenerateTripAction } from "@/features/trips/actions/trip.actions"

/**
 * Generates the itinerary for a draft trip — one whose first generation failed
 * or was cut off — from the details already saved on it. Runs under the trip
 * page's own `maxDuration`, the same limit as creating a trip.
 */
export function GenerateItineraryButton({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      const result = await regenerateTripAction(tripId)
      if (result.ok) {
        toast.success("Your itinerary is ready.")
      } else {
        toast.error(result.error)
      }
      // Either way the stored status changed (ready, or back to draft).
      router.refresh()
    })
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <Button onClick={generate} disabled={isPending}>
        <Sparkles aria-hidden="true" />
        {isPending ? "Generating…" : "Generate itinerary"}
      </Button>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {isPending ? "This can take a minute or two. Keep this page open." : "Uses one of today's trip generations."}
      </p>
    </div>
  )
}
