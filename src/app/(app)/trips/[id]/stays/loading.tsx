import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors stays/page.tsx: back link, heading, sandbox notice, the search form. Changed with it. */
export default function StaysSearchLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-sm" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="flex items-end sm:col-span-2 lg:justify-end">
          <Skeleton className="h-11 w-full rounded-lg sm:w-40" />
        </div>
      </div>
    </div>
  )
}
