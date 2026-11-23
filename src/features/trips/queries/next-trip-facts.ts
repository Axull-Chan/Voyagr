import { createClient } from "@/lib/supabase/server"
import { MAX_FORECAST_OFFSET_DAYS } from "@/integrations/openmeteo/weather"
import { getTripWeather, type DayWeather } from "@/services/weather-service"
import { forecastWindow } from "@/features/dashboard/services/dashboard"

/**
 * The live details the dashboard hero shows for one trip: packing progress,
 * how many stops are planned, and the first day's forecast. Database reads go
 * through the traveller's own session (RLS); the only outside request is the
 * same Open-Meteo forecast the trip page makes, and only when one can exist.
 */

export type HeroForecast =
  | { kind: "forecast"; day: DayWeather }
  | { kind: "later"; availableFrom: string }
  | { kind: "none" }

export interface NextTripFacts {
  packing: { checked: number; total: number }
  stops: number
  forecast: HeroForecast
}

/** Past this the dashboard renders without a forecast rather than waiting. */
export const HERO_WEATHER_TIMEOUT_MS = 3_000

type Point = { lat: number | null; lng: number | null }
const located = (p: Point): p is { lat: number; lng: number } =>
  typeof p.lat === "number" && typeof p.lng === "number"

/**
 * The forecast for `startDate`, or `none` on any failure, a missing location,
 * or after `timeoutMs`. Never an estimate: a day the provider didn't return
 * is simply not shown.
 */
export async function heroForecast(
  point: { lat: number; lng: number } | null,
  startDate: string,
  fetchWeather: typeof getTripWeather = getTripWeather,
  timeoutMs = HERO_WEATHER_TIMEOUT_MS
): Promise<HeroForecast> {
  if (!point) return { kind: "none" }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs)
    })
    const result = await Promise.race([fetchWeather(point.lat, point.lng, startDate, startDate), timeout])
    const day = result?.data.byDate[startDate]
    return day ? { kind: "forecast", day } : { kind: "none" }
  } catch {
    return { kind: "none" }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function getNextTripFacts(
  tripId: string,
  startDate: string | null,
  today: string
): Promise<NextTripFacts> {
  const supabase = await createClient()
  const [packingResult, daysResult, hotelsResult] = await Promise.all([
    supabase.from("packing_lists").select("is_checked").eq("trip_id", tripId),
    supabase.from("trip_days").select("activities(lat, lng)").eq("trip_id", tripId),
    supabase.from("hotels").select("lat, lng").eq("trip_id", tripId).order("created_at", { ascending: true }),
  ])

  const packing = packingResult.data ?? []
  const activities = ((daysResult.data ?? []) as unknown as { activities: Point[] }[]).flatMap(
    (day) => day.activities ?? []
  )
  const point = (hotelsResult.data ?? []).find(located) ?? activities.find(located) ?? null

  const window = forecastWindow(startDate, today, MAX_FORECAST_OFFSET_DAYS)
  const forecast: HeroForecast =
    window.kind === "available" && startDate
      ? await heroForecast(point, startDate)
      : window.kind === "later"
        ? window
        : { kind: "none" }

  return {
    packing: { checked: packing.filter((item) => item.is_checked).length, total: packing.length },
    stops: activities.length,
    forecast,
  }
}
