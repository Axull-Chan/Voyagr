import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Mirrors dashboard/page.tsx: header with a 44px New trip button; the hero
 * (media half, details half with four fact rules and a 44px button) beside the
 * 2×2 stats; the Start-a-trip rail; then a 3-column grid of trip cards.
 * Changed in the same commit as the page, per DESIGN.md's loading-state rule.
 */
export default function DashboardLoading() {
  return (
    <div className="pb-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
      </div>

      <div className="mb-10">
        <Skeleton className="mb-3 h-3 w-20" />
        <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
          <div className="bg-card grid overflow-hidden rounded-xl sm:grid-cols-2">
            <Skeleton className="aspect-video rounded-none sm:aspect-auto sm:min-h-80" />
            <div className="flex flex-col gap-4 p-6">
              <div className="space-y-2">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <div className="divide-border border-border divide-y border-y">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
              <Skeleton className="mt-auto h-11 w-48 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn("border-border space-y-2 px-4 py-5", i % 2 === 0 && "border-r", i < 2 && "border-b")}
              >
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-10">
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card overflow-hidden rounded-xl">
              <Skeleton className="aspect-4/3 rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
