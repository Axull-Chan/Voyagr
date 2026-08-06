import {
  AiGenerationError,
  type AiProvider,
  type GenerateOptions,
} from "@/lib/ai/provider"
import type {
  GeneratedActivity,
  GeneratedBudgetLine,
  GeneratedDay,
  GeneratedHotel,
  GeneratedItinerary,
  GeneratedPackingItem,
  GeneratedRestaurant,
  GeneratedTransport,
  GeneratedWeather,
  ItineraryRequest,
} from "@/lib/ai/types"
import {
  ACTIVITY_TEMPLATES,
  COLD_WEATHER_ITEMS,
  DEFAULT_INTERESTS,
  DRY_CONDITIONS,
  HOT_WEATHER_ITEMS,
  PACKING_TEMPLATE,
  resolveDestination,
  WET_CONDITIONS,
  WET_WEATHER_ITEMS,
  type DestinationProfile,
} from "@/lib/ai/providers/mock-catalog"
import {
  addDays,
  MEAL_TYPES,
  TIME_SLOTS,
  tripDurationDays,
  type Interest,
  type MealType,
  type TimeSlot,
} from "@/lib/trips/trip-domain"

/**
 * Deterministic itinerary generator.
 *
 * Seeded from the request, so the same trip always produces the same plan.
 * That matters for more than tidiness: it makes the output reproducible in
 * tests and screenshots, and it means a user who regenerates without changing
 * anything doesn't watch their itinerary shuffle for no reason.
 */

/** mulberry32 — small, fast, and good enough for content selection. */
function createRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Indexed access under `noUncheckedIndexedAccess` is `T | undefined`, so every
 * pick would otherwise need a non-null assertion at the call site. Throwing on
 * an empty pool is correct — it means the catalog is malformed.
 */
function pick<T>(rng: () => number, pool: readonly T[]): T {
  if (pool.length === 0) throw new Error("Cannot pick from an empty pool")
  const value = pool[Math.floor(rng() * pool.length) % pool.length]
  if (value === undefined) throw new Error("Pick resolved to undefined")
  return value
}

function round(value: number, dp = 0): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

/** A point a short, plausible distance from the city centre. */
function jitterCoord(
  rng: () => number,
  profile: DestinationProfile
): { lat: number; lng: number } {
  return {
    lat: round(profile.lat + (rng() - 0.5) * 0.08, 5),
    lng: round(profile.lng + (rng() - 0.5) * 0.08, 5),
  }
}

/** How many activities a day carries, driven by the declared travel style. */
const ACTIVITIES_PER_DAY: Record<string, number> = {
  relaxed: 2,
  balanced: 3,
  packed: 3,
  luxury: 2,
  budget: 3,
}

const SLOT_START: Record<TimeSlot, string> = {
  morning: "09:30",
  afternoon: "13:30",
  evening: "18:30",
}

function buildWeather(
  rng: () => number,
  profile: DestinationProfile
): GeneratedWeather {
  const wet = rng() * 100 < profile.climate.wetChance
  const swing = (rng() - 0.5) * 6
  return {
    condition: wet ? pick(rng, WET_CONDITIONS) : pick(rng, DRY_CONDITIONS),
    tempHighC: round(profile.climate.high + swing),
    tempLowC: round(profile.climate.low + swing * 0.6),
    precipitationChance: wet
      ? round(55 + rng() * 35)
      : round(rng() * 25),
    windKph: round(6 + rng() * 18),
    humidity: round(45 + rng() * 40),
    sunrise: rng() > 0.5 ? "06:12" : "06:31",
    sunset: rng() > 0.5 ? "18:44" : "19:08",
  }
}

function buildActivities(
  rng: () => number,
  profile: DestinationProfile,
  interests: Interest[],
  count: number,
  costPerActivity: number
): GeneratedActivity[] {
  // Every template the traveller's interests unlock, flattened once so a slot
  // can be filtered without rebuilding the list per activity.
  const candidates = interests.flatMap((interest) =>
    ACTIVITY_TEMPLATES[interest].map((template) => ({ interest, template }))
  )
  const usedTitles = new Set<string>()
  const usedPlaces = new Set<string>()

  return Array.from({ length: count }, (_, index) => {
    const slot = TIME_SLOTS[index % TIME_SLOTS.length] ?? "morning"

    // Only templates that suit this time of day, and not one already used
    // today — otherwise a day reads "Rooftop view over X" twice, once at 09:30.
    const fitsSlot = candidates.filter(
      ({ template }) => !template.slots || template.slots.includes(slot)
    )
    const unused = fitsSlot.filter(
      ({ template }) => !usedTitles.has(template.description)
    )
    const { template } = pick(rng, unused.length > 0 ? unused : fitsSlot)
    usedTitles.add(template.description)

    const placePool = [...profile.landmarks, ...profile.neighbourhoods]
    const freshPlaces = placePool.filter((p) => !usedPlaces.has(p))
    const place = pick(rng, freshPlaces.length > 0 ? freshPlaces : placePool)
    usedPlaces.add(place)

    const coords = jitterCoord(rng, profile)

    return {
      timeSlot: slot,
      title: template.title(place),
      description: template.description,
      locationName: place,
      lat: coords.lat,
      lng: coords.lng,
      startTime: SLOT_START[slot],
      durationMinutes: round(60 + rng() * 120),
      travelTimeMinutes: round(8 + rng() * 25),
      walkingDistanceKm: round(0.3 + rng() * 2.2, 1),
      // Free things exist; roughly a third of activities cost nothing.
      estimatedCost: rng() > 0.66 ? 0 : round(costPerActivity * (0.6 + rng() * 0.9)),
      category: template.category,
    }
  })
}

