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
  rating: number
  /** 1–4, the conventional "$" through "$$$$". */
  priceLevel: number
  distanceKm: number
  openingHours: string
  lat: number
  lng: number
}

export interface GeneratedWeather {
  condition: string
  tempHighC: number
  tempLowC: number
  precipitationChance: number
  windKph: number
  humidity: number
  /** `HH:MM`, 24-hour. */
  sunrise: string
  sunset: string
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
  name: string
  address: string
  checkInDate: string
  checkOutDate: string
  nights: number
  pricePerNight: number
  totalCost: number
  rating: number
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
