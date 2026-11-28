"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, Search, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { DestinationFallback } from "@/components/shared/destination-fallback"
import { cn } from "@/lib/utils"
import { searchHotelsAction, selectRoomAction } from "@/features/bookings/actions/booking.actions"
import { NationalitySelect } from "@/features/bookings/components/nationality-select"
import { cancellationText, nightsBetween, totalText } from "@/features/bookings/services/booking-view"
import type { HotelResult, RoomOffer } from "@/integrations/liteapi/client"

/**
 * Search and room choice. Nothing is stored while searching (it is page state
 * only); choosing a room creates the booking row and opens checkout.
 */

export interface StayDefaults {
  checkIn: string
  checkOut: string
  adults: number
}

export function HotelSearch({
  tripId,
  defaults,
  destination,
}: {
  tripId: string
  defaults: StayDefaults
  destination: string
}) {
  const router = useRouter()
  const formId = useId()
  const [checkIn, setCheckIn] = useState(defaults.checkIn)
  const [checkOut, setCheckOut] = useState(defaults.checkOut)
  const [adults, setAdults] = useState(Math.min(Math.max(defaults.adults, 1), 8))
  const [childAges, setChildAges] = useState<number[]>([])
  const [nationality, setNationality] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [nationalityError, setNationalityError] = useState<string | null>(null)
  const [results, setResults] = useState<{ hotels: HotelResult[]; nights: number; stay: { checkIn: string; checkOut: string; adults: number; childrenAges: number[] } } | null>(null)
  const [searching, startSearch] = useTransition()
  const [choosing, setChoosing] = useState<string | null>(null)
  const [, startChoose] = useTransition()

  function search(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!nationality) {
      setNationalityError("Choose the lead guest's nationality.")
      return
    }
    setNationalityError(null)
    const stay = { checkIn, checkOut, adults, childrenAges: childAges }
    startSearch(async () => {
      const r = await searchHotelsAction({ tripId, stay, guestNationality: nationality })
      if (!r.ok) {
        setError(r.error)
        setResults(null)
        return
      }
      setResults({ hotels: r.hotels, nights: nightsBetween(checkIn, checkOut), stay })
    })
  }

  function choose(hotel: HotelResult, offer: RoomOffer) {
    if (!results) return
    setChoosing(offer.offerId)
    setError(null)
    startChoose(async () => {
      const r = await selectRoomAction({
        tripId,
        stay: results.stay,
        offerId: offer.offerId,
        hotel: { providerHotelId: hotel.hotelId, name: hotel.name, address: hotel.address, lat: hotel.lat, lng: hotel.lng },
        roomName: offer.roomName,
        boardType: offer.boardType,
        quotedTotal: offer.total,
        currency: offer.currency,
        cancellation: offer.cancellation,
      })
      if (!r.ok) {
        setError(r.error)
        setChoosing(null)
        return
      }
      router.push(`/trips/${tripId}/stays/${r.bookingId}`)
    })
  }

  return (
    <div className="space-y-8">
      <form onSubmit={search} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-describedby={error ? `${formId}-error` : undefined}>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-in`}>Check-in</Label>
          <Input id={`${formId}-in`} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-out`}>Check-out</Label>
          <Input id={`${formId}-out`} type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-adults`}>Adults</Label>
          <Select id={`${formId}-adults`} value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-children`}>Children</Label>
          <Select
            id={`${formId}-children`}
            value={childAges.length}
            onChange={(e) => {
              const n = Number(e.target.value)
              setChildAges((ages) => Array.from({ length: n }, (_, i) => ages[i] ?? 8))
            }}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        {childAges.map((age, i) => (
          <div key={i} className="grid gap-1.5">
            <Label htmlFor={`${formId}-age-${i}`}>Age of child {i + 1}</Label>
            <Select
              id={`${formId}-age-${i}`}
              value={age}
              onChange={(e) => setChildAges((ages) => ages.map((a, j) => (j === i ? Number(e.target.value) : a)))}
            >
              {Array.from({ length: 18 }, (_, a) => (
                <option key={a} value={a}>
                  {a === 0 ? "Under 1" : a}
                </option>
              ))}
            </Select>
          </div>
        ))}
        <div className="sm:col-span-2">
          <NationalitySelect id={`${formId}-nat`} value={nationality} onChange={setNationality} error={nationalityError} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:justify-end">
          <Button type="submit" size="lg" disabled={searching} className="w-full sm:w-auto">
            {searching ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
            {searching ? "Searching…" : "Search hotels"}
          </Button>
        </div>
      </form>

      {error ? (
        <p id={`${formId}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div aria-live="polite" aria-busy={searching}>
        {results ? (
          results.hotels.length === 0 ? (
            <p className="text-muted-foreground border-border border-t py-10 text-center text-sm">
              No rooms available near {destination} for those dates. Try other dates or fewer guests.
            </p>
          ) : (
            <section aria-labelledby={`${formId}-results`}>
              <h2 id={`${formId}-results`} className="text-eyebrow text-muted-foreground mb-3">
                {results.hotels.length} {results.hotels.length === 1 ? "hotel" : "hotels"} near your trip · cheapest first
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...results.hotels]
                  .sort((a, b) => (a.offers[0]?.total ?? 0) - (b.offers[0]?.total ?? 0))
                  .map((hotel) => (
                    <li key={hotel.hotelId} className="grid min-w-0">
                      <HotelResultCard hotel={hotel} nights={results.nights} choosing={choosing} onChoose={(offer) => choose(hotel, offer)} />
                    </li>
                  ))}
              </ul>
              <p className="text-caption text-muted-foreground mt-6">
                Hotel details, prices and bookings by LiteAPI (Nuitee). Prices include the taxes the hotel quotes; some
                hotels charge local fees on arrival.
              </p>
            </section>
          )
        ) : null}
      </div>
    </div>
  )
}

/** One hotel: photo, name, official stars, cheapest total, and its room options on demand. */
export function HotelResultCard({
  hotel,
  nights,
  choosing,
  onChoose,
}: {
  hotel: HotelResult
  nights: number
  choosing: string | null
  onChoose: (offer: RoomOffer) => void
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const cheapest = hotel.offers[0]
  if (!cheapest) return null
  const cancel = cancellationText(cheapest.cancellation)

  return (
    <article className="bg-card flex flex-col overflow-hidden rounded-xl">
      <div className="bg-muted relative aspect-4/3">
        {hotel.photo ? (
          // A plain <img>, not next/image: hotel photos come from the provider's
          // CDN (static.cupid.travel today, possibly others), and routing every
          // result through the image optimiser would spend its quota on a
          // search page. Lazy, sized by its container, alt is the hotel's name.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hotel.photo} alt={hotel.name} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : (
          // The name is the card's title right below, so the fallback shows only its initial.
          <DestinationFallback destination={hotel.name} size="sm" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-destination text-foreground truncate" title={hotel.name}>
          {hotel.name}
        </h3>
        {hotel.stars ? (
          <p className="text-muted-foreground flex items-center gap-1 text-sm" aria-label={`${hotel.stars}-star hotel`}>
            {Array.from({ length: Math.round(hotel.stars) }, (_, i) => (
              <Star key={i} aria-hidden="true" className="fill-current size-3.5" />
            ))}
          </p>
        ) : null}
        {hotel.address ? <p className="text-muted-foreground truncate text-sm">{hotel.address}</p> : null}
        <div className="mt-auto space-y-1 pt-2">
          <p className="text-data-md text-foreground">
            <span className="text-caption text-muted-foreground mr-1">from</span>
            {totalText(cheapest.total, cheapest.currency, nights)}
          </p>
          <p className={cn("text-caption", cancel.tone === "positive" ? "text-foreground" : "text-muted-foreground")}>{cancel.text}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          className="mt-2 w-full"
        >
          {open ? "Hide rooms" : `See ${hotel.offers.length} room ${hotel.offers.length === 1 ? "option" : "options"}`}
          <ChevronDown aria-hidden="true" data-icon="inline-end" className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </Button>
        {open ? (
          <ul id={listId} className="divide-border border-border -mx-4 mt-1 divide-y border-t">
            {hotel.offers.map((offer) => (
              <RoomOptionRow key={offer.offerId} offer={offer} nights={nights} busy={choosing !== null} pending={choosing === offer.offerId} onChoose={() => onChoose(offer)} />
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}

export function RoomOptionRow({
  offer,
  nights,
  busy,
  pending,
  onChoose,
}: {
  offer: RoomOffer
  nights: number
  busy: boolean
  pending: boolean
  onChoose: () => void
}) {
  const cancel = cancellationText(offer.cancellation)
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">{offer.roomName ?? "Room"}</p>
        <p className="text-muted-foreground text-caption">{offer.boardName ?? "Meal plan not stated"}</p>
        <p className="text-caption text-muted-foreground">{cancel.text}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-data-md text-foreground">{totalText(offer.total, offer.currency, nights)}</p>
        <Button type="button" size="sm" onClick={onChoose} disabled={busy} aria-label={`Choose ${offer.roomName ?? "this room"} for ${totalText(offer.total, offer.currency, nights)}`}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Choosing…" : "Choose"}
        </Button>
      </div>
    </li>
  )
}
