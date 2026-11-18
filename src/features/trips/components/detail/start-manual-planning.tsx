"use client"

import { useState, useTransition } from "react"
import { CalendarPlus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { startManualItineraryAction } from "@/features/trips/actions/itinerary.actions"

/**
 * For a draft trip that has no days: sets up one empty day per date so the traveller
 * can plan it by hand. No model is called. The action revalidates the trip page, so the
 * days simply appear once it returns.
 */
export function StartManualPlanning({ tripId }: { tripId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function start() {
    setError(null)
    startTransition(async () => {
      const result = await startManualItineraryAction(tripId)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <Button type="button" variant="outline" disabled={isPending} onClick={start}>
        {isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <CalendarPlus aria-hidden="true" />
        )}
        {isPending ? "Setting up your days…" : "Plan it by hand"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
