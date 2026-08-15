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
  /** 1–4, the conventional "$" through "$$$$". */
  priceLevel: number
  distanceKm: number
  openingHours: string
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
