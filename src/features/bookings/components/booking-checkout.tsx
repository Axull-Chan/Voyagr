"use client"

import { useId, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/trips/trip-domain"
import { formatDateRange } from "@/features/trips/components/trip-card"
import {
  acceptPriceChangeAction,
  bookRoomAction,
  cancelBookingAction,
  discardSelectionAction,
  prebookRoomAction,
  resolvePendingBookingAction,
} from "@/features/bookings/actions/booking.actions"
import {
  bookingStatusView,
  cancellationText,
  nightsBetween,
  priceChangeText,
  storedCancellation,
  totalText,
  type StatusTone,
} from "@/features/bookings/services/booking-view"
import type { CheckoutBooking } from "@/features/bookings/queries/bookings"

/**
 * One page for the whole checkout, driven by the booking's stored status. After
 * every action the page re-reads the row from the server (`router.refresh()`),
 * so what's on screen is always the database's state, never a local guess.
 */

const TONE: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  notice: "text-notice-foreground",
  positive: "text-primary",
  danger: "text-destructive",
}

export function BookingCheckout({ booking }: { booking: CheckoutBooking }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const view = bookingStatusView(booking.status)
  const nights = nightsBetween(booking.check_in, booking.check_out)
  const quoted = Number(booking.quoted_total)
  const checked = booking.prebook_total === null ? null : Number(booking.prebook_total)
  const change = checked === null ? null : priceChangeText(quoted, checked, booking.currency)
  const needsAcceptance = booking.status === "prebooked" && change !== null && !booking.price_change_accepted_at
  const shownTotal = booking.status === "booked" && booking.final_total !== null ? Number(booking.final_total) : (checked ?? quoted)
  const cancel = cancellationText(storedCancellation(booking.cancellation_policy, booking.refundable_until))
  const tripHref = booking.trip_id ? `/trips/${booking.trip_id}` : "/trips"
  const searchHref = booking.trip_id ? `/trips/${booking.trip_id}/stays` : "/trips"

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string } & Record<string, unknown>>) {
    setError(null)
    setMessage(null)
    setBusyLabel(label)
    startTransition(async () => {
      const r = await fn()
      setBusyLabel(null)
      if (!r.ok) setError(r.error ?? "Something went wrong. Please try again.")
      else if (typeof r.message === "string") setMessage(r.message)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <section aria-labelledby="checkout-heading" className="min-w-0 space-y-6">
        <header className="space-y-2">
          <p className={cn("text-eyebrow", TONE[view.tone])} aria-live="polite">
            {view.label}
          </p>
          <h1 id="checkout-heading" className="text-headline text-foreground">
            {booking.hotel_name}
          </h1>
          {booking.address ? <p className="text-muted-foreground text-sm">{booking.address}</p> : null}
          <p className="text-muted-foreground text-sm">
            {needsAcceptance ? "The hotel quoted a different price. Review it before you continue." : view.description}
          </p>
        </header>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-foreground text-sm">
            {message}
          </p>
        ) : null}

        {booking.status === "room_selected" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Prices change quickly. Checking asks the hotel to confirm this room and price right now — it can take
              up to two minutes.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" disabled={pending} onClick={() => run("Checking with the hotel…", () => prebookRoomAction(booking.id))}>
                {busyLabel ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                {busyLabel ?? "Check price and availability"}
              </Button>
              <DiscardButton bookingId={booking.id} searchHref={searchHref} disabled={pending} />
            </div>
          </div>
        ) : null}

        {booking.status === "prebooked" && needsAcceptance ? (
          <div className="space-y-3">
            <p role="alert" className="border-notice-border bg-notice text-notice-foreground rounded-sm border px-3 py-2 text-sm">
              {change}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" disabled={pending} onClick={() => run("Saving…", () => acceptPriceChangeAction(booking.id))}>
                Accept {formatCurrency(checked ?? quoted, booking.currency)}
              </Button>
              <DiscardButton bookingId={booking.id} searchHref={searchHref} disabled={pending} label="Choose a different room" />
            </div>
          </div>
        ) : null}

        {booking.status === "prebooked" && !needsAcceptance ? (
          <GuestForm
            disabled={pending}
            busyLabel={busyLabel}
            cancel={cancel}
            totalLabel={totalText(shownTotal, booking.currency, nights)}
            onSubmit={(guest) => run("Booking…", () => bookRoomAction({ bookingId: booking.id, guest }))}
            onRecheck={() => run("Checking with the hotel…", () => prebookRoomAction(booking.id))}
          />
        ) : null}

        {booking.status === "booking" || booking.status === "pending_confirmation" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Don&apos;t book this room again elsewhere yet: the booking may already have gone through.
            </p>
            <Button size="lg" variant="outline" disabled={pending} onClick={() => run("Checking…", () => resolvePendingBookingAction(booking.id))}>
              {busyLabel ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
              {busyLabel ?? "Check status"}
            </Button>
          </div>
        ) : null}

        {booking.status === "booked" ? (
          <BookedDetails booking={booking} cancel={cancel} disabled={pending} total={shownTotal} />
        ) : null}

        {booking.status === "failed" || booking.status === "cancelled" ? (
          <div className="space-y-3">
            {booking.failure_message ? <p className="text-muted-foreground text-sm">{booking.failure_message}</p> : null}
            <Button size="lg" nativeButton={false} render={<Link href={searchHref} />}>
              Search again
            </Button>
          </div>
        ) : null}

        <p className="text-muted-foreground text-caption">
          <Link href={tripHref} className="focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none">
            Back to the trip
          </Link>
        </p>
      </section>

      <aside aria-label="Stay summary" className="border-border space-y-3 border-t pt-4 lg:border-t-0 lg:pt-0">
        <dl className="divide-border border-border divide-y border-y">
          <SummaryRow label="Room" value={booking.room_name ?? "Room"} />
          <SummaryRow
            label="Dates"
            value={
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                {formatDateRange(booking.check_in, booking.check_out)} · {nights} {nights === 1 ? "night" : "nights"}
              </span>
            }
          />
          <SummaryRow label="Guests" value={`${booking.adults} ${booking.adults === 1 ? "adult" : "adults"}${booking.children ? `, ${booking.children} ${booking.children === 1 ? "child" : "children"}` : ""}`} />
          <SummaryRow label={booking.status === "booked" ? "Paid" : "Total"} value={<span className="text-data-md">{formatCurrency(shownTotal, booking.currency)}</span>} />
          <SummaryRow label="Cancellation" value={cancel.text} />
        </dl>
      </aside>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-caption text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground min-w-0 text-right text-sm">{value}</dd>
    </div>
  )
}

