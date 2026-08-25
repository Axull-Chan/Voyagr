import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mirrors the dashboard's composition: header with action, the featured next
 * trip, the quiet overview line, then the compact index. Updated in the same
 * commit as the layout it stands in for.
 */
export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      {/* Featured next trip: stacked below sm, image beside content above it. */}
      <div className="mb-10">
        <Skeleton className="mb-3 h-3 w-20" />
        <Skeleton className="aspect-video w-full rounded-xl sm:aspect-auto sm:h-72" />
      </div>

      <div className="mb-10 border-y border-border py-4">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="mb-2 h-3 w-28" />
        <div className="divide-y divide-border border-t border-border">
          {Array.from({ length: 3 }).map((_, i) => (
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
