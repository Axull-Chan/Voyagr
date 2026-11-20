import { describe, expect, it } from "vitest"

import type { ItineraryRequest, SourcedContext } from "@/lib/ai/types"
import { mockAiProvider } from "@/lib/ai/providers/mock-provider"
import {
  assembleItinerary,
  buildPrompt,
  selectCandidates,
  type ModelItinerary,
} from "@/lib/ai/providers/venue-grounded"
import {
  analyzeDay,
  estimateLeg,
  legsInOrder,
  sortStopsByTime,
  type GeoPoint,
} from "@/lib/trips/feasibility"

const HOTEL: GeoPoint = { lat: 38.7097, lng: -9.1377 }
const CENTRE: GeoPoint = { lat: 38.7078, lng: -9.1366 }

const sourced: SourcedContext = {
  latitude: CENTRE.lat,
  longitude: CENTRE.lng,
  resolvedName: "Lisbon",
  attractions: [
    { id: "N-belem", name: "Torre de Belem", latitude: 38.6916, longitude: -9.216, rating: 7, kinds: ["historic"] },
    { id: "N-alfama", name: "Alfama", latitude: 38.7139, longitude: -9.13, rating: 6, kinds: ["historic"] },
    { id: "N-statue", name: "Estatua de D. Jose I", latitude: 38.7075, longitude: -9.1365, rating: 7, kinds: ["historic"] },
    { id: "N-arco", name: "Arco da Rua Augusta", latitude: 38.7084, longitude: -9.1368, rating: 7, kinds: ["historic"] },
  ],
  restaurants: [],
  hotels: [{ id: "H-vincci", name: "Vincci Baixa", latitude: HOTEL.lat, longitude: HOTEL.lng, rating: 3, kinds: ["accomodations"] }],
  weatherByDate: {},
}

const request: ItineraryRequest = {
  destination: "Lisbon, Portugal",
  startingCity: null,
  startDate: "2026-11-23",
  endDate: "2026-11-23",
  travelers: 2,
  budget: null,
  currency: "EUR",
  travelStyle: "balanced",
  interests: ["history"],
  accommodation: "hotel",
  transportation: "public",
  notes: null,
  sourced,
}

const candidates = selectCandidates(sourced)
const ref = (venueId: string) =>
  [...candidates.attractionsById.entries()].find(([, v]) => v.id === venueId)![0]
const hotelRef = [...candidates.hotelsById.keys()][0]!

function assemble(hotelVenueId: string | null) {
  const model: ModelItinerary = {
    title: "Lisbon",
    summary: "A day.",
    // Listed out of time order, and zigzagging inside the morning.
    days: [
      {
        dayNumber: 1,
        summary: "History.",
        restaurants: [],
        activities: [
          { venueId: ref("N-alfama"), timeSlot: "afternoon", title: "Alfama", description: "", startTime: "14:00", durationMinutes: 90, estimatedCost: 0 },
          { venueId: ref("N-belem"), timeSlot: "morning", title: "Belem", description: "", startTime: "09:00", durationMinutes: 60, estimatedCost: 10 },
          { venueId: ref("N-statue"), timeSlot: "morning", title: "Statue", description: "", startTime: "09:30", durationMinutes: 30, estimatedCost: 0 },
          { venueId: ref("N-arco"), timeSlot: "morning", title: "Arco", description: "", startTime: "10:00", durationMinutes: 45, estimatedCost: 3 },
        ],
      },
    ],
    hotelVenueId,
    transportation: [],
    warnings: [],
  }
  return assembleItinerary({ model, request, sourced, dayCount: 1, nights: 1, candidates, providerId: "gemini" })
}

describe("generation orders and re-times each day", () => {
  const itinerary = assemble(hotelRef)
  const activities = itinerary.days[0]!.activities

  it("keeps slots in order and orders the morning by distance from the stay", () => {
    expect(activities.map((a) => a.timeSlot)).toEqual(["morning", "morning", "morning", "afternoon"])
    // Arco and the statue are beside the hotel; Belem is 7 km west.
    expect(activities.map((a) => a.title)).toEqual(["Arco", "Statue", "Belem", "Alfama"])
  })

  it("measures every stored leg in the final order, starting from the stay", () => {
    const points = activities.map((a) => ({ lat: a.lat, lng: a.lng }))
    const legs = legsInOrder(points, HOTEL, "public")
    activities.forEach((a, i) => {
      expect(a.travelTimeMinutes).toBe(legs[i]!.minutes)
      expect(a.walkingDistanceKm).toBe(legs[i]!.km)
    })
    expect(activities[0]!.walkingDistanceKm).toBe(estimateLeg(HOTEL, points[0]!, "public").km)
  })

  it("re-times so the morning leaves room to travel, with no overlap or tight gap", () => {
    const f = analyzeDay(
      activities.map((a, i) => ({
        id: String(i),
        title: a.title,
        timeSlot: a.timeSlot,
        startTime: a.startTime,
        durationMinutes: a.durationMinutes,
        lat: a.lat,
        lng: a.lng,
        sortOrder: i,
      })),
      { start: HOTEL, transport: "public" }
    )
    expect(f.issues.filter((i) => i.severity === "tight")).toEqual([])
    expect(f.status).toBe("comfortable")
    // Every time still sits inside its slot.
    expect(activities.slice(0, 3).every((a) => a.startTime < "12:00")).toBe(true)
    expect(activities[3]!.startTime >= "12:00" && activities[3]!.startTime < "17:00").toBe(true)
  })

  it("starts from the city centre when the stay is only an example", () => {
    const fallback = assemble(null)
    expect(fallback.hotels[0]!.source).toBe("mock")
    const first = fallback.days[0]!.activities[0]!
    expect(first.walkingDistanceKm).toBe(estimateLeg(CENTRE, { lat: first.lat, lng: first.lng }, "public").km)
  })
})

describe("the prompt gives the model each candidate's location", () => {
  it("lists coordinates beside every candidate", () => {
    const { system, user } = buildPrompt(request, sourced, 1, candidates)
    expect(user).toContain(`at: 38.692,-9.216`)
    expect(user).toContain(`at: 38.710,-9.138`) // the hotel candidate
    expect(system).toMatch(/close together/)
  })
})

describe("the mock provider computes legs from coordinates, not dice", () => {
  it("stores, for every activity, the leg from the previous stop in time order", async () => {
    const itinerary = await mockAiProvider.generateItinerary({ ...request, endDate: "2026-11-25" })
    expect(itinerary.days.length).toBe(3)
    for (const day of itinerary.days) {
      const ordered = sortStopsByTime(
        day.activities.map((a, i) => ({ ...a, sortOrder: i }))
      )
      const legs = legsInOrder(ordered, CENTRE, "public")
      ordered.forEach((a, i) => {
        expect(a.travelTimeMinutes).toBe(legs[i]!.minutes)
        expect(a.walkingDistanceKm).toBe(legs[i]!.km)
      })
    }
  })
})
