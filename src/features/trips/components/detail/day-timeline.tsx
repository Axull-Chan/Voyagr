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
  /**
   * `"live"` — refetched just now, a real current reading.
   * `"planning-real"` — the creation-time snapshot, itself a real Open-Meteo
   * reading (just not fresh).
   * `"planning-modelled"` — the creation-time snapshot, but the date was
   * already beyond Open-Meteo's ~16-day horizon *then*, so this was never a
   * reading at all — it's the destination's typical climate (the mock
   * provider's fallback), not a forecast. Collapsing this into the same "at
   * time of planning" label as the real snapshot would tell a user a number
   * was once accurate when it never was.
   * `"unavailable"` — beyond the horizon and no modelled fallback exists
   * either (Gemini/OpenAI's fallback, which has no climate catalogue to
   * model from) — every numeric field is null, `condition` is a plain
   * placeholder string.
   */
  provenance: "live" | "planning-real" | "planning-modelled" | "unavailable"
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
      className="scroll-mt-20 py-6 first:pt-0"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-day-heading text-foreground">
            Day {day.dayNumber}
          </h3>
          <p className="text-data-sm text-muted-foreground">{formatDayDate(day.date)}</p>
        </div>
        {forecast ? <WeatherChip forecast={forecast} /> : null}
      </header>

      {/* The day's narrative is Tier 3 — the reason the page exists — and
          DESIGN.md calls it out by name: it was rendering as small muted sans,
          visually indistinguishable from metadata. `text-body-lead` is the one
          place serif carries body copy, and `max-w-prose` applies the 65ch
          measure the spec asks for on text that is read rather than scanned.
          Content, conditional rendering and spacing are unchanged. */}
      {day.summary ? (
        <p className="mt-3 max-w-prose text-body-lead text-foreground">
          {day.summary}
        </p>
      ) : null}

      {bySlot.length > 0 ? (
        <ol className="mt-5 space-y-5">
          {bySlot.map(({ slot, items }) => (
            <li key={slot}>
              <p className="text-eyebrow text-primary">
                {SLOT_LABEL[slot]}
              </p>
              <ul className="mt-2 space-y-3">
                {items.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <span className="w-12 shrink-0 pt-0.5 text-data-sm text-muted-foreground">
                      {clockTime(activity.start_time)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {activity.title}
                      </p>
                      {activity.description ? (
                        <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
                          {activity.description}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {activity.duration_minutes ? (
                          <span className="text-data-sm">{formatDuration(activity.duration_minutes)}</span>
                        ) : null}
                        {activity.walking_distance_km ? (
                          // Straight-line distance between real coordinates, not a
                          // routed one — "est." for the same reason the hotel rate
                          // gets it: connected to real data, but not a measurement.
                          <span className="text-data-sm">est. {Number(activity.walking_distance_km)} km walk</span>
                        ) : null}
                        {Number(activity.estimated_cost) > 0 ? (
                          // No ticketing/pricing source is wired up — this is
                          // the plan's own cost estimate, same "est." treatment
                          // as the rest of the page gives a modelled number.
                          <span className="text-data-sm">
                            est. {formatCurrency(Number(activity.estimated_cost), currency)}
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
          <p className="text-eyebrow flex items-center gap-1.5 text-muted-foreground">
            <UtensilsCrossed aria-hidden="true" className="size-3.5" />
            Places to eat
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {day.restaurants.map((restaurant) => (
              <li key={restaurant.id} className="text-sm">
                <span className="font-semibold text-foreground">{restaurant.name}</span>
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
      <span
        className={
          forecast.provenance === "unavailable"
            ? "font-semibold text-notice-foreground"
            : "font-semibold text-foreground"
        }
      >
        {forecast.condition}
      </span>
      {high !== null && low !== null ? (
        <span className="text-data-sm">
          {Math.round(low)}° / {Math.round(high)}°
        </span>
      ) : null}
      {forecast.precipitationChance !== null ? (
        <span className="flex items-center gap-1 text-data-sm">
          <CloudRain aria-hidden="true" className="size-3.5" />
          {forecast.precipitationChance}%
        </span>
      ) : null}
      {forecast.windKph !== null ? (
        <span className="flex items-center gap-1 text-data-sm">
          <Wind aria-hidden="true" className="size-3.5" />
          {Math.round(forecast.windKph)} km/h
        </span>
      ) : null}
      {forecast.humidity !== null ? (
        <span className="flex items-center gap-1 text-data-sm">
          <Droplets aria-hidden="true" className="size-3.5" />
          {forecast.humidity}%
        </span>
      ) : null}
      {forecast.sunrise ? (
        <span className="flex items-center gap-1 text-data-sm">
          <Sunrise aria-hidden="true" className="size-3.5" />
          {forecast.sunrise.slice(0, 5)}
        </span>
      ) : null}
      {forecast.sunset ? (
        <span className="flex items-center gap-1 text-data-sm">
          <Sunset aria-hidden="true" className="size-3.5" />
          {forecast.sunset.slice(0, 5)}
        </span>
      ) : null}
      {/* Four states, not two: a real snapshot that's just not fresh reads
          very differently from a number that was never measured at all.
          `--notice` only for the modelled case — that's the one where a
          reasonable reader could mistake an estimate for a real reading.
          "unavailable" skips this caption entirely: every numeric field
          above is already null, and the condition text (coloured above)
          already says there's nothing here — a second caption saying the
          same thing again would just be noise. */}
      {forecast.provenance !== "unavailable" ? (
        <span
          className={
            forecast.provenance === "planning-modelled"
              ? "text-[0.65rem] text-notice-foreground"
              : "text-[0.65rem] opacity-70"
          }
        >
          {forecast.provenance === "live"
            ? "live forecast"
            : forecast.provenance === "planning-real"
              ? "at time of planning"
              : "typical weather, not a forecast"}
        </span>
      ) : null}
    </div>
  )
}
