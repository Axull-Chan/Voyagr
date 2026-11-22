import { describe, expect, it } from "vitest"

import {
  MAX_NOTES_CHARS,
  buildChatSnapshot,
  chatBudgetFacts,
  chatForecastFor,
  chatRestaurantHours,
  chatStayFacts,
  type ChatSnapshotInput,
  type ChatWeatherRow,
} from "@/features/trips/services/chat-snapshot"
import type { DayWeather } from "@/services/weather-service"

/**
 * The trip assistant may only state what this snapshot says, so these tests pin
 * the rules that decide what it says: which weather counts as a forecast, how
 * an example stay is marked, how guessed hours are labelled, and how spend that
 * can't be counted is reported instead of silently dropped.
 */

const live = (date: string, over: Partial<DayWeather> = {}): DayWeather => ({
  date,
  condition: "Rain",
  tempHighC: 17,
  tempLowC: 13,
  precipitationChance: 70,
  windKph: 22,
  humidity: 80,
  sunrise: null,
  sunset: null,
  ...over,
})

const stored = (over: Partial<ChatWeatherRow> = {}): ChatWeatherRow => ({
  condition: "Partly cloudy",
  temp_high_c: "19.4",
  temp_low_c: "12.1",
  precipitation_chance: 10,
  wind_kph: "12",
  source: "open-meteo",
  ...over,
})

describe("chatForecastFor", () => {
  it("prefers the live reading, like the trip page", () => {
    const f = chatForecastFor("2026-12-06", { "2026-12-06": live("2026-12-06") }, stored())
    expect(f).toEqual({
      kind: "forecast",
      origin: "live",
      condition: "Rain",
      highC: 17,
      lowC: 13,
      precipitationChance: 70,
      windKph: 22,
      severe: true,
    })
  })

  it("uses a stored Open-Meteo row when there is no live reading, as numbers", () => {
    expect(chatForecastFor("2026-12-06", {}, stored())).toEqual({
      kind: "forecast",
      origin: "planning",
      condition: "Partly cloudy",
      highC: 19.4,
      lowC: 12.1,
      precipitationChance: 10,
      windKph: 12,
      severe: false,
    })
  })

  it.each(["mock", "unavailable", "something-else"])("never treats a %s row as a forecast", (source) => {
    expect(chatForecastFor("2026-12-06", {}, stored({ source }))).toEqual({ kind: "none" })
  })

  it("is none with no row, no date, or a live map for other dates (failed or past the horizon)", () => {
    expect(chatForecastFor("2026-12-06", {}, null)).toEqual({ kind: "none" })
    expect(chatForecastFor(null, { "2026-12-06": live("2026-12-06") }, null)).toEqual({ kind: "none" })
    expect(chatForecastFor("2026-12-07", { "2026-12-06": live("2026-12-06") }, null)).toEqual({ kind: "none" })
  })

  it("marks severe by the same rule as the warnings and 'Adapt for weather'", () => {
    const wet = (chance: number) =>
      chatForecastFor("d", { d: live("d", { precipitationChance: chance, windKph: 5 }) }, null)
    expect(wet(50)).toMatchObject({ severe: true })
    expect(wet(49)).toMatchObject({ severe: false })
    expect(
      chatForecastFor("d", { d: live("d", { condition: "Clear sky", precipitationChance: 0, windKph: 40 }) }, null)
    ).toMatchObject({ severe: true })
  })
})

describe("chatBudgetFacts", () => {
  const base = {
    currency: "EUR",
    total: "1500" as string | null,
    budgetLines: [
      { category: "accommodation", planned_amount: "660" },
      { category: "activities", planned_amount: 240 },
    ],
    expenses: [
      { amount: "40", currency: "EUR" },
      { amount: 12.5, currency: "EUR" },
      { amount: "21.6", currency: "USD" },
    ],
    activityCosts: [15, "10.50", null, -3],
  }

  it("matches the Budget section for trip-currency spend, and counts what it leaves out", () => {
    expect(chatBudgetFacts(base)).toEqual({
      total: 1500,
      plannedTotal: 900,
      plannedByCategory: [
        { category: "accommodation", amount: 660 },
        { category: "activities", amount: 240 },
      ],
      itineraryCost: 25.5,
      spent: 52.5,
      unconvertedExpenseCount: 1,
      remaining: 1447.5,
    })
  })

  it("falls back to the planned total like the page, and has no remaining with no budget at all", () => {
    expect(chatBudgetFacts({ ...base, total: null }).remaining).toBe(847.5)
    expect(chatBudgetFacts({ ...base, total: null, budgetLines: [] }).remaining).toBeNull()
  })
})

