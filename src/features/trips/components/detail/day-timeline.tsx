import {
  CloudRain,
  Droplets,
  Sunrise,
  Sunset,
  UtensilsCrossed,
  Wind,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency, TIME_SLOTS, type TimeSlot } from "@/lib/trips/trip-domain"
import type { TripDay } from "@/features/trips/queries/trip-detail"

/**
 * The shape this component displays, deliberately not the database row.
 *
 * Weather reaches the page from two places — the snapshot stored when the
 * trip was created, and a live refresh when the dates are close enough to
 * forecast — so the component takes a normalised shape and neither source
 * has to look like the other.
 */
export interface DayForecast {
  condition: string
  tempHighC: number | null
  tempLowC: number | null
  precipitationChance: number | null
  windKph: number | null
  humidity: number | null
  sunrise: string | null
  sunset: string | null
  /** True when refetched now rather than read from the creation snapshot. */
  isLive: boolean
}

const SLOT_LABEL: Record<TimeSlot | "unscheduled", string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  unscheduled: "Any time",
}

function formatDayDate(date: string | null): string {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00Z`))
}

/** `14:30:00` from Postgres, `14:30` from the planner — both render as `14:30`. */
function clockTime(value: string | null): string {
  return value ? value.slice(0, 5) : ""
}

/**
 * One day of the trip: weather, summary, then the schedule by time of day.
 *
 * A server component — there is nothing interactive here, so none of this
 * needs to reach the browser as JavaScript.
 */
export function DayTimeline({
  day,
  currency,
  forecast,
}: {
  day: TripDay
  currency: string
  forecast: DayForecast | null
}) {
  // `activities.time_slot` is nullable, so grouping strictly by the three
  // known slots silently drops anything unslotted — it would sit in the
  // database and simply never appear. Anything unrecognised is collected into
  // its own group rather than lost.
  const known = new Set<string>(TIME_SLOTS)
  const bySlot: { slot: TimeSlot | "unscheduled"; items: typeof day.activities }[] =
    [
      ...TIME_SLOTS.map((slot) => ({
        slot: slot as TimeSlot | "unscheduled",
        items: day.activities.filter((a) => a.time_slot === slot),
      })),
      {
        slot: "unscheduled" as const,
        items: day.activities.filter(
          (a) => a.time_slot === null || !known.has(a.time_slot)
        ),
      },
    ].filter((group) => group.items.length > 0)

  return (
    <article
      id={`day-${day.dayNumber}`}
      className="scroll-mt-20 rounded-xl border border-border bg-card p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Day {day.dayNumber}
          </h3>
          <p className="text-sm text-muted-foreground">{formatDayDate(day.date)}</p>
        </div>
        {forecast ? <WeatherChip forecast={forecast} /> : null}
      </header>

      {day.summary ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {day.summary}
        </p>
      ) : null}

      {bySlot.length > 0 ? (
        <ol className="mt-5 space-y-5">
          {bySlot.map(({ slot, items }) => (
            <li key={slot}>
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                {SLOT_LABEL[slot]}
              </p>
              <ul className="mt-2 space-y-3">
                {items.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                      {clockTime(activity.start_time)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {activity.title}
                      </p>
                      {activity.description ? (
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {activity.description}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {activity.duration_minutes ? (
                          <span>{formatDuration(activity.duration_minutes)}</span>
                        ) : null}
                        {activity.walking_distance_km ? (
                          <span>{Number(activity.walking_distance_km)} km walk</span>
                        ) : null}
                        {Number(activity.estimated_cost) > 0 ? (
                          <span>
                            {formatCurrency(Number(activity.estimated_cost), currency)}
                          </span>
                        ) : (
                          <span>Free</span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Nothing scheduled for this day yet.
        </p>
      )}

      {day.restaurants.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <UtensilsCrossed aria-hidden="true" className="size-3.5" />
            Places to eat
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {day.restaurants.map((restaurant) => (
              <li key={restaurant.id} className="text-sm">
                <span className="font-medium text-foreground">{restaurant.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[
                    restaurant.meal_type,
                    restaurant.cuisine,
                    restaurant.opening_hours,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

/**
 * Compact forecast for a day.
 *
 * Every value is optional because Open-Meteo only forecasts about a
 * fortnight out; a day past the horizon simply shows less rather than
 * rendering blanks or zeroes that would read as real readings.
 */
function WeatherChip({ forecast }: { forecast: DayForecast }) {
  const { tempHighC: high, tempLowC: low } = forecast

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
      )}
    >
      <span className="font-medium text-foreground">{forecast.condition}</span>
      {high !== null && low !== null ? (
        <span className="tabular-nums">
          {Math.round(low)}° / {Math.round(high)}°
        </span>
      ) : null}
      {forecast.precipitationChance !== null ? (
        <span className="flex items-center gap-1">
          <CloudRain aria-hidden="true" className="size-3.5" />
          {forecast.precipitationChance}%
        </span>
      ) : null}
      {forecast.windKph !== null ? (
        <span className="flex items-center gap-1">
          <Wind aria-hidden="true" className="size-3.5" />
          {Math.round(forecast.windKph)} km/h
        </span>
      ) : null}
      {forecast.humidity !== null ? (
        <span className="flex items-center gap-1">
          <Droplets aria-hidden="true" className="size-3.5" />
          {forecast.humidity}%
        </span>
      ) : null}
      {forecast.sunrise ? (
        <span className="flex items-center gap-1">
          <Sunrise aria-hidden="true" className="size-3.5" />
          {forecast.sunrise.slice(0, 5)}
        </span>
      ) : null}
      {forecast.sunset ? (
        <span className="flex items-center gap-1">
          <Sunset aria-hidden="true" className="size-3.5" />
          {forecast.sunset.slice(0, 5)}
        </span>
      ) : null}
      {/* Says plainly whether this is today’s forecast or the reading taken
          when the trip was created — the brief requires fallback data to be
          identifiable rather than passed off as live. */}
      <span className="text-[0.65rem] opacity-70">
        {forecast.isLive ? "live forecast" : "at time of planning"}
      </span>
    </div>
  )
}
