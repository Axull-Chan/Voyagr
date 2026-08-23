"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-day-heading text-foreground">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. You can try again.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
