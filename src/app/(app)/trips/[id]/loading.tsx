import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shown while the trip loads.
 *
 * Mirrors the real page's composition and heights so nothing shifts when
 * content arrives: hero, then the day plan holding the main column with the
 * map and reference rail beside it, then the planning tools in a band below.
 * Updated in the same commit as the Stage 3D composition it stands in for.
 */
export default function TripDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-4 h-8 w-24" />
      <Skeleton className="mb-8 h-64 w-full rounded-2xl sm:mb-10 sm:h-80 lg:h-96" />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10">
        {/* The day plan: open articles separated by rules, never cards. */}
        <div className="min-w-0">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3 py-6 first:pt-0">
                <div className="flex justify-between gap-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-8 w-48 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-full max-w-md" />
                {/* The day's pace line (route and timing check). */}
                <Skeleton className="h-3 w-56" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full max-w-sm" />
                  <Skeleton className="h-4 w-full max-w-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rail: map, then the reference panel. */}
        <div className="space-y-6">
          <div>
            <Skeleton className="mb-2 h-5 w-40" />
            <Skeleton className="h-64 w-full rounded-xl sm:h-72" />
          </div>
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
            {/* The Stays panel's "Find a hotel" button (when booking is on). */}
            <Skeleton className="mt-4 h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* Planning tools band. */}
      <div className="mt-14 grid gap-10 sm:mt-16 lg:grid-cols-2">
        <div>
          <Skeleton className="mb-3 h-6 w-24" />
          <div className="space-y-4 border-t border-border pt-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        </div>

        <div>
          <Skeleton className="mb-3 h-6 w-24" />
          <div className="space-y-2 border-t border-border pt-5">
            <Skeleton className="h-1 w-full rounded-full" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-full max-w-xs" />
            ))}
          </div>
        </div>
      </div>

      {/* The AI notice and data-sources credit at the foot of the page. */}
      <div className="mt-14 space-y-1.5 border-t border-border pt-5 sm:mt-16">
        <Skeleton className="h-3 w-full max-w-md" />
        <Skeleton className="h-3 w-full max-w-lg" />
      </div>
    </div>
  )
}
