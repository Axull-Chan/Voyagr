import { describe, expect, it } from "vitest"

import {
  YOUR_TRIPS_LIMIT,
  dashboardStats,
  forecastWindow,
  pickDashboardTrips,
  type DashboardTrip,
} from "@/features/dashboard/services/dashboard"
import { heroFactLines } from "@/features/dashboard/services/hero-facts"
import type { NextTripFacts } from "@/features/trips/queries/next-trip-facts"

const TODAY = "2026-11-23"
const trip = (id: string, start: string | null, created: string, destination = id): DashboardTrip => ({
  id,
  destination,
  start_date: start,
  end_date: start,
  created_at: created,
})

describe("pickDashboardTrips", () => {
  const trips = [
    trip("past-new", "2026-10-01", "2026-11-20T00:00:00Z"),
    trip("far", "2027-03-01", "2026-11-01T00:00:00Z"),
    trip("next", "2026-11-30", "2026-09-01T00:00:00Z"),
    trip("today", TODAY, "2026-08-01T00:00:00Z"),
    trip("undated", null, "2026-11-22T00:00:00Z"),
    trip("past-old", "2026-01-01", "2026-01-01T00:00:00Z"),
  ]

  it("leads with the nearest trip that hasn't started, counting today", () => {
    expect(pickDashboardTrips(trips, TODAY).nextTrip?.id).toBe("today")
  })

  it("never shows the hero trip again in the grid", () => {
    const { nextTrip, yourTrips } = pickDashboardTrips(trips, TODAY)
    expect(yourTrips.map((t) => t.id)).not.toContain(nextTrip?.id)
  })

  it("fills the grid upcoming-first by departure, then newest-created, up to three", () => {
    const { yourTrips, upcoming } = pickDashboardTrips(trips, TODAY)
    expect(yourTrips.map((t) => t.id)).toEqual(["next", "far", "undated"])
    expect(yourTrips).toHaveLength(YOUR_TRIPS_LIMIT)
    expect(upcoming.map((t) => t.id)).toEqual(["today", "next", "far"])
  })

  it("with nothing upcoming, has no hero and shows the newest trips", () => {
    const past = trips.filter((t) => t.id.startsWith("past") || t.id === "undated")
    const { nextTrip, yourTrips } = pickDashboardTrips(past, TODAY)
    expect(nextTrip).toBeNull()
    expect(yourTrips.map((t) => t.id)).toEqual(["undated", "past-new", "past-old"])
  })

  it("with only the hero trip, leaves the grid empty", () => {
    const { nextTrip, yourTrips } = pickDashboardTrips([trip("solo", "2026-12-01", "2026-11-01T00:00:00Z")], TODAY)
    expect(nextTrip?.id).toBe("solo")
    expect(yourTrips).toEqual([])
  })
})

describe("dashboardStats", () => {
  it("counts trips, upcoming, distinct destinations (ignoring case) and inclusive days", () => {
    const trips = [
      { ...trip("a", "2026-12-01", "x", "Lisbon, Portugal"), end_date: "2026-12-03" },
      { ...trip("b", "2026-12-10", "x", "lisbon, portugal "), end_date: "2026-12-10" },
      trip("c", null, "x", "Kyoto"),
    ]
    expect(dashboardStats(trips, 2)).toEqual([
      { label: "Trips", value: 3 },
      { label: "Upcoming", value: 2 },
      { label: "Destinations", value: 2 },
      { label: "Days planned", value: 4 },
    ])
  })
})

describe("forecastWindow (15-day horizon)", () => {
  it("is available up to and including 15 days out", () => {
    expect(forecastWindow(TODAY, TODAY, 15)).toEqual({ kind: "available" })
    expect(forecastWindow("2026-12-08", TODAY, 15)).toEqual({ kind: "available" })
  })

  it("names the day a forecast appears for a trip further out", () => {
    expect(forecastWindow("2026-12-09", TODAY, 15)).toEqual({ kind: "later", availableFrom: "2026-11-24" })
  })

  it("is none for a past or undated trip", () => {
    expect(forecastWindow("2026-11-22", TODAY, 15)).toEqual({ kind: "none" })
    expect(forecastWindow(null, TODAY, 15)).toEqual({ kind: "none" })
  })
})

describe("heroFactLines", () => {
  const base: NextTripFacts = { packing: { checked: 4, total: 18 }, stops: 9, forecast: { kind: "none" } }
  const money = { budget: 1500, formatMoney: (n: number) => `EUR ${n}` }

  it("states a real forecast with its numbers", () => {
    const lines = heroFactLines(
      {
        ...base,
        forecast: {
          kind: "forecast",
          day: { date: "d", condition: "Rain", tempHighC: 17.4, tempLowC: 12.6, precipitationChance: 70, windKph: 20, humidity: null, sunrise: null, sunset: null },
        },
      },
      money
    )
    expect(lines[0]).toEqual({ label: "Weather, day 1", value: "Rain · 13–17°C · 70% rain" })
  })

  it("says when a forecast appears, and shows no weather at all without one", () => {
    expect(heroFactLines({ ...base, forecast: { kind: "later", availableFrom: "2026-11-24" } }, money)[0]).toEqual({
      label: "Weather",
      value: "Forecast from 24 Nov",
    })
    const none = heroFactLines(base, money)
    expect(none.map((l) => l.label)).toEqual(["Packing", "Budget", "Stops"])
    expect(JSON.stringify(none)).not.toMatch(/°C|% rain|Forecast/)
  })

  it("shows packing as X/Y only when there is a list, and budget/stops plainly", () => {
    expect(heroFactLines(base, money)).toEqual([
      { label: "Packing", value: "4/18 packed" },
      { label: "Budget", value: "EUR 1500" },
      { label: "Stops", value: "9" },
    ])
    const empty = heroFactLines({ ...base, packing: { checked: 0, total: 0 }, stops: 0 }, { ...money, budget: null })
    expect(empty).toEqual([
      { label: "Budget", value: "No budget set" },
      { label: "Stops", value: "None planned yet" },
    ])
  })
})
