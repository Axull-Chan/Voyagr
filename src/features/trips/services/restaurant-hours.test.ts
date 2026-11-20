import { describe, expect, it } from "vitest"

import type { ItineraryRequest, SourcedContext } from "@/lib/ai/types"
import { mockAiProvider } from "@/lib/ai/providers/mock-provider"
import {
  assembleItinerary,
  selectCandidates,
  type ModelItinerary,
} from "@/lib/ai/providers/venue-grounded"
import {
  isMealWindowGuess,
  MEAL_WINDOW_GUESSES,
  restaurantHoursDisplay,
  restaurantHoursForExport,
  restaurantHoursText,
} from "@/features/trips/services/restaurant-hours"

describe("meal-window guesses stored before Nov 2026", () => {
  it.each(MEAL_WINDOW_GUESSES)("%s is recognised as a guess", (hours) => {
    expect(isMealWindowGuess(hours)).toBe(true)
  })

  it("is recognised whatever dash or spacing it was stored with", () => {
    expect(isMealWindowGuess("07:00-11:00")).toBe(true)
    expect(isMealWindowGuess(" 17:30 - 22:30 ")).toBe(true)
    expect(isMealWindowGuess(`11:30 ${String.fromCodePoint(0x2014)} 15:00`)).toBe(true)
  })

  it("is never shown as the restaurant's own hours", () => {
    for (const hours of MEAL_WINDOW_GUESSES) {
      expect(restaurantHoursDisplay(hours)).toEqual({
        kind: "typical",
        label: "Typical meal hours",
        hours,
      })
      expect(restaurantHoursText(hours)).toBe(`Typical meal hours ${hours}`)
    }
  })

  it("is dropped from exports", () => {
    for (const hours of MEAL_WINDOW_GUESSES) {
      expect(restaurantHoursForExport(hours)).toBeNull()
    }
  })
})

describe("other values", () => {
  it("shows and exports hours that are not a known guess unchanged", () => {
    expect(isMealWindowGuess("12:00 – 23:00")).toBe(false)
    expect(restaurantHoursDisplay("12:00 – 23:00")).toEqual({ kind: "listed", hours: "12:00 – 23:00" })
    expect(restaurantHoursForExport("12:00 – 23:00")).toBe("12:00 – 23:00")
  })

  it("shows nothing for missing hours", () => {
    expect(restaurantHoursText(null)).toBeNull()
    expect(restaurantHoursText("   ")).toBeNull()
    expect(restaurantHoursForExport(null)).toBeNull()
  })
})

const request: ItineraryRequest = {
  destination: "Lisbon, Portugal",
  startingCity: null,
  startDate: "2026-11-23",
  endDate: "2026-11-23",
  travelers: 2,
  budget: null,
  currency: "EUR",
  travelStyle: "balanced",
  interests: ["food"],
  accommodation: "hotel",
  transportation: "public",
  notes: null,
}

describe("generation no longer writes guessed hours", () => {
  it("Gemini/OpenAI assembly stores null hours for a real restaurant", () => {
    const sourced: SourcedContext = {
      latitude: 38.7078,
      longitude: -9.1366,
      resolvedName: "Lisbon",
      attractions: [{ id: "N1", name: "Arco da Rua Augusta", latitude: 38.7084, longitude: -9.1368, rating: 7, kinds: ["historic"] }],
      restaurants: [{ id: "R1", name: "Martinho da Arcada", latitude: 38.708, longitude: -9.136, rating: 3, kinds: ["cafes"] }],
      hotels: [],
      weatherByDate: {},
    }
    const candidates = selectCandidates(sourced)
    const restaurantRef = [...candidates.restaurantsById.keys()][0]!
    const model: ModelItinerary = {
      title: "Lisbon",
      summary: "A day in Lisbon.",
      days: [
        {
          dayNumber: 1,
          summary: "Coffee.",
          activities: [],
          restaurants: [
            { mealType: "breakfast", venueId: restaurantRef },
            { mealType: "dinner", venueId: restaurantRef },
          ],
        },
      ],
      hotelVenueId: null,
      transportation: [],
      warnings: [],
    }

    const itinerary = assembleItinerary({
      model,
      request: { ...request, sourced },
      sourced,
      dayCount: 1,
      nights: 1,
      candidates,
      providerId: "gemini",
    })

    const restaurants = itinerary.days.flatMap((d) => d.restaurants)
    expect(restaurants.length).toBeGreaterThan(0)
    for (const r of restaurants) expect(r.openingHours).toBeNull()
  })

  it("the mock provider stores null hours too", async () => {
    const itinerary = await mockAiProvider.generateItinerary({ ...request, endDate: "2026-11-24" })
    const restaurants = itinerary.days.flatMap((d) => d.restaurants)
    expect(restaurants.length).toBeGreaterThan(0)
    for (const r of restaurants) expect(r.openingHours).toBeNull()
  })
})
