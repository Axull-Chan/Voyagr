import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shown while the trip loads.
 *
 * Mirrors the real layout's shape and heights so the page settles in place
 * rather than shifting when content arrives.
 */
export default function TripDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-56 w-full rounded-2xl sm:h-72" />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-72 w-full rounded-xl sm:h-96" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border p-5">
                <div className="flex justify-between gap-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-8 w-48 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-full max-w-md" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full max-w-sm" />
                  <Skeleton className="h-4 w-full max-w-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
