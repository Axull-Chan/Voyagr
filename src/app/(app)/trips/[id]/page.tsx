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
import { getTripChatHistory } from "@/features/trips/queries/trip-chat"
import {
  DayTimeline,
  type DayForecast,
} from "@/features/trips/components/detail/day-timeline"
import { TripHero } from "@/features/trips/components/detail/trip-hero"
import { LazyTripMap } from "@/features/trips/components/detail/trip-map-lazy"
import {
  StaysPanel,
  TransportPanel,
} from "@/features/trips/components/detail/trip-aside"
import { BudgetSection } from "@/features/trips/components/detail/budget-section"
import { PackingSection } from "@/features/trips/components/detail/packing-section"
import { TripChat } from "@/features/trips/components/detail/trip-chat"
import { TripActionsMenu } from "@/features/trips/components/detail/trip-actions-menu"

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
  const [
    { trip, days, hotels, transportation, budget, expenses, packing },
    chatHistory,
  ] = await Promise.all([getTripDetail(id), getTripChatHistory(id)])

  // The traveller's own currency, for converting a foreign budget back.
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .maybeSingle()
  const homeCurrency = profile?.preferred_currency ?? null

  // Only what's actually needed to convert back to the trip's currency: the
  // traveller's own currency, plus whatever currencies expenses were logged
  // in. Earlier this requested all 8 supported currencies unconditionally,
  // which cost a real (if usually fast) external round trip for currencies
  // nothing on the page would ever use.
  const quoteCurrencies = [
    ...new Set(
      [homeCurrency, ...expenses.map((e) => e.currency)].filter(
        (c): c is string => Boolean(c)
      )
    ),
  ].filter((c) => c !== trip.currency)
  const rates =
    quoteCurrencies.length > 0
      ? await getRates(trip.currency, quoteCurrencies)
      : {
          data: { base: trip.currency, rates: {}, asOf: "" },
          source: "live" as const,
        }

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

  /**
   * Live reading for a date, else the snapshot taken at planning time.
   *
   * The stored snapshot's own `source` column matters here, not just whether
   * it's fresh: `"open-meteo"` was a real reading at creation time (just not
   * refetched since), `"mock"` (the deterministic provider's fallback) and
   * `"unavailable"` (Gemini/OpenAI's fallback) were never readings at all —
   * see the `DayForecast.provenance` doc comment in day-timeline.tsx for why
   * that distinction has to survive to the label, not just the freshness one.
   */
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
        provenance: "live",
      }
    }
    const stored = day.weather
    if (!stored) return null
    return {
      condition: stored.condition,
      tempHighC:
        stored.temp_high_c === null ? null : Number(stored.temp_high_c),
      tempLowC: stored.temp_low_c === null ? null : Number(stored.temp_low_c),
      precipitationChance: stored.precipitation_chance,
      windKph: stored.wind_kph === null ? null : Number(stored.wind_kph),
      humidity: stored.humidity,
      sunrise: stored.sunrise,
      sunset: stored.sunset,
      provenance:
        stored.source === "open-meteo"
          ? "planning-real"
          : stored.source === "unavailable"
            ? "unavailable"
            : "planning-modelled",
    }
  }

  const hasAsideContent =
    hotels.length > 0 ||
    transportation.length > 0 ||
    Boolean(trip.additional_notes)
  const hasMap = markers.length > 0
  const hasRail = hasMap || hasAsideContent

  /**
   * Composition (Stage 3D).
   *
   * The page used to be one uniform `space-y-6` stack — map, day plan, budget,
   * packing — every block full width and every gap identical, with the *map*
   * arriving before the itinerary. That made the largest, loudest object on the
   * page the one the reader did not come for.
   *
   * It now reads in three movements: the hero, then the day plan holding the
   * whole main column with its supporting reference beside it in the rail, then
   * the planning tools in a denser band underneath. Spacing carries the
   * hierarchy — the narrative gets room, the tools compress.
   *
   * DOM order is also the mobile order, so no `order-*` juggling is needed:
   * below `lg` the reader gets hero → day plan → map → stays/transport →
   * budget → packing, which is narrative-first by construction.
   */
  return (
    <>
      <Reveal mode="mount">
        <RevealItem className="mb-4 flex items-center justify-between gap-2">
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
          <TripActionsMenu
            tripId={trip.id}
            title={trip.title}
            status={trip.status}
          />
        </RevealItem>

        <RevealItem className="mb-8 sm:mb-10">
          <TripHero trip={trip} nights={nights} />
        </RevealItem>

        <div
          className={
            hasRail
              ? "grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10"
              : "grid"
          }
        >
          {/* The spine. Nothing else shares this column. */}
          <div className="min-w-0">
            <RevealItem>
              <h2 className="text-destination text-foreground mb-4">
                Day by day
              </h2>
              {days.length > 0 ? (
                <div className="divide-border divide-y">
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
                <div className="border-border border-t py-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    {trip.status === "draft"
                      ? "This trip is still a draft — its itinerary hasn't been generated yet."
                      : "No itinerary yet."}
                  </p>
                </div>
              )}
            </RevealItem>
          </div>

          {hasRail ? (
            // Everything about *where*, beside the column about *when*. Sticky so
            // the map stays available while the reader moves down the days.
            <aside className="space-y-6 lg:sticky lg:top-20">
              {hasMap ? (
                <RevealItem>
                  <h2 className="text-day-heading text-foreground mb-2">
                    Everywhere you&apos;re going
                  </h2>
                  <LazyTripMap markers={markers} center={mapCentre} />
                </RevealItem>
              ) : null}

              {hasAsideContent ? (
                <RevealItem>
                  {/* Deliberately not `bg-card` — every primary content section
                    (map, day timeline, budget, packing) already uses that
                    token, so this panel would just read as "another card of
                    the same kind, slightly faded." `bg-muted`, already this
                    codebase's recessed/secondary tone, plus a softer border
                    gives it its own tier (a parallel structural layer, not a
                    second content card) without a new token or any blur. */}
                  <div className="divide-border/60 border-border/60 bg-muted/40 divide-y rounded-xl border">
                    <StaysPanel hotels={hotels} currency={trip.currency} />
                    <TransportPanel
                      legs={transportation}
                      currency={trip.currency}
                    />
                    {trip.additional_notes ? (
                      <div className="p-5">
                        <h2 className="text-day-heading text-foreground">
                          Your notes
                        </h2>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                          {trip.additional_notes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </RevealItem>
              ) : null}
            </aside>
          ) : null}
        </div>

        {/* Planning tools. Below the whole grid rather than inside the narrative
          column, and paired side by side once there is room, so they read as a
          band of instruments rather than two more page-width sections
          competing with the itinerary. Separated by space, not another rule —
          each section already carries its own. */}
        <div className="mt-14 grid gap-10 sm:mt-16 lg:grid-cols-2">
          <RevealItem>
            <BudgetSection
              tripId={trip.id}
              budget={budget}
              expenses={expenses}
              currency={trip.currency}
              total={trip.budget ? Number(trip.budget) : null}
              rates={rates.data}
              homeCurrency={homeCurrency}
            />
          </RevealItem>

          <RevealItem>
            <PackingSection tripId={trip.id} items={packing} />
          </RevealItem>
        </div>
      </Reveal>

      <TripChat
        tripId={trip.id}
        currency={trip.currency}
        initialMessages={chatHistory}
        hasItinerary={days.length > 0}
      />
    </>
  )
}
