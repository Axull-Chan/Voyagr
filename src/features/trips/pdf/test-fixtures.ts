import type { TripDetail } from "@/features/trips/queries/trip-detail"

/**
 * A realistic trip for the PDF tests, as the rows the app really reads.
 *
 * Built as loose objects and cast once: the PDF model only reads a handful of
 * columns, and spelling out every column of every table here would bury what
 * each test is actually about. Not imported by app code.
 */

const SLOTS = ["morning", "afternoon", "evening"] as const
const MEALS = ["breakfast", "lunch", "dinner"] as const

export function makeDays(count: number, startDay = 1) {
  return Array.from({ length: count }, (_, i) => {
    const n = startDay + i
    const day = String(((n - 1) % 28) + 1).padStart(2, "0")
    return {
      id: `day-${n}`,
      dayNumber: n,
      date: `2026-03-${day}`,
      summary: `Explore a different part of Lisbon on day ${n}.`,
      dailyCost: 40 + n,
      weather: {
        condition: "Light rain",
        temp_high_c: 16.4,
        temp_low_c: 9.2,
        precipitation_chance: 60,
        source: "open-meteo",
      },
      activities: SLOTS.map((slot, j) => ({
        id: `act-${n}-${j}`,
        time_slot: slot,
        start_time: ["09:30:00", "14:00:00", "19:30:00"][j],
        title: `Visit Museu do Azulejo ${n}.${j + 1}`,
        location_name: "Rua da Madre de Deus 4",
        description: j === 0 ? "Allow at least an hour." : null,
        duration_minutes: [90, 120, 150][j],
        travel_time_minutes: j === 0 ? null : 12,
        estimated_cost: j === 1 ? 0 : 12.5,
        sort_order: j,
      })),
      // Deliberately out of meal order, to prove the model sorts them.
      restaurants: [...MEALS].reverse().map((meal, j) => ({
        id: `res-${n}-${j}`,
        meal_type: meal,
        name: ["Tasca do Rui", "Cafe Central", "Pastelaria Aurora"][j],
        cuisine: ["Local", "Café", null][j],
        // A rating that must never reach the printed page.
        rating: 4.7,
      })),
    }
  })
}

export function makeDetail(overrides: Record<string, unknown> = {}): TripDetail {
  const base = {
    trip: {
      id: "trip-1",
      user_id: "user-1",
      title: "Lisbon in March",
      destination: "Lisbon, Portugal",
      status: "ready",
      currency: "EUR",
      budget: 2000,
      travelers: 2,
      start_date: "2026-03-01",
      end_date: "2026-03-03",
      additional_notes: "  Gluten-free where possible.  ",
    },
    days: makeDays(3),
    hotels: [
      {
        id: "hotel-1",
        name: "Example hotel in Lisbon",
        address: null,
        nights: 2,
        price_per_night: 120,
        // A rating that must never reach the printed page.
        rating: 4.5,
        source: "mock",
      },
    ],
    transportation: [
      {
        id: "leg-1",
        mode: "metro",
        provider: "Metro Lisboa",
        from_location: "Airport",
        to_location: "Baixa-Chiado",
        duration_minutes: 25,
        cost: 2,
        notes: null,
      },
    ],
    budget: [
      { id: "b1", category: "hotels", planned_amount: 600 },
      { id: "b2", category: "food", planned_amount: 350 },
    ],
    expenses: [
      {
        id: "e1",
        category: "food",
        amount: 32.5,
        currency: "EUR",
        description: "Dinner",
        expense_date: "2026-03-01",
      },
    ],
    packing: [
      { id: "p1", category: "Documents", item: "Passport", is_checked: true },
      { id: "p2", category: "Documents", item: "Insurance", is_checked: false },
      { id: "p3", category: null, item: "Charger", is_checked: false },
    ],
  }
  return { ...base, ...overrides } as unknown as TripDetail
}
