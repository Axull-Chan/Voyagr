import { describe, expect, it } from "vitest"

import type { ItineraryRequest, SourcedContext } from "@/lib/ai/types"
import {
  assembleItinerary,
  selectCandidates,
  type ModelItinerary,
} from "@/lib/ai/providers/venue-grounded"
import {
  forecastWarningsForDay,
  isWeatherClaim,
  reconcileWeatherWarnings,
} from "@/lib/ai/providers/weather-warnings"

/**
 * The real Open-Meteo forecast and the real Gemini warnings from the live
 * Lisbon run of 2026-11-20. Nov 25 is labelled "Rain" (Open-Meteo's daily code
 * is the day's worst) but has a 10% precipitation chance, and the model wrote
 * "Heavy rain is expected on November 24th and 25th".
 */
const weatherByDate: SourcedContext["weatherByDate"] = {
  "2026-11-23": { condition: "Overcast", tempHighC: 16, tempLowC: 9, precipitationChance: 3, windKph: 8.6, humidity: 91, sunrise: "07:27", sunset: "17:18" },
  "2026-11-24": { condition: "Rain", tempHighC: 16.9, tempLowC: 11.5, precipitationChance: 65, windKph: 15.7, humidity: 94, sunrise: "07:28", sunset: "17:17" },
  "2026-11-25": { condition: "Rain", tempHighC: 16.1, tempLowC: 13, precipitationChance: 10, windKph: 16.4, humidity: 90, sunrise: "07:29", sunset: "17:17" },
}
const dates = ["2026-11-23", "2026-11-24", "2026-11-25"]

const geminiWarnings = [
  "Heavy rain is expected on November 24th and 25th; please carry an umbrella and wear waterproof footwear.",
  "The Arco da Rua Augusta is an open-air viewpoint and may be slippery during rain.",
  "Archaeological sites like Núcleo Arqueológico may require advance booking for guided tours.",
]

const forecast = (overrides: Partial<SourcedContext["weatherByDate"][string]>) => ({
  ...weatherByDate["2026-11-25"]!,
  ...overrides,
})

describe("reconcileWeatherWarnings - the Lisbon 25 Nov case", () => {
  const result = reconcileWeatherWarnings(geminiWarnings, weatherByDate, dates)

  it("never claims heavy rain, and says nothing about rain on the 10% day", () => {
    expect(result.join(" ")).not.toMatch(/heavy/i)
    expect(result.some((w) => w.includes("25 Nov"))).toBe(false)
  })

  it("warns about the 65% day from the forecast's own number", () => {
    expect(result).toContain(
      "Rain is likely on Tue 24 Nov (65% chance in the forecast) - worth packing a waterproof layer."
    )
  })

  it("keeps the non-weather warning and drops every model weather claim", () => {
    expect(result).toContain(geminiWarnings[2])
    expect(result).not.toContain(geminiWarnings[0])
    expect(result).not.toContain(geminiWarnings[1])
    expect(result).toHaveLength(2)
  })
})

describe("forecastWarningsForDay", () => {
  it("does not warn on a 'Rain' day below the likelihood threshold", () => {
    expect(forecastWarningsForDay("2026-11-25", forecast({ precipitationChance: 10 }))).toEqual([])
    expect(forecastWarningsForDay("2026-11-25", forecast({ precipitationChance: 49 }))).toEqual([])
  })

  it("warns at the threshold", () => {
    expect(forecastWarningsForDay("2026-11-25", forecast({ precipitationChance: 50 }))).toHaveLength(1)
  })

  it("treats an unknown probability as no evidence of rain", () => {
    expect(forecastWarningsForDay("2026-11-25", forecast({ precipitationChance: null }))).toEqual([])
  })

  it("does not warn about precipitation on a dry-coded day, whatever the chance", () => {
    expect(
      forecastWarningsForDay("2026-11-25", forecast({ condition: "Overcast", precipitationChance: 80 }))
    ).toEqual([])
  })

  it("names thunderstorms and snow by their condition, never as 'heavy'", () => {
    const storm = forecastWarningsForDay("2026-11-25", forecast({ condition: "Thunderstorm", precipitationChance: 70 }))
    const snow = forecastWarningsForDay("2026-11-25", forecast({ condition: "Snow showers", precipitationChance: 70 }))
    expect(storm[0]).toMatch(/^Thunderstorms are possible on Wed 25 Nov/)
    expect(snow[0]).toMatch(/^Snow is likely on Wed 25 Nov/)
    expect([...storm, ...snow].join(" ")).not.toMatch(/heavy/i)
  })

  it("warns about strong wind from the wind speed alone", () => {
    expect(forecastWarningsForDay("2026-11-25", forecast({ windKph: 39.9 }))).toEqual([])
    expect(forecastWarningsForDay("2026-11-25", forecast({ windKph: 52.4 }))).toEqual([
      "Strong wind is forecast on Wed 25 Nov (up to 52 km/h).",
    ])
  })
})

describe("isWeatherClaim", () => {
  it.each([
    "Heavy rain is expected on Tuesday",
    "Bring an umbrella",
    "Thunderstorms may close the viewpoint",
    "It will be windy on the cliffs",
    "Check the forecast before the boat trip",
  ])("flags %j", (text) => {
    expect(isWeatherClaim(text)).toBe(true)
  })

  it.each([
    "Archaeological sites may require advance booking",
    "Hail a taxi from the square after dark",
    "Unwind at the hotel spa",
    "Trains to Sintra are busy on weekends",
  ])("leaves %j alone", (text) => {
    expect(isWeatherClaim(text)).toBe(false)
  })
})

describe("assembleItinerary applies the reconciliation", () => {
  it("returns forecast weather warnings, not the model's", () => {
    const sourced: SourcedContext = {
      latitude: 38.7078,
      longitude: -9.1366,
      resolvedName: "Lisbon",
      attractions: [{ id: "N1", name: "Arco da Rua Augusta", latitude: 38.7084, longitude: -9.1368, rating: 7, kinds: ["historic"] }],
      restaurants: [],
      hotels: [],
      weatherByDate,
    }
    const request: ItineraryRequest = {
      destination: "Lisbon, Portugal",
      startingCity: null,
      startDate: "2026-11-23",
      endDate: "2026-11-25",
      travelers: 2,
      budget: 1500,
      currency: "EUR",
      travelStyle: "balanced",
      interests: ["history"],
      accommodation: "hotel",
      transportation: "public",
      notes: null,
      sourced,
    }
    const model: ModelItinerary = {
      title: "Lisbon",
      summary: "Three days in Lisbon.",
      days: [],
      hotelVenueId: null,
      transportation: [],
      warnings: geminiWarnings,
    }

    const itinerary = assembleItinerary({
      model,
      request,
      sourced,
      dayCount: 3,
      nights: 2,
      candidates: selectCandidates(sourced),
      providerId: "gemini",
    })

    expect(itinerary.warnings.join(" ")).not.toMatch(/heavy rain/i)
    expect(itinerary.warnings).toContain(
      "Rain is likely on Tue 24 Nov (65% chance in the forecast) - worth packing a waterproof layer."
    )
    expect(itinerary.warnings).toContain(geminiWarnings[2])
  })
})
