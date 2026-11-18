import { describe, expect, it } from "vitest"

import { mockAiProvider } from "@/lib/ai/providers/mock-provider"
import {
  assembleItinerary,
  selectCandidates,
  type ModelItinerary,
} from "@/lib/ai/providers/venue-grounded"
import type {
  ItineraryRequest,
  SourcedContext,
  SourcedVenue,
} from "@/lib/ai/types"

/**
 * Restaurants never carry opening hours today, because no source supplies any.
 *
 * Every provider used to write a fixed window per meal type ("07:00 - 11:00" for
 * breakfast and so on) into `restaurants.opening_hours`, and the trip page printed it
 * as the venue's own hours. These tests pin the replacement rule at the two places the
 * value used to be produced: a restaurant's hours are null, for the example catalogue
 * AND for a restaurant backed by a real venue.
 */

const venue = (id: string, name: string, kinds: string[]): SourcedVenue => ({
  id,
  name,
  latitude: 38.71,
  longitude: -9.13,
  rating: 3,
  kinds,
})

const sourced: SourcedContext = {
  latitude: 38.71,
  longitude: -9.13,
  resolvedName: "Lisbon",
  attractions: Array.from({ length: 12 }, (_, i) =>
    venue(`N${100 + i}`, `Museum ${i}`, ["museums"])
  ),
  restaurants: Array.from({ length: 12 }, (_, i) =>
    venue(`N${200 + i}`, `Tasca ${i}`, ["restaurants"])
  ),
  hotels: [venue("N300", "Pensao Central", ["hotels"])],
  weatherByDate: {},
}

const request: ItineraryRequest = {
  destination: "Lisbon",
  startingCity: null,
  startDate: "2026-03-01",
  endDate: "2026-03-02",
  travelers: 2,
  budget: 1500,
  currency: "EUR",
  travelStyle: "balanced",
  interests: ["food", "history"],
  accommodation: "hotel",
  transportation: "walk",
  notes: null,
  sourced: null,
}

describe("restaurant opening hours", () => {
  it("are null for the example catalogue (the mock provider with no real venues)", async () => {
    const itinerary = await mockAiProvider.generateItinerary(request)
    const restaurants = itinerary.days.flatMap((d) => d.restaurants)

    expect(restaurants.length).toBeGreaterThan(0)
    for (const restaurant of restaurants) expect(restaurant.openingHours).toBeNull()
  })

  it("are null for the mock provider when it is given real venues", async () => {
    const itinerary = await mockAiProvider.generateItinerary({ ...request, sourced })
    const restaurants = itinerary.days.flatMap((d) => d.restaurants)

    expect(restaurants.length).toBeGreaterThan(0)
    for (const restaurant of restaurants) expect(restaurant.openingHours).toBeNull()
  })

  it("are null for a restaurant resolved from a real venue (the Gemini/OpenAI path)", () => {
    const candidates = selectCandidates(sourced)
    const model: ModelItinerary = {
      title: "Two days in Lisbon",
      summary: "A short stay.",
      days: [
        {
          dayNumber: 1,
          summary: "Museums and a long lunch.",
          activities: [
            {
              timeSlot: "morning",
              venueId: "a1",
              title: "Museum visit",
              description: "A slow morning.",
              startTime: "10:00",
              durationMinutes: 90,
              estimatedCost: 10,
            },
          ],
          restaurants: [
            { mealType: "breakfast", venueId: "r1" },
            { mealType: "lunch", venueId: "r2" },
            { mealType: "dinner", venueId: "r3" },
          ],
        },
        { dayNumber: 2, summary: "Wandering.", activities: [], restaurants: [] },
      ],
      hotelVenueId: null,
      transportation: [],
      warnings: [],
    }

    const itinerary = assembleItinerary({
      model,
      request: { ...request, sourced },
      sourced,
      dayCount: 2,
      nights: 1,
      candidates,
      providerId: "test",
    })

    const restaurants = itinerary.days.flatMap((d) => d.restaurants)
    // All three were resolved to real venues, so a meal-type template would have
    // been written for each of them before.
    expect(restaurants).toHaveLength(3)
    for (const restaurant of restaurants) expect(restaurant.openingHours).toBeNull()
  })
})
