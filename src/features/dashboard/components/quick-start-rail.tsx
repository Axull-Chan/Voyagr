import Link from "next/link"

import { Button } from "@/components/ui/button"
import { TRIP_PRESETS } from "@/lib/trips/trip-presets"

/**
 * One-click starters into the trip wizard. Each is a plain link to
 * `/trips/new?preset=<id>`: it fills the form (replacing any saved draft) and
 * nothing more — the traveller still checks every step and presses Create, so
 * no trip is generated and no AI quota is spent from here.
 *
 * A single scrolling row on a phone (snap per item) rather than a wrapping
 * grid, so four items never leave an orphan on a half-empty last line.
 */
export function QuickStartRail({ className }: { className?: string }) {
  return (
    <section aria-labelledby="quick-start-heading" className={className}>
      <h2 id="quick-start-heading" className="text-eyebrow text-muted-foreground mb-3">
        Start a trip
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {TRIP_PRESETS.map((preset) => (
          <li key={preset.id} className="shrink-0 snap-start">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/trips/new?preset=${preset.id}`} />}
            >
              {preset.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
