import { ACCOMMODATION_NOUN, accommodationMultiplier } from "@/lib/ai/pricing"
import { ACTIVITIES_PER_DAY } from "@/lib/ai/providers/mock-provider"
import { resolveDestination } from "@/lib/ai/providers/mock-catalog"
import type {
  GeneratedActivity,
  GeneratedDay,
  GeneratedHotel,
  GeneratedItinerary,
  GeneratedRestaurant,
  GeneratedTransport,
  GeneratedWeather,
  ItineraryRequest,
  SourcedContext,
  SourcedVenue,
} from "@/lib/ai/types"
import { addDays, MEAL_TYPES, TIME_SLOTS, TRANSPORT_MODES, type BudgetCategory } from "@/lib/trips/trip-domain"

/**
 * Shared between every "real model, grounded in real venues" provider —
 * OpenAI and Gemini so far, and whichever comes after.
 *
 * The two providers disagree on how to *express* a JSON Schema (OpenAI wants
 * `type: [x, "null"]`; Gemini wants a separate `nullable: true` flag on a
 * scalar type — see each provider's own `buildSchema`) and obviously on how
 * to *call* their APIs, but everything downstream of "the model handed back
 * an object shaped like `ModelItinerary`" is identical: which real venue a
 * `venueId` resolves to, how a day's weather is populated, how the budget is
 * computed. Splitting on the axis of "differs per provider" vs. "true no
 * matter which model answered" is what this file is.
 */

export const MAX_ATTRACTION_CANDIDATES = 40
export const MAX_RESTAURANT_CANDIDATES = 25

// ---------------------------------------------------------------------------
// Geometry
//
// Travel time and walking distance have no real source in this app (no
// routing/directions provider is wired up — see CLAUDE.md's Phase 5 notes).
// Deriving them from the real coordinates of the real, resolved venues is
// strictly better than the mock's pure `jitterCoord`-adjacent random numbers:
// it is still an estimate, but now one grounded in the actual places chosen,
// rather than a number with no relationship to anything on the page.
// ---------------------------------------------------------------------------

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(s))
}

/** ~4.5 km/h — a touch slower than a brisk walking pace, to allow for city
 * navigation, crossings and the odd pause, without inventing a false-precise
 * routed time the way naming a specific number of minutes would imply. */
function walkMinutesFor(km: number): number {
  return Math.max(5, Math.round((km / 4.5) * 60))
}

function round(value: number, dp = 0): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

// ---------------------------------------------------------------------------
// The shape every provider's model must produce.
//
// Deliberately thinner than `GeneratedItinerary` — every field a real place's
// name, point, category or cost-tier would otherwise occupy is absent here,
// replaced by a `venueId` the response mapper resolves afterward. Budget and
// packing are absent entirely: both are arithmetic over numbers this file
// already has once the rest is resolved, and letting a model independently
// guess a breakdown risks lines that don't actually sum to the total.
// ---------------------------------------------------------------------------

export interface ModelActivity {
  timeSlot: string
  venueId: string
  title: string
  description: string
  startTime: string
  durationMinutes: number
  estimatedCost: number
}

export interface ModelRestaurant {
  mealType: string
  venueId: string
}

export interface ModelDay {
  dayNumber: number
  summary: string
  activities: ModelActivity[]
  restaurants: ModelRestaurant[]
}

export interface ModelTransport {
  mode: string
  provider: string | null
  fromLocation: string
  toLocation: string
  durationMinutes: number
  cost: number
  notes: string | null
  dayNumber: number | null
}

