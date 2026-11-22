import type {
  ChatBudgetFacts,
  ChatForecast,
  ChatItinerarySnapshot,
  ChatStayFacts,
} from "@/lib/ai/types"
import { isSevereForecast } from "@/lib/ai/providers/weather-warnings"
import { analyzeDay, tripStartPoint } from "@/lib/trips/feasibility"
import { roundMoney } from "@/lib/trips/itinerary-costs"
import type { MealType, TimeSlot } from "@/lib/trips/trip-domain"
import { restaurantHoursDisplay } from "@/features/trips/services/restaurant-hours"
import type { DayWeather } from "@/services/weather-service"

/**
 * Everything the trip assistant is told about a trip, built from the same rows
 * and the same rules the trip page uses, so the chat can't describe a different
 * trip from the one on screen. Pure: the reads live in `queries/trip-chat.ts`.
 *
 * The grounding rules live here, not in the prompt, because a rule in code can
 * be tested: only a real Open-Meteo reading becomes a forecast, an example stay
 * is always marked as one, a guessed restaurant hour is always labelled, and
 * spend that couldn't be counted is counted *as* uncounted.
 */

// ---------------------------------------------------------------------------
// Row shapes (only the columns read)
// ---------------------------------------------------------------------------

export interface ChatTripRow {
  title: string
  destination: string
  currency: string
  start_date: string | null
  end_date: string | null
  status: string
  travelers: number
  travel_style: string | null
  interests: string[] | null
  accommodation: string | null
  transportation: string | null
  starting_city: string | null
  additional_notes: string | null
  budget: number | string | null
}

export interface ChatActivityRow {
  id: string
  time_slot: string | null
  title: string
  description: string | null
  location_name: string | null
  start_time: string | null
  duration_minutes: number | null
  estimated_cost: number | string | null
  category: string | null
  lat: number | null
  lng: number | null
  sort_order: number
}

export interface ChatRestaurantRow {
  id: string
  meal_type: string | null
  name: string
  cuisine: string | null
  opening_hours: string | null
}

export interface ChatWeatherRow {
  condition: string
  temp_high_c: number | string | null
  temp_low_c: number | string | null
  precipitation_chance: number | null
  wind_kph: number | string | null
  source: string
}

export interface ChatDayRow {
  day_number: number
  date: string | null
  summary: string | null
  daily_cost: number | string | null
  activities: ChatActivityRow[]
  restaurants: ChatRestaurantRow[]
  /** PostgREST returns a one-to-one embed as an object, or an array on some shapes. */
  weather: ChatWeatherRow | ChatWeatherRow[] | null
}

export interface ChatHotelRow {
  name: string
  nights: number | null
  price_per_night: number | string | null
  source: string
  is_primary: boolean | null
  lat: number | null
  lng: number | null
}

export interface ChatTransportRow {
  mode: string
  from_location: string
  to_location: string
  depart_at: string | null
}

export interface ChatSnapshotInput {
  tripId: string
  trip: ChatTripRow
  days: ChatDayRow[]
  hotels: ChatHotelRow[]
  transportation: ChatTransportRow[]
  budgetLines: { category: string; planned_amount: number | string }[]
  expenses: { amount: number | string; currency: string }[]
  packing: { is_checked: boolean }[]
  /** Live forecast by date; empty when unavailable. */
  liveWeather: Record<string, DayWeather>
}

