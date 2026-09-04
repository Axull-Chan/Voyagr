import {
  AiGenerationError,
  type AiProvider,
  type GenerateOptions,
} from "@/lib/ai/provider"
import { ACCOMMODATION_NOUN, accommodationMultiplier } from "@/lib/ai/pricing"
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
  SourcedVenue,
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

/**
 * Rotates through real venues without repeating one until the list is
 * exhausted, then starts again.
 *
 * A trip must never list the same museum twice in a week, but a fortnight in
 * a small city genuinely runs out of listed venues — wrapping is the honest
 * behaviour, and better than padding with invented ones.
 */
function createRotation<T>(items: T[]) {
  let cursor = 0
  return {
    get available() {
      return items.length > 0
    },
    next(): T | null {
      if (items.length === 0) return null
      const item = items[cursor % items.length]
      cursor += 1
      return item ?? null
    },
  }
}

/**
 * How many activities a day carries, driven by the declared travel style.
 *
 * Exported so a real provider paces its own days the same way — "packed"
 * should mean the same thing regardless of which provider is running.
 */
export const ACTIVITIES_PER_DAY: Record<string, number> = {
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
    source: "mock",
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
  costPerActivity: number,
  // Trip-wide, not day-wide — passed in by the caller and shared across every
  // day's call. This used to be created fresh inside this function, so its
  // memory reset every morning: a 5-day trip could read the exact same
  // sentence on all five days, since day 2 had no idea day 1 had already used
  // it. `usedSummaryAreas` two screens up in the caller solves the identical
  // problem for day summaries; this mirrors it for activity descriptions.
  usedDescriptions: Set<string>
): GeneratedActivity[] {
  // Every template the traveller's interests unlock, flattened once so a slot
  // can be filtered without rebuilding the list per activity.
  const candidates = interests.flatMap((interest) =>
    ACTIVITY_TEMPLATES[interest].map((template) => ({ interest, template }))
  )
  const usedPlaces = new Set<string>()

  return Array.from({ length: count }, (_, index) => {
    const slot = TIME_SLOTS[index % TIME_SLOTS.length] ?? "morning"

    // Only templates that suit this time of day, and not one already used
    // anywhere else on the trip — otherwise two different days both read
    // "Rooftop view over X", just on different mornings.
    const fitsSlot = candidates.filter(
      ({ template }) => !template.slots || template.slots.includes(slot)
    )
    const unused = fitsSlot.filter(
      ({ template }) => !usedDescriptions.has(template.description)
    )
    const { template } = pick(rng, unused.length > 0 ? unused : fitsSlot)
    usedDescriptions.add(template.description)

    // Draw from the pool the title actually reads well with — "Food walk
    // through <neighbourhood>", "Morning at <landmark>" — rather than one
    // combined pool, which produced things like "Food walk through Kinkaku-ji".
    const placePool =
      template.placeKind === "area"
        ? profile.neighbourhoods
        : template.placeKind === "site"
          ? profile.landmarks
          : [...profile.landmarks, ...profile.neighbourhoods]
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
      // An example restaurant has no diners and no receipts behind it, so it
      // gets no rating and no price level — same reasoning as the hotel
      // fallback below: an invented name is already a placeholder, but a
      // specific star score or "$$" reads as a claim nobody actually made.
      rating: null,
      priceLevel: null,
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

/**
 * A stay taken from a real listing.
 *
 * Only the nightly rate is modelled — the name and the point are the venue's
 * own. Everything this can't know is left null rather than filled in, because
 * the failure mode here is worse than a gap: `buildHotel` below pairs a real
 * hotel name from the catalogue with a randomly jittered coordinate, which put
 * a genuine Lisbon hotel on the map about four kilometres from where it is,
 * under a neighbourhood it isn't in, beside a star rating nobody gave it.
 */
function buildHotelFromVenue(
  rng: () => number,
  profile: DestinationProfile,
  request: ItineraryRequest,
  venue: SourcedVenue,
  nights: number
): GeneratedHotel {
  const pricePerNight = round(
    profile.dailyCostIndex * accommodationMultiplier(request) * (0.9 + rng() * 0.3)
  )

  return {
    source: "opentripmap",
    name: venue.name,
    address: null,
    checkInDate: request.startDate,
    checkOutDate: request.endDate,
    nights,
    pricePerNight,
    totalCost: pricePerNight * nights,
    rating: null,
    // Listing data doesn't say what a place offers, and guessing "Wi-Fi,
    // breakfast" about a specific hotel is a claim about that business.
    amenities: [],
    lat: venue.latitude,
    lng: venue.longitude,
    isPrimary: true,
  }
}

function buildHotel(
  rng: () => number,
  profile: DestinationProfile,
  request: ItineraryRequest,
  nights: number
): GeneratedHotel {
  const pricePerNight = round(
    profile.dailyCostIndex * accommodationMultiplier(request) * (0.9 + rng() * 0.3)
  )
  const coords = jitterCoord(rng, profile)

  return {
    source: "mock",
    // Describes the kind of stay rather than naming one.
    //
    // The catalogue used to hold real hotel names per city, and pairing one
    // with a jittered coordinate and a modelled rate published false details
    // about a real business. The provenance label on the page fixes the
    // presentation, but the name itself travels — into the map popup, a future
    // export — so it has to carry its own honesty.
    name: `Example ${ACCOMMODATION_NOUN[request.accommodation] ?? "stay"} in ${profile.city}`,
    address: `${pick(rng, profile.neighbourhoods)}, ${profile.city}`,
    checkInDate: request.startDate,
    checkOutDate: request.endDate,
    nights,
    pricePerNight,
    totalCost: pricePerNight * nights,
    // Same reasoning as the rating/amenities fix everywhere else a real
    // venue is missing: an example listing has no guests and no amenities
    // list behind it. This was the one remaining place in the codebase that
    // still fabricated these for a *new* trip — found during the Stage 1
    // final data-integrity audit, not just stale in already-stored rows.
    rating: null,
    amenities: [],
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

  // A day with no reading at all shouldn't trigger a weather-specific item —
  // that would assert something about conditions the trip has no idea about.
  const anyWet = days.some((d) => (d.weather.precipitationChance ?? 0) >= 50)
  const anyHot = days.some((d) => (d.weather.tempHighC ?? -Infinity) >= 28)
  const anyCold = days.some((d) => (d.weather.tempLowC ?? Infinity) <= 8)

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

/**
 * Builds a day's activities from real venues.
 *
 * The template copy is reused for framing ("Morning at X"), but the *place*
 * is always a listed one, so nothing venue-shaped is invented. Coordinates
 * come from the venue itself, which is what makes the map markers land on
 * real buildings rather than a jittered guess around the city centre.
 */
/**
 * Framing derived from what a venue actually is.
 *
 * The interest-based templates cannot be used with real listings: applied to
 * whatever OpenTripMap returns they produced "Food walk through Battle of
 * Toba-Fushimi" and "Narasaki Ryō collection" — a battle and a historical
 * figure, neither of which you can walk through or browse. The venue's own
 * OSM categories are the only reliable guide to what it is, so the verb comes
 * from those, and anything unrecognised gets the neutral "Visit".
 *
 * Descriptions are deliberately about *planning* rather than about the place:
 * we have not read the place, and asserting what it is like would be
 * inventing exactly what this phase set out to stop.
 */
const VENUE_FRAMING: { match: string[]; verb: string; note: string }[] = [
  {
    match: ["museums", "history_museums", "art_galleries", "galleries"],
    verb: "Visit",
    note: "Check the opening hours before you set out — many close one day a week.",
  },
  {
    match: ["gardens_and_parks", "natural", "nature_reserves", "beaches"],
    verb: "Walk in",
    note: "Best earlier in the day, when it's quieter and cooler.",
  },
  {
    match: ["religion", "temples", "churches", "monasteries", "shrines"],
    verb: "Visit",
    note: "Dress modestly; some areas may be closed during services.",
  },
  {
    match: ["bridges", "architecture", "historic_architecture", "towers"],
    verb: "See",
    note: "Worth a short detour on the way between other stops.",
  },
  {
    match: ["theatres_and_entertainments", "cinemas", "concert_halls"],
    // Time-neutral on purpose: slots are assigned round-robin by position, so
    // "An evening at Teatro Municipal Rivoli" kept landing under Morning at
    // 09:30. A verb that names a time of day contradicts the heading above it.
    verb: "Catch a show at",
    note: "Book ahead — walk-up tickets are rare.",
  },
  {
    match: ["shops", "marketplaces", "malls"],
    verb: "Browse",
    note: "Bring cash; smaller stalls often don't take cards.",
  },
  {
    match: ["fortifications", "castles", "ruins", "archaeology", "historic"],
    verb: "Explore",
    note: "Uneven ground in places — sensible shoes help.",
  },
]

const NEUTRAL_NOTE = "Worth confirming opening times before you go."

/**
 * Chooses how to introduce a venue from its own categories.
 *
 * The notes give behavioural instructions — how to dress, when to book — and a
 * place carrying categories from two different families cannot be given one
 * truthfully. Porto's Cinema da Trindade is a church converted into a cinema
 * and is listed under `religion,churches,cultural,cinemas,…`, so matching on
 * the first family in declaration order produced "Visit Cinema da Trindade —
 * Dress modestly; some areas may be closed during services."
 *
 * Neither ordering fixes this: ours is arbitrary, and the provider's own puts
 * `religion` first for that cinema. So the specific note is only used when
 * exactly one family matches. The verb survives an ambiguous match because
 * "Visit" or "See" asserts nothing that can be wrong; the note doesn't.
 */
function frameVenue(venue: SourcedVenue): { verb: string; note: string } {
  const matches = VENUE_FRAMING.filter((framing) =>
    venue.kinds.some((kind) => framing.match.includes(kind))
  )

  const first = matches[0]
  if (!first) return { verb: "Visit", note: NEUTRAL_NOTE }

  return {
    verb: first.verb,
    note: matches.length === 1 ? first.note : NEUTRAL_NOTE,
  }
}

function buildActivitiesFromVenues(
  rng: () => number,
  rotation: ReturnType<typeof createRotation<SourcedVenue>>,
  count: number,
  costPerActivity: number
): GeneratedActivity[] {
  const activities: GeneratedActivity[] = []

  for (let index = 0; index < count; index += 1) {
    const venue = rotation.next()
    if (!venue) break

    const slot = TIME_SLOTS[index % TIME_SLOTS.length] ?? "morning"
    const { verb, note } = frameVenue(venue)

    activities.push({
      timeSlot: slot,
      title: `${verb} ${venue.name}`,
      description: note,
      locationName: venue.name,
      lat: venue.latitude,
      lng: venue.longitude,
      startTime: SLOT_START[slot],
      durationMinutes: round(60 + rng() * 120),
      travelTimeMinutes: round(8 + rng() * 25),
      walkingDistanceKm: round(0.3 + rng() * 2.2, 1),
      estimatedCost: rng() > 0.66 ? 0 : round(costPerActivity * (0.6 + rng() * 0.9)),
      // A venue's own OSM categories describe it better than our guess.
      category: venue.kinds[0] ?? "interesting_places",
    })
  }

  return activities
}

/** Restaurants straight from the listings, with no invented names. */
function buildRestaurantsFromVenues(
  rng: () => number,
  rotation: ReturnType<typeof createRotation<SourcedVenue>>,
  count: number
): GeneratedRestaurant[] {
  const out: GeneratedRestaurant[] = []
  for (let index = 0; index < count; index += 1) {
    const venue = rotation.next()
    if (!venue) break
    const meal: MealType = MEAL_TYPES[index % MEAL_TYPES.length] ?? "lunch"
    out.push({
      mealType: meal,
      name: venue.name,
      // OSM rarely tags cuisine on these nodes; claiming one would be inventing.
      cuisine: venue.kinds.includes("cafes") ? "Café" : "Local",
      // Same reasoning as the hotel builder above: OpenTripMap's `rating`
      // field is a popularity index, not a guest score, and this function
      // was inventing a plausible-looking star rating for a real, named
      // restaurant — publishing a review nobody wrote, same bug, just never
      // caught because nothing in the UI renders it yet. `priceLevel` had
      // the identical bug (a random 1–3, unrelated to anything OpenTripMap
      // actually returns) — found in the Stage 1 provenance audit.
      rating: null,
      priceLevel: null,
      distanceKm: round(venue.rating > 0 ? 0.4 + rng() * 1.6 : 0.8, 1),
      openingHours:
        meal === "breakfast"
          ? "07:00 – 11:00"
          : meal === "lunch"
            ? "11:30 – 15:00"
            : "17:30 – 22:30",
      lat: venue.latitude,
      lng: venue.longitude,
    })
  }
  return out
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

    // Summaries name a neighbourhood, so they need their own memory of what's
    // been used — otherwise two days in a row read "A day built around
    // Arashiyama."
    const usedSummaryAreas = new Set<string>()
    const nextArea = () => {
      const fresh = profile.neighbourhoods.filter((n) => !usedSummaryAreas.has(n))
      const area = pick(rng, fresh.length > 0 ? fresh : profile.neighbourhoods)
      usedSummaryAreas.add(area)
      return area
    }
    // Same reasoning, one level down: without this, buildActivities forgot
    // what it had used the moment each day's call returned.
    const usedActivityDescriptions = new Set<string>()

    // Real venues when they were gathered, the example catalogue otherwise.
    const sourced = request.sourced ?? null
    const attractionRotation = createRotation(sourced?.attractions ?? [])
    const restaurantRotation = createRotation(sourced?.restaurants ?? [])
    const usingRealPlaces = attractionRotation.available

    const days: GeneratedDay[] = Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(request.startDate, index)

      const activities = usingRealPlaces
        ? buildActivitiesFromVenues(
            rng,
            attractionRotation,
            perDay,
            costPerActivity
          )
        : buildActivities(
            rng,
            profile,
            interests,
            perDay,
            costPerActivity,
            usedActivityDescriptions
          )

      const mealCount = 2 + (index % 2)
      const restaurants = restaurantRotation.available
        ? buildRestaurantsFromVenues(rng, restaurantRotation, mealCount)
        : buildRestaurants(rng, profile, mealCount)

      // A real forecast beats a modelled one; days beyond the horizon still
      // need something plausible so the itinerary isn't half-empty.
      const realWeather = sourced?.weatherByDate[date]
      const weather: GeneratedWeather = realWeather
        ? {
            source: "open-meteo",
            condition: realWeather.condition,
            tempHighC: realWeather.tempHighC ?? profile.climate.high,
            tempLowC: realWeather.tempLowC ?? profile.climate.low,
            precipitationChance: realWeather.precipitationChance ?? 0,
            windKph: realWeather.windKph ?? 0,
            humidity: realWeather.humidity ?? 0,
            sunrise: realWeather.sunrise ?? "06:12",
            sunset: realWeather.sunset ?? "18:44",
          }
        : buildWeather(rng, profile)
      const estimatedCost =
        activities.reduce((sum, a) => sum + a.estimatedCost, 0) +
        restaurants.length * profile.dailyCostIndex * 0.18

      return {
        dayNumber: index + 1,
        date,
        summary:
          index === 0
            ? `Arrive, settle into ${nextArea()}, and keep the first evening light.`
            : index === dayCount - 1
              ? "A slower last day with room to revisit whatever you liked most."
              : `A day built around ${nextArea()}.`,
        estimatedCost: round(estimatedCost),
        activities,
        restaurants,
        weather,
      }
    })

    const nights = Math.max(dayCount - 1, 1)
    // The listings come back nearest-first, so the head of the list is the most
    // central place to stay — which is what someone planning a short city trip
    // actually wants, and is a defensible choice rather than an arbitrary one.
    const sourcedHotel = sourced?.hotels[0] ?? null
    const hotel = sourcedHotel
      ? buildHotelFromVenue(rng, profile, request, sourcedHotel, nights)
      : buildHotel(rng, profile, request, nights)
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
    // Said explicitly, because this is the one remaining place a real-sounding
    // name can reach the page without a listing behind it. Without this the
    // example hotel is indistinguishable from the sourced one.
    if (!sourcedHotel) {
      warnings.push(
        "We couldn't find a listed place to stay here, so the suggested hotel is an example to budget against rather than a real one."
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