function DiscardButton({ bookingId, searchHref, disabled, label = "Choose a different room" }: { bookingId: string; searchHref: string; disabled: boolean; label?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="lg"
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          await discardSelectionAction(bookingId)
          router.push(searchHref)
        })
      }
    >
      {label}
    </Button>
  )
}

function GuestForm({
  disabled,
  busyLabel,
  cancel,
  totalLabel,
  onSubmit,
  onRecheck,
}: {
  disabled: boolean
  busyLabel: string | null
  cancel: { text: string; tone: "positive" | "caution" }
  totalLabel: string
  onSubmit: (guest: { firstName: string; lastName: string; email: string; phone: string | null }) => void
  onRecheck: () => void
}) {
  const id = useId()
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!first.trim()) next.first = "Enter a first name."
    if (!last.trim()) next.last = "Enter a last name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email."
    if (phone.trim() && !/^\+?[0-9 ()-]{6,24}$/.test(phone.trim())) next.phone = "Enter a valid phone number, or leave it empty."
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({ firstName: first.trim(), lastName: last.trim(), email: email.trim(), phone: phone.trim() || null })
  }

  const field = (key: string, label: string, input: React.ReactElement<React.ComponentProps<"input">>) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      {input}
      {errors[key] ? (
        <p id={`${id}-${key}-error`} role="alert" className="text-destructive text-sm">
          {errors[key]}
        </p>
      ) : null}
    </div>
  )
  const common = (key: string) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <h2 className="text-day-heading text-foreground">Lead guest</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("first", "First name", <Input {...common("first")} autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />)}
        {field("last", "Last name", <Input {...common("last")} autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />)}
        {field("email", "Email", <Input {...common("email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />)}
        {field("phone", "Phone (optional)", <Input {...common("phone")} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />)}
      </div>
      <p className="text-muted-foreground text-caption">
        Sent to the hotel and our booking provider to hold the room. The email gets the booking details.
      </p>
      <div className="border-border space-y-1 border-t pt-4">
        <p className="text-data-md text-foreground">{totalLabel}</p>
        <p className={cn("text-sm", cancel.tone === "positive" ? "text-foreground" : "text-muted-foreground")}>{cancel.text}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" disabled={disabled}>
          {busyLabel ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {busyLabel ?? "Book"}
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={disabled} onClick={onRecheck}>
          Check the price again
        </Button>
      </div>
    </form>
  )
}

function BookedDetails({
  booking,
  cancel,
  disabled,
  total,
}: {
  booking: CheckoutBooking
  cancel: { text: string; tone: "positive" | "caution" }
  disabled: boolean
  total: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function confirmCancel() {
    setError(null)
    start(async () => {
      const r = await cancelBookingAction(booking.id)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setOpen(false)
      toast.success(
        r.refundAmount !== null && r.currency
          ? `Booking cancelled. Refund: ${formatCurrency(r.refundAmount, r.currency)}.`
          : "Booking cancelled."
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="status" className="border-primary text-primary rounded-sm border px-1.5">
          Booked
        </Badge>
        {booking.confirmation_code ? (
          <span className="text-data-sm text-foreground">Confirmation {booking.confirmation_code}</span>
        ) : null}
      </div>
      <p className="text-data-md text-foreground">{formatCurrency(total, booking.currency)}</p>
      <p className="text-sm">{cancel.text}</p>
      <p className="text-muted-foreground text-caption">
        Your trip&apos;s stay and budget will update from this booking in a later step.
      </p>
      <Button variant="outline" size="lg" disabled={disabled} onClick={() => setOpen(true)}>
        Cancel booking
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              {booking.hotel_name}, {formatDateRange(booking.check_in, booking.check_out)}. {cancel.text}. The hotel&apos;s
              cancellation terms decide any refund; this can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} autoFocus>
              Keep booking
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmCancel}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {pending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
