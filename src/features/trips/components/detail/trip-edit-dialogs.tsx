"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  shiftTripDatesAction,
  updateTripBudgetAction,
} from "@/features/trips/actions/trip-management.actions"
import {
  MAX_DAYS_IN_PAST,
  addYears,
  dateShiftBlockedReason,
  describeShiftPreview,
  isoToday,
  parseBudgetInput,
  previewDateShift,
} from "@/features/trips/services/trip-edit"
import { addDays } from "@/lib/trips/trip-domain"

/**
 * Change dates: a new start date, the same length. The preview shows where the
 * trip lands before anything is saved; the server re-checks every rule.
 */
export function ChangeDatesDialog({
  open,
  onOpenChange,
  tripId,
  status,
  startDate,
  endDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  status: string
  startDate: string
  endDate: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(startDate)
  const [error, setError] = useState<string | null>(null)

  const today = isoToday()
  // Only an untouched or valid choice gets a preview; the error says why otherwise.
  const problem = draft === startDate ? null : dateShiftBlockedReason({ status, startDate, endDate }, draft, today)
  const preview = draft && !problem ? previewDateShift(startDate, endDate, draft) : null

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(startDate)
      setError(null)
    }
    onOpenChange(next)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const blocked = dateShiftBlockedReason({ status, startDate, endDate }, draft, today)
    if (blocked) {
      setError(blocked)
      return
    }
    startTransition(async () => {
      const result = await shiftTripDatesAction({ tripId, startDate: draft })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      toast.success("Dates changed. Forecasts will refresh for the new dates.")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change dates</DialogTitle>
            <DialogDescription>
              The whole trip moves together and keeps its length. Your stay and transport move with it;
              expenses you&apos;ve logged keep their dates.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="change-dates-start">New start date</Label>
            <Input
              id="change-dates-start"
              type="date"
              value={draft}
              min={addDays(today, -MAX_DAYS_IN_PAST)}
              max={addYears(today, 2)}
              onChange={(event) => {
                setDraft(event.target.value)
                setError(null)
              }}
              autoFocus
              aria-invalid={error || problem ? true : undefined}
              aria-describedby="change-dates-preview"
            />
            <p id="change-dates-preview" className="text-data-sm text-muted-foreground" aria-live="polite">
              {preview ? describeShiftPreview(preview) : null}
            </p>
            {error || problem ? (
              <p role="alert" className="text-sm text-destructive">
                {error ?? problem}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || draft === startDate || Boolean(problem)}>
              {isPending ? "Saving…" : "Change dates"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Edit budget: an amount in the trip's own currency, or empty for no budget.
 * The planned budget lines are re-derived from it on the server.
 */
export function EditBudgetDialog({
  open,
  onOpenChange,
  tripId,
  budget,
  currency,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  budget: number | null
  currency: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const initial = budget === null ? "" : String(budget)
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(initial)
      setError(null)
    }
    onOpenChange(next)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseBudgetInput(draft)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    startTransition(async () => {
      const result = await updateTripBudgetAction({ tripId, budget: parsed.budget })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      toast.success(parsed.budget === null ? "Budget cleared." : "Budget updated.")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit budget</DialogTitle>
            <DialogDescription>
              Your planned spending by category is recalculated from the new total. Leave it empty for no
              budget.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="edit-budget-amount">Total budget ({currency})</Label>
            <div className="flex items-center gap-2">
              <Input
                id="edit-budget-amount"
                inputMode="decimal"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setError(null)
                }}
                placeholder="No budget"
                autoComplete="off"
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "edit-budget-error" : undefined}
              />
              <span className="text-data-sm text-muted-foreground">{currency}</span>
            </div>
            {draft !== "" ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("")
                  setError(null)
                }}
                className="w-fit rounded-sm text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Clear budget
              </button>
            ) : null}
            {error ? (
              <p id="edit-budget-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || draft.trim() === initial}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
