import { CACHE_TTL, integrationCache } from "@/integrations/core/cache"
import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"
import { openMeteoConfig } from "@/lib/config/providers"

/**
 * Open-Meteo forecast API.
 *
 * Free, keyless, and the only provider here that needs no configuration —
 * https://open-meteo.com/en/docs. Forecasts run 16 days ahead; requests
 * beyond that return nothing for the out-of-range days, which the service
 * layer treats as "no forecast yet" rather than an error, because a trip
 * booked three months out is the normal case, not a failure.
 */

const PROVIDER = "open-meteo"
// Free host by default; a paid plan (OPEN_METEO_API_KEY) or own host via config.

/**
 * The window Open-Meteo will actually serve, measured in days from today.
 *
 * Established by asking it, not by reading the docs: a request outside this
 * range fails with HTTP 400 and `"Parameter 'start_date' is out of allowed
 * range from <past> to <future>"`. Critically, *both* bounds must be inside
 * the window — a range that merely overlaps it is rejected too, so the caller
 * has to clamp rather than let the provider truncate.
 *
 * This is the common case, not an edge case: most trips are planned further
 * out than a fortnight, so an unclamped request would fail for the majority
 * of them.
 */
export const MAX_FORECAST_OFFSET_DAYS = 15
export const MAX_PAST_OFFSET_DAYS = 92

/** Exact daily variable names from the docs; a typo here yields a silent null column. */
const DAILY_VARIABLES = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "relative_humidity_2m_max",
  "sunrise",
  "sunset",
] as const

interface OpenMeteoResponse {
  timezone?: string
  daily?: {
    time?: string[]
    weather_code?: (number | null)[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_probability_max?: (number | null)[]
    wind_speed_10m_max?: (number | null)[]
    relative_humidity_2m_max?: (number | null)[]
    sunrise?: (string | null)[]
    sunset?: (string | null)[]
  }
}

export interface DailyForecast {
  /** ISO `YYYY-MM-DD`. */
  date: string
  /** WMO weather interpretation code. */
  weatherCode: number | null
  tempMaxC: number | null
  tempMinC: number | null
  precipitationChance: number | null
  windKph: number | null
  humidity: number | null
  /** `HH:MM`, local to the destination. */
  sunrise: string | null
  sunset: string | null
}

export interface ForecastRequest {
  latitude: number
  longitude: number
  /** ISO `YYYY-MM-DD`. */
  startDate: string
  endDate: string
  signal?: AbortSignal
}

const MS_PER_DAY = 86_400_000

function isoDay(offsetDays: number, from = Date.now()): string {
  return new Date(from + offsetDays * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * Narrows a requested range to the part Open-Meteo will serve.
 *
 * Returns nulls when the trip falls entirely outside the window, which is the
 * signal to skip the request altogether rather than spend a round trip
 * learning it would 400.
 */
export function clampToForecastWindow(
  requestedStart: string,
  requestedEnd: string
): { startDate: string | null; endDate: string | null } {
  const earliest = isoDay(-MAX_PAST_OFFSET_DAYS)
  const latest = isoDay(MAX_FORECAST_OFFSET_DAYS)

  // ISO dates compare correctly as strings, so no Date parsing is needed.
  const startDate = requestedStart < earliest ? earliest : requestedStart
  const endDate = requestedEnd > latest ? latest : requestedEnd

  if (startDate > latest || endDate < earliest || startDate > endDate) {
    return { startDate: null, endDate: null }
  }
  return { startDate, endDate }
}

/** Open-Meteo returns `2026-08-07T05:10`; the DB column is a bare time. */
function toClockTime(value: string | null | undefined): string | null {
  if (!value) return null
  const timePart = value.includes("T") ? value.split("T")[1] : value
  return timePart?.slice(0, 5) ?? null
}

/**
 * Daily forecast for a coordinate over a date range.
 *
 * `timezone=auto` matters: without it Open-Meteo buckets days in GMT, so a
 * Tokyo trip gets sunrise times shifted by nine hours and days that straddle
 * midnight land on the wrong date.
 */
export async function fetchDailyForecast(
  request: ForecastRequest
): Promise<DailyForecast[]> {
  const { latitude, longitude, signal } = request

  // Clamp to the servable window before asking. A trip beyond the horizon
  // isn't an error — the forecast simply doesn't exist yet — so this returns
  // the days that *are* covered and lets the caller show nothing for the rest.
  const { startDate, endDate } = clampToForecastWindow(
    request.startDate,
    request.endDate
  )
  if (!startDate || !endDate) return []

  // Coordinates are rounded into the cache key: Open-Meteo snaps to a grid of
  // roughly 1–11km anyway, so two hotels in the same city should share one
  // entry rather than each triggering its own request.
  const key = `openmeteo:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${startDate}:${endDate}`

  return integrationCache.getOrSet(key, CACHE_TTL.weather, async () => {
    const { forecastUrl, apiKey } = openMeteoConfig()
    const url = buildUrl(forecastUrl, {
      latitude,
      longitude,
      daily: DAILY_VARIABLES.join(","),
      timezone: "auto",
      start_date: startDate,
      end_date: endDate,
      // Dropped by buildUrl when null; redacted from any error built from it.
      apikey: apiKey,
    })

    const data = await fetchJson<OpenMeteoResponse>(PROVIDER, url, { signal })
    const daily = data.daily
    const dates = daily?.time

    if (!daily || !Array.isArray(dates)) {
      throw new IntegrationError(
        PROVIDER,
        "invalid_response",
        "Forecast response had no daily series"
      )
    }

    // Every variable comes back as a parallel array indexed by day, so read
    // them positionally rather than assuming all are present.
    return dates.map((date, i) => ({
      date,
      weatherCode: daily.weather_code?.[i] ?? null,
      tempMaxC: daily.temperature_2m_max?.[i] ?? null,
      tempMinC: daily.temperature_2m_min?.[i] ?? null,
      precipitationChance: daily.precipitation_probability_max?.[i] ?? null,
      windKph: daily.wind_speed_10m_max?.[i] ?? null,
      humidity: daily.relative_humidity_2m_max?.[i] ?? null,
      sunrise: toClockTime(daily.sunrise?.[i]),
      sunset: toClockTime(daily.sunset?.[i]),
    }))
  })
}

/**
 * WMO weather interpretation codes → short human labels.
 *
 * Open-Meteo returns codes rather than text so that clients can localise;
 * this is the table from their docs, collapsed to the granularity the UI
 * actually shows.
 */
export function describeWeatherCode(code: number | null): string {
  if (code === null) return "Unknown"
  if (code === 0) return "Clear"
  if (code <= 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code <= 48) return "Fog"
  if (code <= 55) return "Drizzle"
  if (code <= 57) return "Freezing drizzle"
  if (code <= 65) return "Rain"
  if (code <= 67) return "Freezing rain"
  if (code <= 77) return "Snow"
  if (code <= 82) return "Showers"
  if (code <= 86) return "Snow showers"
  return "Thunderstorm"
}
