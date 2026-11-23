import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

import { heroForecast } from "@/features/trips/queries/next-trip-facts"
import type { DayWeather } from "@/services/weather-service"

const day: DayWeather = {
  date: "2026-12-01",
  condition: "Clear sky",
  tempHighC: 18,
  tempLowC: 11,
  precipitationChance: 5,
  windKph: 10,
  humidity: 60,
  sunrise: null,
  sunset: null,
}
const point = { lat: 38.7, lng: -9.1 }
const ok = (byDate: Record<string, DayWeather>) =>
  vi.fn().mockResolvedValue({ data: { byDate, beyondForecastHorizon: false }, source: "live" })

describe("heroForecast", () => {
  it("returns the start day's real forecast, asking for that day only", async () => {
    const fetch = ok({ "2026-12-01": day })
    expect(await heroForecast(point, "2026-12-01", fetch)).toEqual({ kind: "forecast", day })
    expect(fetch).toHaveBeenCalledWith(38.7, -9.1, "2026-12-01", "2026-12-01")
  })

  it("is none — never an estimate — when the day is missing, the call fails, or there is no location", async () => {
    expect(await heroForecast(point, "2026-12-01", ok({}))).toEqual({ kind: "none" })
    expect(await heroForecast(point, "2026-12-01", vi.fn().mockRejectedValue(new Error("503")))).toEqual({ kind: "none" })
    const fetch = ok({ "2026-12-01": day })
    expect(await heroForecast(null, "2026-12-01", fetch)).toEqual({ kind: "none" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("gives up after the timeout instead of holding the dashboard", async () => {
    const never = vi.fn().mockReturnValue(new Promise(() => {}))
    const started = Date.now()
    expect(await heroForecast(point, "2026-12-01", never, 50)).toEqual({ kind: "none" })
    expect(Date.now() - started).toBeLessThan(1_000)
  })
})
