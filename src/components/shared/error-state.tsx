"use client"

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    // Same treatment as EmptyState: no enclosing card, no tinted disc. The
    // warning icon stays — an error genuinely needs a signal, and `destructive`
    // on the glyph itself carries it without a decorative container.
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-20 text-center",
        className
      )}
    >
      <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
      <div className="space-y-1.5">
        <h3 className="text-day-heading text-foreground">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
