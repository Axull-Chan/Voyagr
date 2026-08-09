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

const SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
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
}: {
  day: TripDay
  currency: string
}) {
  const bySlot = TIME_SLOTS.map((slot) => ({
    slot,
    items: day.activities.filter((a) => a.time_slot === slot),
  })).filter((group) => group.items.length > 0)

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
        {day.weather ? <WeatherChip weather={day.weather} /> : null}
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
function WeatherChip({
  weather,
}: {
  weather: NonNullable<TripDay["weather"]>
}) {
  const high = weather.temp_high_c
  const low = weather.temp_low_c

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
      )}
    >
      <span className="font-medium text-foreground">{weather.condition}</span>
      {high !== null && low !== null ? (
        <span className="tabular-nums">
          {Math.round(Number(low))}° / {Math.round(Number(high))}°
        </span>
      ) : null}
      {weather.precipitation_chance !== null ? (
        <span className="flex items-center gap-1">
          <CloudRain aria-hidden="true" className="size-3.5" />
          {weather.precipitation_chance}%
        </span>
      ) : null}
      {weather.wind_kph !== null ? (
        <span className="flex items-center gap-1">
          <Wind aria-hidden="true" className="size-3.5" />
          {Math.round(Number(weather.wind_kph))} km/h
        </span>
      ) : null}
      {weather.humidity !== null ? (
        <span className="flex items-center gap-1">
          <Droplets aria-hidden="true" className="size-3.5" />
          {weather.humidity}%
        </span>
      ) : null}
      {weather.sunrise ? (
        <span className="flex items-center gap-1">
          <Sunrise aria-hidden="true" className="size-3.5" />
          {weather.sunrise.slice(0, 5)}
        </span>
      ) : null}
      {weather.sunset ? (
        <span className="flex items-center gap-1">
          <Sunset aria-hidden="true" className="size-3.5" />
          {weather.sunset.slice(0, 5)}
        </span>
      ) : null}
    </div>
  )
}