const num = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Long free text is cut so one field can't crowd out the itinerary. */
export const MAX_NOTES_CHARS = 500
const clip = (text: string | null, max: number): string | null => {
  const trimmed = text?.trim()
  if (!trimmed) return null
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

/**
 * A day's forecast for the assistant, in the trip page's order: the live
 * reading first, else a stored row — but only one stored from Open-Meteo.
 * `mock` (modelled example weather) and `unavailable` rows were never
 * readings, so they become `none`, exactly as the page refuses to label them
 * a forecast.
 */
export function chatForecastFor(
  date: string | null,
  live: Record<string, DayWeather>,
  stored: ChatWeatherRow | null
): ChatForecast {
  const fresh = date ? live[date] : undefined
  if (fresh) {
    return {
      kind: "forecast",
      origin: "live",
      condition: fresh.condition,
      highC: fresh.tempHighC,
      lowC: fresh.tempLowC,
      precipitationChance: fresh.precipitationChance,
      windKph: fresh.windKph,
      severe: isSevereForecast(fresh),
    }
  }
  if (!stored || stored.source !== "open-meteo") return { kind: "none" }
  const windKph = num(stored.wind_kph)
  return {
    kind: "forecast",
    origin: "planning",
    condition: stored.condition,
    highC: num(stored.temp_high_c),
    lowC: num(stored.temp_low_c),
    precipitationChance: stored.precipitation_chance,
    windKph,
    severe: isSevereForecast({
      condition: stored.condition,
      precipitationChance: stored.precipitation_chance,
      windKph,
    }),
  }
}

function storedWeather(weather: ChatDayRow["weather"]): ChatWeatherRow | null {
  if (Array.isArray(weather)) return weather[0] ?? null
  return weather ?? null
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/**
 * The Budget section's maths, minus currency conversion: an expense already in
 * the trip currency counts; any other is left out and *counted as left out*,
 * so the assistant can say so instead of quoting a total that silently misses it.
 */
export function chatBudgetFacts(input: {
  currency: string
  total: number | string | null
  budgetLines: ChatSnapshotInput["budgetLines"]
  expenses: ChatSnapshotInput["expenses"]
  activityCosts: ReadonlyArray<number | string | null>
}): ChatBudgetFacts {
  const plannedByCategory = input.budgetLines.map((line) => ({
    category: line.category,
    amount: roundMoney(num(line.planned_amount) ?? 0, 2),
  }))
  const plannedTotal = roundMoney(
    plannedByCategory.reduce((sum, line) => sum + line.amount, 0),
    2
  )

  let spent = 0
  let unconvertedExpenseCount = 0
  for (const expense of input.expenses) {
    if (expense.currency === input.currency) spent += num(expense.amount) ?? 0
    else unconvertedExpenseCount += 1
  }
  spent = roundMoney(spent, 2)

  const total = num(input.total)
  const base = total ?? (plannedTotal > 0 ? plannedTotal : null)
  return {
    total,
    plannedTotal,
    plannedByCategory,
    itineraryCost: roundMoney(
      input.activityCosts.reduce<number>((sum, cost) => sum + Math.max(0, num(cost) ?? 0), 0),
      2
    ),
    spent,
    unconvertedExpenseCount,
    remaining: base === null ? null : roundMoney(base - spent, 2),
  }
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/** A stored restaurant hour as the assistant may repeat it; a guess is labelled. */
export function chatRestaurantHours(value: string | null): string | null {
  const display = restaurantHoursDisplay(value)
  if (!display) return null
  return display.kind === "typical"
    ? `typical meal hours ${display.hours} (not this restaurant's verified hours)`
    : display.hours
}

export function chatStayFacts(hotels: ChatHotelRow[]): ChatStayFacts[] {
  return hotels.map((hotel) => ({
    name: hotel.name,
    nights: hotel.nights,
    pricePerNight: num(hotel.price_per_night),
    isExample: hotel.source === "mock",
  }))
}

export function buildChatSnapshot(input: ChatSnapshotInput): ChatItinerarySnapshot {
  const { trip, days } = input
  const routeStart = tripStartPoint(input.hotels)

  const chatDays = days.map((day) => {
    const feasibility = analyzeDay(
      day.activities.map((a) => ({
        id: a.id,
        title: a.title,
        timeSlot: a.time_slot,
        startTime: a.start_time,
        durationMinutes: a.duration_minutes,
        lat: a.lat,
        lng: a.lng,
        sortOrder: a.sort_order,
      })),
      { start: routeStart, transport: trip.transportation }
    )
    return { day, feasibility }
  })

  return {
    tripId: input.tripId,
    destination: trip.destination,
    currency: trip.currency,
    days: chatDays.map(({ day, feasibility }) => ({
      dayNumber: day.day_number,
      date: day.date,
      summary: day.summary,
      forecast: chatForecastFor(day.date, input.liveWeather, storedWeather(day.weather)),
      dailyCost: num(day.daily_cost),
      pace: day.activities.length > 0 ? feasibility.status : "unknown",
      paceProblems: feasibility.issues
        .filter((issue) => issue.severity !== "info")
        .map((issue) => issue.message),
    })),
    activities: chatDays.flatMap(({ day, feasibility }) =>
      day.activities.map((a) => {
        const leg = feasibility.legs[a.id] ?? null
        return {
          id: a.id,
          dayNumber: day.day_number,
          timeSlot: a.time_slot as TimeSlot | null,
          title: a.title,
          locationName: a.location_name,
          startTime: a.start_time,
          durationMinutes: a.duration_minutes,
          estimatedCost: num(a.estimated_cost),
          category: a.category,
          description: clip(a.description, 240),
          legFromPrevious: leg ? { km: leg.km, minutes: leg.minutes, mode: leg.mode } : null,
        }
      })
    ),
    restaurants: days.flatMap((day) =>
      day.restaurants.map((r) => ({
        id: r.id,
        dayNumber: day.day_number,
        mealType: r.meal_type as MealType | null,
        name: r.name,
        cuisine: r.cuisine,
        hours: chatRestaurantHours(r.opening_hours),
      }))
    ),
    trip: {
      title: trip.title,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status,
      travelers: trip.travelers,
      travelStyle: trip.travel_style,
      interests: trip.interests ?? [],
      accommodation: trip.accommodation,
      transportation: trip.transportation,
      startingCity: trip.starting_city,
      notes: clip(trip.additional_notes, MAX_NOTES_CHARS),
    },
    budget: chatBudgetFacts({
      currency: trip.currency,
      total: trip.budget,
      budgetLines: input.budgetLines,
      expenses: input.expenses,
      activityCosts: days.flatMap((d) => d.activities.map((a) => a.estimated_cost)),
    }),
    stays: chatStayFacts(input.hotels),
    transport: input.transportation.map((leg) => ({
      mode: leg.mode,
      from: leg.from_location,
      to: leg.to_location,
      departAt: leg.depart_at,
    })),
    packing: {
      checked: input.packing.filter((item) => item.is_checked).length,
      total: input.packing.length,
    },
  }
}
