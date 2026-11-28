import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { bookingConfig } from "@/lib/config/providers"
import { HotelSearch } from "@/features/bookings/components/hotel-search"
import { SandboxNotice } from "@/features/bookings/components/sandbox-notice"
import { getTripBookings } from "@/features/bookings/queries/bookings"
import { bookingStatusView, defaultStay } from "@/features/bookings/services/booking-view"

export const metadata: Metadata = { title: "Find a hotel" }

/**
 * Server actions run in this page's function. A search is quick, but choosing a
 * room leads straight into checkout, and keeping the same limit as the trip
 * page means no booking step can be cut off mid-request.
 */
export const maxDuration = 150

export default async function StaysSearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, travelers")
    .eq("id", id)
    .maybeSingle()
  if (!trip) notFound()

  const enabled = bookingConfig().enabled
  const openCheckout = (await getTripBookings(id)).find((b) => bookingStatusView(b.status).inCheckout)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/trips/${id}`} />} className="-ml-2">
        <ArrowLeft aria-hidden="true" />
        {trip.title}
      </Button>
      <header className="space-y-1">
        <h1 className="text-headline text-foreground">Find a hotel</h1>
        <p className="text-muted-foreground text-sm">Rooms near the places on your trip in {trip.destination}.</p>
      </header>

      {!enabled ? (
        <p className="text-muted-foreground border-border border-t py-10 text-center text-sm">
          Hotel booking isn&apos;t available right now.
        </p>
      ) : !trip.start_date || !trip.end_date ? (
        <p className="text-muted-foreground border-border border-t py-10 text-center text-sm">
          Add dates to this trip first — use Change dates in the trip&apos;s menu.
        </p>
      ) : (
        <>
          <SandboxNotice />
          {openCheckout ? (
            <p className="text-sm">
              You have a checkout in progress for {openCheckout.hotel_name}.{" "}
              <Link
                href={`/trips/${id}/stays/${openCheckout.id}`}
                className="text-primary focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
              >
                Continue checkout
              </Link>
            </p>
          ) : null}
          <HotelSearch
            tripId={id}
            destination={trip.destination}
            defaults={{ ...defaultStay(trip.start_date, trip.end_date), adults: trip.travelers }}
          />
        </>
      )}
    </div>
  )
}
