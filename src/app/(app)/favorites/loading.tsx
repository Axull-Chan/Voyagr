import { Skeleton } from "@/components/ui/skeleton"

export default function FavoritesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Mirrors the real page, which is a single divided list of rows — not
          the three-column grid of boxes this skeleton drew before the
          card→row conversion. A skeleton promising a different shape than
          the page delivers reintroduces exactly the settle-shift it exists
          to prevent. */}
      <div className="divide-y divide-border border-t border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 w-full max-w-56" />
            <Skeleton className="ml-auto h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