function buildRestaurants(
  rng: () => number,
  profile: DestinationProfile,
  count: number
): GeneratedRestaurant[] {
  return Array.from({ length: count }, (_, index) => {
    const meal: MealType = MEAL_TYPES[index % MEAL_TYPES.length] ?? "lunch"
    const cuisine = pick(rng, profile.cuisines)
    const area = pick(rng, profile.neighbourhoods)
    const coords = jitterCoord(rng, profile)

    return {
      mealType: meal,
      name: `${cuisine} ${pick(rng, ["House", "Room", "Table", "Counter", "Kitchen"])} ${area}`,
      cuisine,
      rating: round(4 + rng() * 0.9, 1),
      priceLevel: 1 + Math.floor(rng() * 4),
      distanceKm: round(0.2 + rng() * 1.8, 1),
      openingHours:
        meal === "breakfast"
          ? "07:00 – 11:00"
          : meal === "lunch"
            ? "11:30 – 15:00"
            : "17:30 – 22:30",
      lat: coords.lat,
      lng: coords.lng,
    }
  })
}

function buildHotel(
  rng: () => number,
  profile: DestinationProfile,
  request: ItineraryRequest,
  nights: number
): GeneratedHotel {
  const multiplier =
    request.accommodation === "hostel"
      ? 0.35
      : request.accommodation === "resort"
        ? 1.8
        : request.accommodation === "boutique"
          ? 1.3
          : request.accommodation === "apartment"
            ? 0.85
            : 1
  const pricePerNight = round(profile.dailyCostIndex * multiplier * (0.9 + rng() * 0.3))
  const coords = jitterCoord(rng, profile)

  return {
    name: pick(rng, profile.hotelNames),
    address: `${pick(rng, profile.neighbourhoods)}, ${profile.city}`,
    checkInDate: request.startDate,
    checkOutDate: request.endDate,
    nights,
    pricePerNight,
    totalCost: pricePerNight * nights,
    rating: round(4 + rng() * 0.8, 1),
    amenities: ["Wi-Fi", "Breakfast", "24h reception"].slice(
      0,
      2 + Math.floor(rng() * 2)
    ),
    lat: coords.lat,
    lng: coords.lng,
    isPrimary: true,
  }
}

function buildTransport(
  rng: () => number,
  request: ItineraryRequest,
  profile: DestinationProfile
): GeneratedTransport[] {
  const legs: GeneratedTransport[] = []

  if (request.startingCity) {
    const outbound = round(180 + rng() * 300)
    legs.push({
      mode: "flight",
      provider: null,
      fromLocation: request.startingCity,
      toLocation: profile.city,
      durationMinutes: outbound,
      cost: round(profile.dailyCostIndex * 2.4 * (0.8 + rng() * 0.6)),
      notes: "Outbound — book early for the better fares.",
      dayNumber: null,
    })
    legs.push({
      mode: "flight",
      provider: null,
      fromLocation: profile.city,
      toLocation: request.startingCity,
      durationMinutes: outbound,
      cost: round(profile.dailyCostIndex * 2.4 * (0.8 + rng() * 0.6)),
      notes: "Return.",
      dayNumber: null,
    })
  }

  const localMode =
    request.transportation === "car"
      ? "car"
      : request.transportation === "rideshare"
        ? "rideshare"
        : request.transportation === "walk"
          ? "walk"
          : "metro"

  legs.push({
    mode: localMode,
    provider: null,
    fromLocation: `${profile.city} arrivals`,
    toLocation: `${pick(rng, profile.neighbourhoods)} accommodation`,
    durationMinutes: round(20 + rng() * 40),
    cost: localMode === "walk" ? 0 : round(profile.dailyCostIndex * 0.15),
    notes: null,
    dayNumber: 1,
  })

  return legs
}

function buildPacking(
  days: GeneratedDay[],
  interests: Interest[]
): GeneratedPackingItem[] {
  const items: GeneratedPackingItem[] = PACKING_TEMPLATE.flatMap((group) =>
    group.items.map((item) => ({ category: group.category, item }))
  )

  const anyWet = days.some((d) => d.weather.precipitationChance >= 50)
  const anyHot = days.some((d) => d.weather.tempHighC >= 28)
  const anyCold = days.some((d) => d.weather.tempLowC <= 8)

  if (anyWet) {
    items.push(...WET_WEATHER_ITEMS.map((item) => ({ category: "Weather", item })))
  }
  if (anyHot) {
    items.push(...HOT_WEATHER_ITEMS.map((item) => ({ category: "Weather", item })))
  }
  if (anyCold) {
    items.push(...COLD_WEATHER_ITEMS.map((item) => ({ category: "Weather", item })))
  }
  if (interests.includes("beaches")) {
    items.push({ category: "Activities", item: "Swimwear and quick-dry towel" })
  }
  if (interests.includes("adventure")) {
    items.push({ category: "Activities", item: "Daypack" })
  }

  return items
}

