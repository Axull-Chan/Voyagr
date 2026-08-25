import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mirrors the trips page: header with action, the lead trip, then the divided
 * index. Not the uniform card grid this file used to draw — that is exactly
 * the desync DESIGN.md's Loading rule exists to prevent.
 */
export default function TripsLoading() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="mb-10">
        <Skeleton className="mb-3 h-3 w-12" />
        <Skeleton className="aspect-video w-full rounded-xl sm:aspect-auto sm:h-72" />
      </div>

      <div>
        <Skeleton className="mb-2 h-3 w-28" />
        <div className="divide-y divide-border border-t border-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-12 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-32 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