export interface ModelItinerary {
  title: string
  summary: string
  days: ModelDay[]
  hotelVenueId: string | null
  transportation: ModelTransport[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Entry check + candidate selection
// ---------------------------------------------------------------------------

/**
 * Whether there is enough real data to ground a real generation at all.
 *
 * Restaurants and hotels are allowed to come up empty — the model can plan
 * around a gap in either. Attractions cannot: they are the backbone of the
 * itinerary, and with none, letting a model invent some to fill the day
 * would fail this project's one non-negotiable rule.
 */
export function hasGroundingData(sourced: SourcedContext | null | undefined): boolean {
  return Boolean(sourced && sourced.attractions.length > 0)
}

export interface Candidates {
  attractionsById: Map<string, SourcedVenue>
  restaurantsById: Map<string, SourcedVenue>
  hotelsById: Map<string, SourcedVenue>
}

/**
 * Assigns short, synthetic reference ids ("a1", "a2", …) rather than keying
 * on the venue's own real id (an OpenTripMap xid like "N5457844732").
 *
 * Found empirically, not from any documented limit: a live Gemini request
 * with a *single* real xid as an enum value succeeds, but two or more real
 * xids together in the same enum reliably return `400 Request contains an
 * invalid argument` — reproduced by bisection down to the exact enum
 * entries, ruling out prompt size, day count, and candidate volume (see
 * CLAUDE.md's Phase 4 notes for the full trail). The cause sits somewhere in
 * Gemini's schema compiler and isn't something this app can fix; a short
 * synthetic token sidesteps it entirely. Applied for every provider, not
 * just Gemini — OpenAI's own request never got to a live full-schema test
 * (its account has no billing), so there's no evidence it's immune to the
 * same class of issue, and a synthetic id costs nothing OpenAI cares about.
 */
function assignRefIds(venues: SourcedVenue[], prefix: string): Map<string, SourcedVenue> {
  const map = new Map<string, SourcedVenue>()
  venues.forEach((venue, index) => map.set(`${prefix}${index + 1}`, venue))
  return map
}

/** Trims the offered pool before it becomes part of a prompt and an enum —
 * every provider's places-service already sorts nearest/most-relevant first,
 * so a straight slice keeps the strongest candidates. */
export function selectCandidates(sourced: SourcedContext): Candidates {
  return {
    attractionsById: assignRefIds(
      sourced.attractions.slice(0, MAX_ATTRACTION_CANDIDATES),
      "a"
    ),
    restaurantsById: assignRefIds(
      sourced.restaurants.slice(0, MAX_RESTAURANT_CANDIDATES),
      "r"
    ),
    hotelsById: assignRefIds(sourced.hotels, "h"),
  }
}

// ---------------------------------------------------------------------------
// Prompt — identical regardless of which model answers it.
// ---------------------------------------------------------------------------

function venueLines(byId: Map<string, SourcedVenue>): string {
  if (byId.size === 0) return "(none available)"
  return [...byId.entries()]
    .map(
      ([refId, v]) =>
        `- id: ${refId} | name: "${v.name}" | kinds: ${v.kinds.join(",") || "unknown"}`
    )
    .join("\n")
}

function weatherLines(sourced: SourcedContext, startDate: string, dayCount: number): string {
  const lines: string[] = []
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDays(startDate, i)
    const w = sourced.weatherByDate[date]
    lines.push(
      w
        ? `- ${date}: ${w.condition}, high ${w.tempHighC ?? "?"}°C, low ${w.tempLowC ?? "?"}°C`
        : `- ${date}: no forecast available yet (beyond the forecast horizon)`
    )
  }
  return lines.join("\n")
}

export function buildPrompt(
  request: ItineraryRequest,
  sourced: SourcedContext,
  dayCount: number,
  candidates: Candidates
): { system: string; user: string } {
  const activityTarget = ACTIVITIES_PER_DAY[request.travelStyle] ?? 3

  const system = [
    "You plan real travel itineraries for Voyagr, a trip-planning app.",
    "You arrange already-verified real places into a day-by-day schedule and write the prose that introduces each one.",
    "You must never invent a place. Every activity and restaurant you schedule references a venue by its exact id from the candidate list you are given — never a name, never a place not in that list.",
    "Do not repeat the same venue anywhere in the trip.",
    "Write in a warm, specific, confident travel-guide voice. Avoid starting every activity title with the same word.",
    "A venue's \"kinds\" are its real categories (from OpenStreetMap). Ground your description in what the kinds actually say the place is — do not claim something about it that its kinds don't support.",
  ].join(" ")

  const user = `
Destination: ${sourced.resolvedName}${request.startingCity ? ` (travelling from ${request.startingCity})` : ""}
Dates: ${request.startDate} to ${request.endDate} (${dayCount} day${dayCount === 1 ? "" : "s"})
Travellers: ${request.travelers}
Pace: ${request.travelStyle} — aim for about ${activityTarget} activities per day
Interests: ${request.interests.join(", ") || "no particular preference"}
Accommodation style: ${request.accommodation}
Getting around: ${request.transportation}
${request.budget ? `Budget: ${request.budget} ${request.currency} total` : "No budget given — plan and price reasonably for the destination"}
${request.notes ? `Traveller notes: ${request.notes}` : ""}

Known weather:
${weatherLines(sourced, request.startDate, dayCount)}

Candidate activities/attractions (schedule only from this list, by id):
${venueLines(candidates.attractionsById)}

Candidate restaurants (schedule only from this list, by id):
${venueLines(candidates.restaurantsById)}

Candidate places to stay (choose the one best suited to the accommodation style and budget, by id — or null if none fit):
${venueLines(candidates.hotelsById)}

Produce exactly ${dayCount} day${dayCount === 1 ? "" : "s"}, numbered sequentially from 1. If a candidate list above is short, it is fine to leave a day lighter or a meal unscheduled rather than repeat a venue.
`.trim()

  return { system, user }
}

// ---------------------------------------------------------------------------
// Response mapping — the boundary where the model's arrangement/prose is
// combined with the real data it was never trusted to reproduce itself.
// ---------------------------------------------------------------------------

function mapWeather(sourced: SourcedContext, date: string): GeneratedWeather {
  const real = sourced.weatherByDate[date]
  if (real) {
    return {
      source: "open-meteo",
      condition: real.condition,
      tempHighC: real.tempHighC,
      tempLowC: real.tempLowC,
      precipitationChance: real.precipitationChance,
      windKph: real.windKph,
      humidity: real.humidity,
      sunrise: real.sunrise,
      sunset: real.sunset,
    }
  }
  // Past the forecast horizon: said plainly rather than modelled, since these
  // providers, unlike the mock, have no per-destination climate catalogue to
  // fall back on, and inventing one only to fill this gap isn't worth adding.
  return {
    source: "unavailable",
    condition: "Forecast not yet available",
    tempHighC: null,
    tempLowC: null,
    precipitationChance: null,
    windKph: null,
    humidity: null,
    sunrise: null,
    sunset: null,
  }
}

function openingHoursFor(meal: string): string {
  return meal === "breakfast"
    ? "07:00 – 11:00"
    : meal === "lunch"
      ? "11:30 – 15:00"
      : "17:30 – 22:30"
}

/** A stay with no real listing behind it — same honest fallback the mock
 * uses, reimplemented locally rather than imported so no provider reaches
 * into another provider's internals; see pricing.ts for the one piece that
 * genuinely needed to be shared (so the numbers can't drift apart). */
function fallbackHotel(request: ItineraryRequest, nights: number): GeneratedHotel {
  const { profile } = resolveDestination(request.destination)
  const pricePerNight = round(profile.dailyCostIndex * accommodationMultiplier(request))
  return {
    source: "mock",
    name: `Example ${ACCOMMODATION_NOUN[request.accommodation] ?? "stay"} in ${profile.city || request.destination}`,
    address: null,
    checkInDate: request.startDate,
    checkOutDate: request.endDate,
    nights,
    pricePerNight,
    totalCost: pricePerNight * nights,
    rating: null,
    amenities: [],
    lat: profile.lat,
    lng: profile.lng,
    isPrimary: true,
  }
}

function mapHotel(
  model: ModelItinerary,
  request: ItineraryRequest,
  hotelsById: Map<string, SourcedVenue>,
  nights: number
): GeneratedHotel {
  const venue = model.hotelVenueId ? hotelsById.get(model.hotelVenueId) : undefined
  if (!venue) return fallbackHotel(request, nights)

  const pricePerNight = round(
    resolveDestination(request.destination).profile.dailyCostIndex *
      accommodationMultiplier(request)
  )
  return {
    source: "opentripmap",
    name: venue.name,
    // A listing has a point, not a postal address — see the identical
    // reasoning on the mock's own buildHotelFromVenue.
    address: null,
    checkInDate: request.startDate,
    checkOutDate: request.endDate,
    nights,
    pricePerNight,
    totalCost: pricePerNight * nights,
    rating: null,
    amenities: [],
    lat: venue.latitude,
    lng: venue.longitude,
    isPrimary: true,
  }
}

function mapDay(
  modelDay: ModelDay,
  dayIndex: number,
  request: ItineraryRequest,
  sourced: SourcedContext,
  attractionsById: Map<string, SourcedVenue>,
  restaurantsById: Map<string, SourcedVenue>,
  originPoint: { lat: number; lng: number },
  warnings: string[]
): GeneratedDay {
  // The array's own position is the source of truth for numbering and
  // dating — never the model's self-reported `dayNumber`, which the schema
  // bounds but does not guarantee is unique or in order.
  const dayNumber = dayIndex + 1
  const date = addDays(request.startDate, dayIndex)

  let previousPoint = originPoint
  const activities: GeneratedActivity[] = []
  for (const a of modelDay.activities) {
    const venue = attractionsById.get(a.venueId)
    if (!venue) {
      // Strict/schema-enum mode should make this unreachable; kept as a hard
      // backstop rather than trusting that guarantee absolutely — the same
      // instinct that drives every `if (!row) throw` elsewhere in this app.
      warnings.push(`Dropped an activity referencing an unknown venue on day ${dayNumber}.`)
      continue
    }
    const point = { lat: venue.latitude, lng: venue.longitude }
    const distanceKm = round(haversineKm(previousPoint, point), 1)
    activities.push({
      timeSlot: (TIME_SLOTS as readonly string[]).includes(a.timeSlot)
        ? (a.timeSlot as GeneratedActivity["timeSlot"])
        : "morning",
      title: a.title,
      description: a.description,
      locationName: venue.name,
      lat: venue.latitude,
      lng: venue.longitude,
      startTime: a.startTime,
      durationMinutes: a.durationMinutes,
      travelTimeMinutes: walkMinutesFor(distanceKm),
      walkingDistanceKm: distanceKm,
      estimatedCost: Math.max(0, a.estimatedCost),
      category: venue.kinds[0] ?? "interesting_places",
    })
    previousPoint = point
  }

  const restaurants: GeneratedRestaurant[] = []
  for (const r of modelDay.restaurants) {
    const venue = restaurantsById.get(r.venueId)
    if (!venue) {
      warnings.push(`Dropped a restaurant referencing an unknown venue on day ${dayNumber}.`)
      continue
    }
    restaurants.push({
      mealType: (MEAL_TYPES as readonly string[]).includes(r.mealType)
        ? (r.mealType as GeneratedRestaurant["mealType"])
        : "lunch",
      name: venue.name,
      cuisine: venue.kinds.includes("cafes") ? "Café" : "Local",
      // Same as the mock provider's identical fix: nothing sourced here
      // prices these venues, so a "$"–"$$$" reads as a claim nobody made.
      rating: null,
      priceLevel: null,
      distanceKm: round(
        haversineKm(originPoint, { lat: venue.latitude, lng: venue.longitude }),
        1
      ),
      openingHours: openingHoursFor(r.mealType),
      lat: venue.latitude,
      lng: venue.longitude,
    })
  }

  return {
    dayNumber,
    date,
    summary: modelDay.summary,
    estimatedCost: round(activities.reduce((sum, a) => sum + a.estimatedCost, 0)),
    activities,
    restaurants,
    weather: mapWeather(sourced, date),
  }
}

function mapTransport(model: ModelTransport[], dayCount: number): GeneratedTransport[] {
  return model.map((t) => ({
    mode: (TRANSPORT_MODES as readonly string[]).includes(t.mode)
      ? (t.mode as GeneratedTransport["mode"])
      : "walk",
    provider: t.provider,
    fromLocation: t.fromLocation,
    toLocation: t.toLocation,
    durationMinutes: Math.max(0, t.durationMinutes),
    cost: Math.max(0, t.cost),
    notes: t.notes,
    dayNumber:
      t.dayNumber !== null && t.dayNumber >= 1 && t.dayNumber <= dayCount ? t.dayNumber : null,
  }))
}

/**
 * The budget breakdown, computed from what was actually planned rather than
 * asked of the model — a set of numbers a model produces independently has
 * no guarantee of summing to the total it was also asked for, and this app
 * already has the real figures once the rest of the itinerary is resolved.
 */
function buildBudget(
  request: ItineraryRequest,
  days: GeneratedDay[],
  hotel: GeneratedHotel,
  transportation: GeneratedTransport[]
): { lines: { category: BudgetCategory; plannedAmount: number }[]; warning: string | null } {
  const activityTotal = days.reduce((sum, d) => sum + d.estimatedCost, 0)
  const transportTotal = transportation.reduce((sum, t) => sum + t.cost, 0)
  const estimated = hotel.totalCost + transportTotal + activityTotal * 1.6 // headroom for food/shopping, matching the split ratios below

  const total = request.budget && request.budget > 0 ? request.budget : estimated
  const warning =
    request.budget && request.budget > 0 && request.budget < estimated * 0.75
      ? "Your budget is tight for this destination and length — the plan leans on free activities and cheaper meals."
      : null

  const remaining = Math.max(total - hotel.totalCost - transportTotal, total * 0.2)

  return {
    lines: [
      { category: "hotels", plannedAmount: round(hotel.totalCost) },
      { category: "transportation", plannedAmount: round(transportTotal) },
      { category: "food", plannedAmount: round(remaining * 0.42) },
      { category: "activities", plannedAmount: round(remaining * 0.3) },
      { category: "shopping", plannedAmount: round(remaining * 0.16) },
      { category: "emergency_fund", plannedAmount: round(remaining * 0.12) },
    ],
    warning,
  }
}

const PACKING_BASE: { category: string; items: string[] }[] = [
  { category: "Documents", items: ["Passport / ID", "Travel insurance details", "Booking confirmations"] },
  { category: "Essentials", items: ["Phone charger", "Toiletries", "Medication"] },
  { category: "Clothing", items: ["Comfortable walking shoes", "A layer for the evening"] },
]

function buildPacking(
  days: GeneratedDay[],
  interests: ItineraryRequest["interests"]
): { category: string; item: string }[] {
  const items = PACKING_BASE.flatMap((g) => g.items.map((item) => ({ category: g.category, item })))
  const anyWet = days.some((d) => (d.weather.precipitationChance ?? 0) >= 50)
  const anyHot = days.some((d) => (d.weather.tempHighC ?? -Infinity) >= 28)
  const anyCold = days.some((d) => (d.weather.tempLowC ?? Infinity) <= 8)
  if (anyWet) items.push({ category: "Weather", item: "Compact umbrella" })
  if (anyHot) items.push({ category: "Weather", item: "Sun hat" })
  if (anyCold) items.push({ category: "Weather", item: "Warm coat" })
  if (interests.includes("beaches")) items.push({ category: "Activities", item: "Swimwear" })
  if (interests.includes("adventure")) items.push({ category: "Activities", item: "Daypack" })
  return items
}

/**
 * The one function every provider calls once it has a parsed `ModelItinerary`
 * back from its own API — turns the model's arrangement/prose into the real
 * `GeneratedItinerary` the rest of the app expects, resolving every venue
 * reference against real data along the way.
 */
export function assembleItinerary(args: {
  model: ModelItinerary
  request: ItineraryRequest
  sourced: SourcedContext
  dayCount: number
  nights: number
  candidates: Candidates
  providerId: string
}): GeneratedItinerary {
  const { model, request, sourced, dayCount, nights, candidates, providerId } = args
  const warnings: string[] = [...model.warnings]
  const originPoint = { lat: sourced.latitude, lng: sourced.longitude }

  const days = model.days.map((day, index) =>
    mapDay(
      day,
      index,
      request,
      sourced,
      candidates.attractionsById,
      candidates.restaurantsById,
      originPoint,
      warnings
    )
  )

  const hotel = mapHotel(model, request, candidates.hotelsById, nights)
  if (hotel.source === "mock") {
    warnings.push(
      "We couldn't find a listed place to stay here, so the suggested hotel is an example to budget against rather than a real one."
    )
  }

  const transportation = mapTransport(model.transportation, dayCount)
  const { lines: budget, warning: budgetWarning } = buildBudget(
    request,
    days,
    hotel,
    transportation
  )
  if (budgetWarning) warnings.push(budgetWarning)

  return {
    title: model.title,
    summary: model.summary,
    days,
    hotels: [hotel],
    transportation,
    budget,
    packing: buildPacking(days, request.interests),
    providerId,
    warnings,
  }
}
