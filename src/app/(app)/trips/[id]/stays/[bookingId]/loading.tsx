import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors stays/[bookingId]/page.tsx: sandbox notice, then the checkout column beside its summary rail. */
export default function BookingCheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16">
      <Skeleton className="h-10 w-full rounded-sm" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg sm:w-64" />
        </div>
        <div className="divide-border border-border divide-y border-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between py-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
