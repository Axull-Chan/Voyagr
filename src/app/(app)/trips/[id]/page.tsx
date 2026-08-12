import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Reveal, RevealItem } from "@/components/shared/reveal"
import { Button } from "@/components/ui/button"
import { tripDurationDays } from "@/lib/trips/trip-domain"
import { createClient } from "@/lib/supabase/server"
import { getRates } from "@/services/currency-service"
import { getTripWeather } from "@/services/weather-service"
import type { MapMarker } from "@/services/map-service"
import { getTripDetail } from "@/features/trips/queries/trip-detail"
import {
  DayTimeline,
  type DayForecast,
} from "@/features/trips/components/detail/day-timeline"
import { TripHero } from "@/features/trips/components/detail/trip-hero"
import { LazyTripMap } from "@/features/trips/components/detail/trip-map-lazy"
import {
  BudgetPanel,
  StaysPanel,
  TransportPanel,
} from "@/features/trips/components/detail/trip-aside"

interface TripDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: TripDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("trips")
    .select("title")
    .eq("id", id)
    .maybeSingle()
  return { title: data?.title ?? "Trip" }
}

/**
 * The trip page.
 *
 * A Server Component: everything here is read-once data, so only the map —
 * which needs WebGL and user interaction — ships JavaScript. Live rates are
 * fetched here rather than in a client effect so the page arrives complete
 * and there is no conversion flashing in after paint.
 */
export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params
  const { trip, days, hotels, transportation, budget } = await getTripDetail(id)

  // The traveller's own currency, for converting a foreign budget back.
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .maybeSingle()
  const homeCurrency = profile?.preferred_currency ?? null

  const rates = homeCurrency && homeCurrency !== trip.currency
    ? await getRates(trip.currency, [homeCurrency])
    : { data: { base: trip.currency, rates: {}, asOf: "" }, source: "live" as const }

  const nights = Math.max(
    tripDurationDays(trip.start_date ?? "", trip.end_date ?? "") - 1,
    0
  )

  // Markers come from what is actually scheduled, so the map and the timeline
  // can never disagree about where the trip goes.
  const markers: MapMarker[] = [
    ...hotels
      .filter((h) => h.lat !== null && h.lng !== null)
      .map((h) => ({
        id: `hotel-${h.id}`,
        kind: "hotel" as const,
        name: h.name,
        latitude: h.lat as number,
        longitude: h.lng as number,
        detail: h.address ?? undefined,
      })),
    ...days.flatMap((day) => [
      ...day.activities
        .filter((a) => a.lat !== null && a.lng !== null)
        .map((a) => ({
          id: `activity-${a.id}`,
          kind: "activity" as const,
          name: a.location_name ?? a.title,
          latitude: a.lat as number,
          longitude: a.lng as number,
          detail: `Day ${day.dayNumber}`,
        })),
      ...day.restaurants
        .filter((r) => r.lat !== null && r.lng !== null)
        .map((r) => ({
          id: `restaurant-${r.id}`,
          kind: "restaurant" as const,
          name: r.name,
          latitude: r.lat as number,
          longitude: r.lng as number,
          detail: r.meal_type ?? undefined,
        })),
    ]),
  ]

  const mapCentre = markers[0]
    ? { latitude: markers[0].latitude, longitude: markers[0].longitude }
    : null

  // Weather is stored when the trip is created, but a trip planned months
  // ahead is created *beyond* the forecast horizon and would otherwise show
  // that empty snapshot forever. Refetching here means the forecast simply
  // appears once the dates come within range, without a background job.
  // Coordinates come from the first marker because trips themselves store
  // none — every activity now carries the venue's own position.
  const liveWeather =
    mapCentre && trip.start_date && trip.end_date
      ? await getTripWeather(
          mapCentre.latitude,
          mapCentre.longitude,
          trip.start_date,
          trip.end_date
        )
      : null

  /** Live reading for a date, else the snapshot taken at planning time. */
  function forecastFor(day: (typeof days)[number]): DayForecast | null {
    const fresh = day.date ? liveWeather?.data.byDate[day.date] : undefined
    if (fresh) {
      return {
        condition: fresh.condition,
        tempHighC: fresh.tempHighC,
        tempLowC: fresh.tempLowC,
        precipitationChance: fresh.precipitationChance,
        windKph: fresh.windKph,
        humidity: fresh.humidity,
        sunrise: fresh.sunrise,
        sunset: fresh.sunset,
        isLive: true,
      }
    }
    const stored = day.weather
    if (!stored) return null
    return {
      condition: stored.condition,
      tempHighC: stored.temp_high_c === null ? null : Number(stored.temp_high_c),
      tempLowC: stored.temp_low_c === null ? null : Number(stored.temp_low_c),
      precipitationChance: stored.precipitation_chance,
      windKph: stored.wind_kph === null ? null : Number(stored.wind_kph),
      humidity: stored.humidity,
      sunrise: stored.sunrise,
      sunset: stored.sunset,
      isLive: false,
    }
  }

  return (
    <Reveal mode="mount" className="space-y-6">
      <RevealItem>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/trips" />}
          className="-ml-2"
        >
          <ArrowLeft aria-hidden="true" />
          All trips
        </Button>
      </RevealItem>

      <RevealItem>
        <TripHero trip={trip} nights={nights} />
      </RevealItem>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {markers.length > 0 ? (
            <RevealItem>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Everywhere you&apos;re going
              </h2>
              <LazyTripMap markers={markers} center={mapCentre} />
            </RevealItem>
          ) : null}

          <RevealItem>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Day by day
            </h2>
            {days.length > 0 ? (
              <div className="space-y-4">
                {days.map((day) => (
                  <DayTimeline
                    key={day.id}
                    day={day}
                    currency={trip.currency}
                    forecast={forecastFor(day)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {trip.status === "draft"
                    ? "This trip is still a draft — its itinerary hasn't been generated yet."
                    : "No itinerary yet."}
                </p>
              </div>
            )}
          </RevealItem>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <RevealItem>
            <BudgetPanel
              budget={budget}
              currency={trip.currency}
              total={trip.budget ? Number(trip.budget) : null}
              rates={rates.data}
              homeCurrency={homeCurrency}
            />
          </RevealItem>
          <RevealItem>
            <StaysPanel hotels={hotels} currency={trip.currency} />
          </RevealItem>
          <RevealItem>
            <TransportPanel legs={transportation} currency={trip.currency} />
          </RevealItem>
          {trip.additional_notes ? (
            <RevealItem>
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">Your notes</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {trip.additional_notes}
                </p>
              </section>
            </RevealItem>
          ) : null}
        </aside>
      </div>
    </Reveal>
  )
}
