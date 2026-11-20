"use client"

import { useTransition } from "react"
import { CloudRain, Gauge, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { proposeReplanAction } from "@/features/trips/actions/replan.actions"
import {
  REPLAN_PROPOSAL_EVENT,
  type ReplanProposalDetail,
} from "@/features/trips/components/detail/replan-events"

/**
 * "Optimize pace" / "Adapt for weather" for one day. Asks the server for a
 * deterministic replan; a proposal opens in the chat panel for review (nothing
 * is changed until Apply), and "no safe change" is said in a toast.
 */
export function ReplanButton({
  tripId,
  dayNumber,
  kind,
  forecast,
}: {
  tripId: string
  dayNumber: number
  kind: "pace" | "weather"
  /** The forecast this page shows for the day (weather only). */
  forecast?: { condition: string; precipitationChance: number | null; windKph: number | null }
}) {
  const [isPending, startTransition] = useTransition()

  function propose() {
    startTransition(async () => {
      const result = await proposeReplanAction({ tripId, dayNumber, kind, forecast })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (!result.proposal) {
        toast(result.reply)
        return
      }
      window.dispatchEvent(
        new CustomEvent<ReplanProposalDetail>(REPLAN_PROPOSAL_EVENT, {
          detail: { proposal: result.proposal, supersededIds: result.supersededIds },
        })
      )
    })
  }

  const Icon = isPending ? Loader2 : kind === "pace" ? Gauge : CloudRain
  return (
    <Button type="button" variant="outline" size="sm" onClick={propose} disabled={isPending}>
      <Icon aria-hidden="true" className={isPending ? "animate-spin" : undefined} />
      {kind === "pace" ? "Optimize pace" : "Adapt for weather"}
    </Button>
  )
}