describe("labels that keep the assistant honest", () => {
  it("labels guessed meal windows and keeps listed hours as they are", () => {
    expect(chatRestaurantHours("11:30 – 15:00")).toBe(
      "typical meal hours 11:30 – 15:00 (not this restaurant's verified hours)"
    )
    expect(chatRestaurantHours("Mo-Fr 12:00-23:00")).toBe("Mo-Fr 12:00-23:00")
    expect(chatRestaurantHours(null)).toBeNull()
    expect(chatRestaurantHours("  ")).toBeNull()
  })

  it("marks a catalogue stay as an example and a sourced one as real", () => {
    const row = { name: "X", nights: 2, price_per_night: "110", is_primary: true, lat: 1, lng: 2 }
    expect(chatStayFacts([{ ...row, source: "mock" }])[0]).toMatchObject({ isExample: true, pricePerNight: 110 })
    expect(chatStayFacts([{ ...row, source: "opentripmap" }])[0]).toMatchObject({ isExample: false })
  })
})

describe("buildChatSnapshot", () => {
  const input: ChatSnapshotInput = {
    tripId: "t1",
    trip: {
      title: "Lisbon long weekend",
      destination: "Lisbon",
      currency: "EUR",
      start_date: "2026-12-04",
      end_date: "2026-12-05",
      status: "ready",
      travelers: 2,
      travel_style: "relaxed",
      interests: ["food", "history"],
      accommodation: "hotel",
      transportation: "public",
      starting_city: null,
      additional_notes: "x".repeat(MAX_NOTES_CHARS + 50),
      budget: 1500,
    },
    days: [
      {
        day_number: 1,
        date: "2026-12-04",
        summary: "Old town",
        daily_cost: "25.5",
        weather: [stored({ source: "mock" })],
        activities: [
          {
            id: "a2",
            time_slot: "afternoon",
            title: "Castle",
            description: "Views over the river.",
            location_name: "Castelo",
            start_time: "14:00:00",
            duration_minutes: 90,
            estimated_cost: "15",
            category: "view_points",
            lat: 38.7139,
            lng: -9.1335,
            sort_order: 1,
          },
          {
            id: "a1",
            time_slot: "morning",
            title: "Cathedral",
            description: null,
            location_name: "Sé",
            start_time: "10:00:00",
            duration_minutes: 60,
            estimated_cost: 10.5,
            category: "religion",
            lat: 38.7098,
            lng: -9.1335,
            sort_order: 0,
          },
        ],
        restaurants: [{ id: "r1", meal_type: "lunch", name: "Tasca", cuisine: "Local", opening_hours: "11:30 – 15:00" }],
      },
      { day_number: 2, date: "2026-12-05", summary: null, daily_cost: null, weather: null, activities: [], restaurants: [] },
    ],
    hotels: [{ name: "Example hotel in Lisbon", nights: 1, price_per_night: 110, source: "mock", is_primary: true, lat: 38.71, lng: -9.14 }],
    transportation: [{ mode: "train", from_location: "Porto", to_location: "Lisbon", depart_at: null }],
    budgetLines: [{ category: "accommodation", planned_amount: 110 }],
    expenses: [{ amount: 40, currency: "EUR" }, { amount: 5, currency: "GBP" }],
    packing: [{ is_checked: true }, { is_checked: false }, { is_checked: true }],
    liveWeather: { "2026-12-05": live("2026-12-05", { precipitationChance: 10, windKph: 5 }) },
  }
  const snap = buildChatSnapshot(input)

  it("carries the trip facts, clipping long notes", () => {
    expect(snap.trip).toMatchObject({
      title: "Lisbon long weekend",
      startDate: "2026-12-04",
      travelers: 2,
      travelStyle: "relaxed",
      interests: ["food", "history"],
      transportation: "public",
    })
    expect(snap.trip.notes).toHaveLength(MAX_NOTES_CHARS)
    expect(snap.packing).toEqual({ checked: 2, total: 3 })
    expect(snap.transport).toEqual([{ mode: "train", from: "Porto", to: "Lisbon", departAt: null }])
    expect(snap.stays[0]?.isExample).toBe(true)
    expect(snap.budget).toMatchObject({ spent: 40, unconvertedExpenseCount: 1, itineraryCost: 25.5, remaining: 1460 })
  })

  it("gives each day its forecast and pace, never an example forecast", () => {
    expect(snap.days[0]).toMatchObject({ forecast: { kind: "none" }, dailyCost: 25.5, pace: "comfortable" })
    expect(snap.days[1]).toMatchObject({ forecast: { kind: "forecast", origin: "live" }, pace: "unknown" })
  })

  it("gives activities their legs from the page's route rules, in time order", () => {
    const cathedral = snap.activities.find((a) => a.id === "a1")
    const castle = snap.activities.find((a) => a.id === "a2")
    // An example stay is not a start point, so the day's first stop has no leg.
    expect(cathedral?.legFromPrevious).toBeNull()
    expect(castle?.legFromPrevious).toMatchObject({ mode: "walk" })
    expect(castle?.legFromPrevious?.km).toBeGreaterThan(0)
    expect(castle).toMatchObject({ estimatedCost: 15, description: "Views over the river." })
    expect(snap.restaurants[0]?.hours).toMatch(/^typical meal hours/)
  })
})
