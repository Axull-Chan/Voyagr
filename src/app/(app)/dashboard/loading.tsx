import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mirrors the dashboard's composition: header with action, the featured next
 * trip beside its overview rail, then the compact index. Updated in the same
 * commit as the layout it stands in for.
 */
export default function DashboardLoading() {
  return (
    <div className="pb-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      {/* Featured next trip and its overview rail: stacked below lg, the
          image beside the four figures from lg up — see dashboard/page.tsx. */}
      <div className="mb-10">
        <Skeleton className="mb-3 h-3 w-20" />
        <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
          <Skeleton className="aspect-video w-full rounded-xl sm:aspect-auto sm:h-72" />
          <div className="flex flex-wrap gap-x-10 gap-y-4 border-y border-border py-4 lg:flex-col lg:flex-nowrap lg:gap-y-5 lg:border-none lg:py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
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
