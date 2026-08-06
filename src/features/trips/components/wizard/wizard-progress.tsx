"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface WizardProgressProps {
  steps: readonly { id: string; title: string }[]
  currentIndex: number
}

/**
 * Progress indicator for the creation wizard.
 *
 * Rendered as an ordered list with `aria-current` on the active step so the
 * structure is meaningful to a screen reader, rather than a row of divs whose
 * meaning is carried only by colour. The numeric "Step N of M" line is not
 * `sr-only` — it's genuinely useful to everyone, and it's the only part that
 * survives on the narrowest screens where the labels are hidden.
 */
export function WizardProgress({ steps, currentIndex }: WizardProgressProps) {
  const percent = ((currentIndex + 1) / steps.length) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-foreground">
          Step {currentIndex + 1} of {steps.length}
        </p>
        <p className="text-sm text-muted-foreground">
          {steps[currentIndex]?.title}
        </p>
      </div>

      {/* The bar is decorative: the same information is already in the text
          above and in the list below, so exposing it again would just make a
          screen reader repeat itself. */}
      <div
        aria-hidden="true"
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="hidden gap-2 sm:grid sm:grid-cols-4">
        {steps.map((step, index) => {
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold transition-colors",
                  isDone && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary/15 text-primary ring-1 ring-primary",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? (
                  <Check aria-hidden="true" className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "truncate text-xs transition-colors",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