/**
 * Splits the planned spend across categories. Uses the traveller's own budget
 * when they gave one so the plan lines up with what they can actually spend,
 * and falls back to a cost-index estimate when they didn't.
 */
function buildBudget(
  request: ItineraryRequest,
  profile: DestinationProfile,
  days: number,
  hotelTotal: number,
  transportTotal: number
): { lines: GeneratedBudgetLine[]; warning: string | null } {
  const estimated =
    hotelTotal +
    transportTotal +
    profile.dailyCostIndex * days * request.travelers * 0.9

  const total = request.budget && request.budget > 0 ? request.budget : estimated
  const warning =
    request.budget && request.budget > 0 && request.budget < estimated * 0.75
      ? "Your budget is tight for this destination and length — the plan leans on free activities and cheaper meals."
      : null

  const remaining = Math.max(total - hotelTotal - transportTotal, total * 0.2)

  return {
    lines: [
      { category: "hotels", plannedAmount: round(hotelTotal) },
      { category: "transportation", plannedAmount: round(transportTotal) },
      { category: "food", plannedAmount: round(remaining * 0.42) },
      { category: "activities", plannedAmount: round(remaining * 0.3) },
      { category: "shopping", plannedAmount: round(remaining * 0.16) },
      { category: "emergency_fund", plannedAmount: round(remaining * 0.12) },
    ],
    warning,
  }
}

class MockAiProvider implements AiProvider {
  readonly id = "mock" as const
  readonly label = "Mock planner"
  readonly isConfigured = true

  async generateItinerary(
    request: ItineraryRequest,
    options?: GenerateOptions
  ): Promise<GeneratedItinerary> {
    const dayCount = tripDurationDays(request.startDate, request.endDate)
    if (dayCount <= 0) {
      throw new AiGenerationError(
        this.id,
        "The end date has to be on or after the start date."
      )
    }

    // A brief, interruptible pause so callers exercise the same loading and
    // cancellation paths they will need against a real model.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400)
      options?.signal?.addEventListener("abort", () => {
        clearTimeout(timer)
        reject(new AiGenerationError(this.id, "Generation was cancelled."))
      })
    })

    const { profile, isApproximate } = resolveDestination(request.destination)
    const rng = createRng(
      `${request.destination}|${request.startDate}|${request.endDate}|${request.travelStyle}|${request.travelers}`
    )
    const interests =
      request.interests.length > 0 ? request.interests : DEFAULT_INTERESTS
    const perDay = ACTIVITIES_PER_DAY[request.travelStyle] ?? 3
    const costPerActivity = profile.dailyCostIndex * 0.22

    const days: GeneratedDay[] = Array.from({ length: dayCount }, (_, index) => {
      const activities = buildActivities(
        rng,
        profile,
        interests,
        perDay,
        costPerActivity
      )
      const restaurants = buildRestaurants(rng, profile, 2 + (index % 2))
      const weather = buildWeather(rng, profile)
      const estimatedCost =
        activities.reduce((sum, a) => sum + a.estimatedCost, 0) +
        restaurants.length * profile.dailyCostIndex * 0.18

      return {
        dayNumber: index + 1,
        date: addDays(request.startDate, index),
        summary:
          index === 0
            ? `Arrive, settle into ${pick(rng, profile.neighbourhoods)}, and keep the first evening light.`
            : index === dayCount - 1
              ? "A slower last day with room to revisit whatever you liked most."
              : `A day built around ${pick(rng, profile.neighbourhoods)}.`,
        estimatedCost: round(estimatedCost),
        activities,
        restaurants,
        weather,
      }
    })

    const nights = Math.max(dayCount - 1, 1)
    const hotel = buildHotel(rng, profile, request, nights)
    const transportation = buildTransport(rng, request, profile)
    const transportTotal = transportation.reduce((sum, t) => sum + t.cost, 0)
    const { lines, warning } = buildBudget(
      request,
      profile,
      dayCount,
      hotel.totalCost,
      transportTotal
    )

    const warnings: string[] = []
    if (isApproximate) {
      warnings.push(
        `We don't have detailed data for ${request.destination} yet, so map pins and costs are approximate.`
      )
    }
    if (warning) warnings.push(warning)

    return {
      title: `${dayCount} days in ${profile.city}`,
      summary: `A ${request.travelStyle} ${dayCount}-day plan for ${request.travelers} ${
        request.travelers === 1 ? "traveller" : "travellers"
      }, built around ${interests.slice(0, 3).join(", ")}.`,
      days,
      hotels: [hotel],
      transportation,
      budget: lines,
      packing: buildPacking(days, interests),
      providerId: this.id,
      warnings,
    }
  }
}

export const mockAiProvider: AiProvider = new MockAiProvider()
