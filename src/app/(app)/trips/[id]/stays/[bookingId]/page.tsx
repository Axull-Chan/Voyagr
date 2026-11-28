import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BookingCheckout } from "@/features/bookings/components/booking-checkout"
import { SandboxNotice } from "@/features/bookings/components/sandbox-notice"
import { getCheckoutBooking } from "@/features/bookings/queries/bookings"

export const metadata: Metadata = { title: "Checkout" }

/** Prebook and book can each take up to ~2 minutes (provider docs); see CLAUDE.md. */
export const maxDuration = 150

export default async function BookingCheckoutPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params
  // Row-level security: someone else's booking reads as missing, so it 404s.
  const booking = await getCheckoutBooking(id, bookingId)
  if (!booking) notFound()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16">
      <SandboxNotice />
      <BookingCheckout booking={booking} />
    </div>
  )
}
