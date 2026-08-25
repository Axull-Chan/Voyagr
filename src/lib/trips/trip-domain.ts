/**
 * The shared vocabulary of a trip.
 *
 * This lives in `lib` rather than in `features/trips` on purpose: both the
 * creation wizard (a feature) and the AI layer (a service) need to agree on
 * what a "travel style" is, and neither should have to import the other to
 * find out. Everything here is plain data — no React, no Supabase — so it is
 * safe to use from a Server Component, a Client Component, or a provider
 * running on the server.
 */

export const TRAVEL_STYLES = [
  { value: "relaxed", label: "Relaxed", hint: "Slow mornings, few fixed plans" },
  { value: "balanced", label: "Balanced", hint: "A couple of anchors each day" },
  { value: "packed", label: "Packed", hint: "See as much as possible" },
  { value: "luxury", label: "Luxury", hint: "Comfort and standout experiences" },
  { value: "budget", label: "Budget", hint: "Stretch every unit of currency" },
] as const

export const INTERESTS = [
  { value: "food", label: "Food & drink" },
  { value: "history", label: "History" },
  { value: "art", label: "Art & museums" },
  { value: "nature", label: "Nature" },
  { value: "nightlife", label: "Nightlife" },
  { value: "shopping", label: "Shopping" },
  { value: "adventure", label: "Adventure" },
  { value: "architecture", label: "Architecture" },
  { value: "beaches", label: "Beaches" },
  { value: "wellness", label: "Wellness" },
] as const

export const ACCOMMODATION_PREFERENCES = [
  { value: "hotel", label: "Hotel" },
  { value: "boutique", label: "Boutique stay" },
  { value: "apartment", label: "Apartment" },
  { value: "hostel", label: "Hostel" },
  { value: "resort", label: "Resort" },
] as const

export const TRANSPORT_PREFERENCES = [
  { value: "walk", label: "Mostly walking" },
  { value: "public", label: "Public transport" },
  { value: "rideshare", label: "Taxis & rideshare" },
  { value: "car", label: "Rental car" },
  { value: "mixed", label: "A mix" },
] as const

/**
 * Deliberately a short list of majors rather than every ISO 4217 code — a
 * 180-entry dropdown is worse UX than five, and the column is free text so
 * this can grow without a migration.
 */
export const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar", symbol: "$" },
  { value: "EUR", label: "EUR — Euro", symbol: "€" },
  { value: "GBP", label: "GBP — British Pound", symbol: "£" },
  { value: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { value: "AUD", label: "AUD — Australian Dollar", symbol: "A$" },
  { value: "CAD", label: "CAD — Canadian Dollar", symbol: "C$" },
  { value: "SGD", label: "SGD — Singapore Dollar", symbol: "S$" },
  { value: "IDR", label: "IDR — Indonesian Rupiah", symbol: "Rp" },
] as const

export type TravelStyle = (typeof TRAVEL_STYLES)[number]["value"]
export type Interest = (typeof INTERESTS)[number]["value"]
export type AccommodationPreference =
  (typeof ACCOMMODATION_PREFERENCES)[number]["value"]
export type TransportPreference = (typeof TRANSPORT_PREFERENCES)[number]["value"]
export type CurrencyCode = (typeof CURRENCIES)[number]["value"]

export const TRAVEL_STYLE_VALUES = TRAVEL_STYLES.map((s) => s.value)
export const INTEREST_VALUES = INTERESTS.map((i) => i.value)
export const ACCOMMODATION_VALUES = ACCOMMODATION_PREFERENCES.map((a) => a.value)
export const TRANSPORT_VALUES = TRANSPORT_PREFERENCES.map((t) => t.value)
export const CURRENCY_VALUES = CURRENCIES.map((c) => c.value)

/** Budget categories mirror the `budget_breakdown.category` check constraint. */
export const BUDGET_CATEGORIES = [
  { value: "hotels", label: "Accommodation" },
  { value: "transportation", label: "Transport" },
  { value: "food", label: "Food & drink" },
  { value: "activities", label: "Activities" },
  { value: "shopping", label: "Shopping" },
  { value: "emergency_fund", label: "Buffer" },
] as const

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]["value"]
export const BUDGET_CATEGORY_VALUES = BUDGET_CATEGORIES.map((c) => c.value)

/** Time slots mirror the `activities.time_slot` check constraint. */
export const TIME_SLOTS = ["morning", "afternoon", "evening"] as const
export type TimeSlot = (typeof TIME_SLOTS)[number]

/** Meal types mirror the `restaurants.meal_type` check constraint. */
export const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const
export type MealType = (typeof MEAL_TYPES)[number]

/** Transport modes mirror the `transportation.mode` check constraint. */
export const TRANSPORT_MODES = [
  "flight",
  "train",
  "bus",
  "car",
  "ferry",
  "metro",
  "walk",
  "rideshare",
] as const
export type TransportMode = (typeof TRANSPORT_MODES)[number]

/** Maximum days a single trip can span, enforced by the wizard schema. */
export const MAX_TRIP_DAYS = 30

const MS_PER_DAY = 86_400_000

/**
 * Whole days between two ISO dates, inclusive of both ends — a trip from the
 * 1st to the 3rd is three days, not two. Parsed as UTC so a traveller in a
 * negative-offset timezone doesn't silently lose the first day.
 */
export function tripDurationDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  return Math.round((end - start) / MS_PER_DAY) + 1
}

/** ISO date `offset` days after `startDate`, kept in UTC for the same reason. */
export function addDays(startDate: string, offset: number): string {
  const base = Date.parse(`${startDate}T00:00:00Z`)
  if (Number.isNaN(base)) return startDate
  return new Date(base + offset * MS_PER_DAY).toISOString().slice(0, 10)
}

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.value === code)?.symbol ?? ""
}

/**
 * Formats money for display. Falls back to the raw code when Intl doesn't
 * recognise it, which keeps this safe if the column ever holds something
 * outside the curated list above.
 */
export function formatCurrency(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currencySymbol(code)}${Math.round(amount).toLocaleString()}`
  }
}

/**
 * Whole days until departure; negative once the trip has started.
 *
 * Shared by the trip hero and the trip card so a trip can never be described
 * as leaving "Tomorrow" in one place and something else in another.
 */
export function daysUntil(startDate: string | null): number | null {
  if (!startDate) return null
  const start = Date.parse(`${startDate}T00:00:00Z`)
  if (Number.isNaN(start)) return null
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((start - today) / 86_400_000)
}

export function countdownLabel(days: number | null): string | null {
  if (days === null) return null
  if (days > 1) return `In ${days} days`
  if (days === 1) return "Tomorrow"
  if (days === 0) return "Today"
  return "Past trip"
}

/**
 * Gold escalates as the trip nears — quiet for "In N days", bold for
 * Tomorrow/Today. A past trip deliberately gets neither: gold reads as
 * *imminent*, which a finished trip is the opposite of.
 */
export function countdownVariant(
  days: number | null
): "countdown" | "countdown-urgent" | "secondary" {
  if (days === null || days < 0) return "secondary"
  return days <= 1 ? "countdown-urgent" : "countdown"
}
