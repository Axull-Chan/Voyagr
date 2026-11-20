import type {
  AccommodationPreference,
  BudgetCategory,
  Interest,
  MealType,
  TimeSlot,
  TransportMode,
  TransportPreference,
  TravelStyle,
} from "@/lib/trips/trip-domain"

/**
 * The contract between the app and whichever model produces an itinerary.
 *
 * These shapes are deliberately *not* database rows. Persistence maps them
 * (see features/trips/services/itinerary-writer.ts), which means a column
 * rename never reaches a provider and a provider's response format never
 * reaches the schema.
 */

/**
 * A real place the planner may schedule, gathered before generation.
 *
 * Supplying these rather than letting a provider name venues is what stops
 * invented restaurants reaching a user. A real model provider would receive
 * the same list as grounding; the mock arranges them directly.
 */
export interface SourcedVenue {
  id: string
  name: string
  latitude: number
  longitude: number
  rating: number
  kinds: string[]
}

export interface SourcedContext {
  latitude: number
  longitude: number
  /** Canonical destination name from geocoding, e.g. "Kyoto". */
  resolvedName: string
  attractions: SourcedVenue[]
  restaurants: SourcedVenue[]
  hotels: SourcedVenue[]
  /** Date → real forecast, where one exists. */
  weatherByDate: Record<
    string,
    {
      condition: string
      tempHighC: number | null
      tempLowC: number | null
      precipitationChance: number | null
      windKph: number | null
      humidity: number | null
      sunrise: string | null
      sunset: string | null
    }
  >
}

export interface ItineraryRequest {
  destination: string
  startingCity: string | null
  /** ISO `YYYY-MM-DD`. */
  startDate: string
  /** ISO `YYYY-MM-DD`, inclusive. */
  endDate: string
  travelers: number
  budget: number | null
  currency: string
  travelStyle: TravelStyle
  interests: Interest[]
  accommodation: AccommodationPreference
  transportation: TransportPreference
  notes: string | null
  /**
   * Real places and weather gathered before generation. Absent when the
   * providers are unconfigured or unreachable, in which case the planner
   * falls back to its example catalogue and says so.
   */
  sourced?: SourcedContext | null
}

export interface GeneratedActivity {
  timeSlot: TimeSlot
  title: string
  description: string
  locationName: string
  lat: number
  lng: number
  /** `HH:MM`, 24-hour. */
  startTime: string
  durationMinutes: number
  travelTimeMinutes: number
  walkingDistanceKm: number
  estimatedCost: number
  category: string
}

export interface GeneratedRestaurant {
  mealType: MealType
  name: string
  cuisine: string
  /**
   * Null for every provider today: no source here supplies an actual guest
   * rating, so there is nothing honest to put in this field yet. Kept
   * nullable rather than removed — a real reviews provider would populate it
   * without a contract change.
   */
  rating: number | null
  /**
   * 1–4 ("$" through "$$$$") when a real source gives one. Null today for
   * every provider, same reasoning as `rating` just above: nothing here
   * actually prices these venues, so a number would be exactly as invented
   * as a star rating would be — found during the Stage 1 provenance audit,
   * previously a `Math.random()`/seeded-RNG placeholder that looked real.
   */
  priceLevel: number | null
  distanceKm: number
  /**
   * The venue's real hours when a source gives them. Null today for every
   * provider: none supplies hours, and the per-meal windows generation used to
   * write here were shown as if they were the restaurant's own (see
   * `features/trips/services/restaurant-hours.ts`).
   */
  openingHours: string | null
  lat: number
  lng: number
}

export interface GeneratedWeather {
  /**
   * Where this reading came from — a real forecast provider, or the planner's
   * own climate model. Recorded per day rather than per itinerary because a
   * trip can straddle the forecast horizon and have both.
   */
  source: string
  condition: string
  /**
   * Null past the forecast horizon for a provider with no climate model of
   * its own to fall back on — matching `DayForecast` and `weatherByDate`,
   * which were already nullable here; a plain `number` would have forced a
   * value to be invented rather than admitted unknown.
   */
  tempHighC: number | null
  tempLowC: number | null
  precipitationChance: number | null
  windKph: number | null
  humidity: number | null
  /** `HH:MM`, 24-hour. Null under the same condition as the fields above. */
  sunrise: string | null
  sunset: string | null
}

export interface GeneratedDay {
  dayNumber: number
  /** ISO `YYYY-MM-DD`. */
  date: string
  summary: string
  estimatedCost: number
  activities: GeneratedActivity[]
  restaurants: GeneratedRestaurant[]
  weather: GeneratedWeather
}

export interface GeneratedHotel {
  /**
   * Where this stay came from — a places provider, or the planner's own
   * examples. A hotel is the one item that can carry a real business name
   * without a listing behind it, so the trip page needs to be able to say
   * which it is on every visit, not only in the notice shown at creation.
   */
  source: string
  name: string
  /**
   * Null for a stay taken from a real listing: the place data carries a point,
   * not a postal address, and naming a neighbourhood we haven't verified would
   * put a genuine business on the wrong street.
   */
  address: string | null
  checkInDate: string
  checkOutDate: string
  nights: number
  pricePerNight: number
  totalCost: number
  /**
   * Null for a real listing. The places provider ranks how well-known a place
   * is, which is not a guest score — rendering it as stars beside a real
   * hotel's name would be publishing a review nobody wrote.
   */
  rating: number | null
  amenities: string[]
  lat: number
  lng: number
  isPrimary: boolean
}

export interface GeneratedTransport {
  mode: TransportMode
  provider: string | null
  fromLocation: string
  toLocation: string
  durationMinutes: number
  cost: number
  notes: string | null
  /** Which day this leg belongs to, or null for trip-level legs. */
  dayNumber: number | null
}

export interface GeneratedBudgetLine {
  category: BudgetCategory
  plannedAmount: number
}

export interface GeneratedPackingItem {
  category: string
  item: string
}

export interface GeneratedItinerary {
  title: string
  summary: string
  days: GeneratedDay[]
  hotels: GeneratedHotel[]
  transportation: GeneratedTransport[]
  budget: GeneratedBudgetLine[]
  packing: GeneratedPackingItem[]
  /** Which provider produced this, for display and debugging. */
  providerId: string
  /** Non-fatal notes, e.g. "budget was tight, trimmed paid activities". */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Chat-based itinerary editing (Phase 9)
//
// A separate, smaller contract from the one above: this operates on an
// itinerary that already exists, one small edit at a time, rather than
// producing a whole trip. The same non-negotiable rule still applies —
// nothing here lets a provider state a fact about a venue it wasn't given.
// ---------------------------------------------------------------------------

/** What the model is shown about an already-scheduled activity — enough to
 * reason about it in prose. A move/remove references it by id; a genuinely
 * new venue's name/coordinates always come from a fresh `SourcedVenue`,
 * never from one of these. */
export interface ChatItineraryActivity {
  id: string
  dayNumber: number
  timeSlot: TimeSlot | null
  title: string
  locationName: string | null
  startTime: string | null
  durationMinutes: number | null
  estimatedCost: number | null
  category: string | null
}

export interface ChatItineraryRestaurant {
  id: string
  dayNumber: number
  mealType: MealType | null
  name: string
  cuisine: string | null
}

export interface ChatItineraryDay {
  dayNumber: number
  date: string | null
  summary: string | null
}

/** "Current itinerary state," handed to a provider as context. Built fresh on
 * every turn — never cached across turns, so a follow-up message always sees
 * whatever the previous turn actually wrote to the database. */
export interface ChatItinerarySnapshot {
  tripId: string
  destination: string
  currency: string
  days: ChatItineraryDay[]
  activities: ChatItineraryActivity[]
  restaurants: ChatItineraryRestaurant[]
}

/**
 * The closed set of edits a chat turn may propose. Already fully resolved
 * against real data by the time this leaves the AI layer — no synthetic
 * reference id from the model's own response ever crosses this boundary
 * (see `providers/chat-edit-shared.ts`'s resolution step). `label` on the
 * ones that target an existing item is a small deliberate denormalisation —
 * the display name, resolved once — so the review UI never needs a second
 * lookup to render "Remove: Old Town Walking Tour."
 */
export type ChatOperation =
  | {
      kind: "add_activity"
      dayNumber: number
      timeSlot: TimeSlot
      title: string
      description: string
      locationName: string
      lat: number
      lng: number
      /** Null when not asked for: the app places it within the slot. */
      startTime: string | null
      durationMinutes: number
      estimatedCost: number
      category: string
    }
  | { kind: "remove_activity"; activityId: string; label: string }
  | {
      kind: "move_activity"
      activityId: string
      label: string
      toDayNumber: number
      toTimeSlot: TimeSlot
      /** A time the traveller asked for; absent or null lets the app choose one inside the slot. */
      toStartTime?: string | null
    }
  | {
      kind: "add_restaurant"
      dayNumber: number
      mealType: MealType
      name: string
      cuisine: string
      lat: number
      lng: number
    }
  | { kind: "remove_restaurant"; restaurantId: string; label: string }
  | { kind: "reword_day_summary"; dayNumber: number; summary: string }

export interface ChatEditRequest {
  tripId: string
  message: string
  /** Recent turns, oldest first, excluding `message` itself. Folded into the
   * prompt as plain transcript text rather than a real multi-turn API
   * request — this app's structured-output integrations only ever send one
   * turn per call, and a short text-folded history is enough context for one
   * edit without new infrastructure in either integration. */
  history: { role: "user" | "assistant"; content: string }[]
  itinerary: ChatItinerarySnapshot
  /** Fresh candidates near the destination, same shape generation uses.
   * `weatherByDate` is always `{}` here — nothing about a single edit needs
   * weather, and reusing `SourcedContext` rather than a parallel type is what
   * lets `hasGroundingData`/`selectCandidates` work on it unmodified. Null
   * when no coordinate on the trip could be used to source fresh venues. */
  sourced: SourcedContext | null
}

export interface ChatEditResult {
  reply: string
  operations: ChatOperation[]
  providerId: string
  warnings: string[]
}
