import { addDays, tripDurationDays } from "@/lib/trips/trip-domain"

/**
 * The dashboard's choices, as pure functions so they can be tested: which trip
 * leads, which trips fill the grid without repeating it, the overview figures,
 * and whether a forecast can exist yet.
 */

export interface DashboardTrip {
  id: string
  destination: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

/** How many trips the "Your trips" grid shows beside the hero. */
export const YOUR_TRIPS_LIMIT = 3

/**
 * The hero is the nearest trip that hasn't started yet. The grid is up to
 * three *other* trips — never the hero again (the "same information in two
 * places" anti-pattern that removed the old recents grid) — upcoming ones
 * first by departure, then the rest newest-created first.
 */
export function pickDashboardTrips<T extends DashboardTrip>(
  trips: readonly T[],
  today: string
): { nextTrip: T | null; upcoming: T[]; yourTrips: T[] } {
  const upcoming = trips
    .filter((trip) => trip.start_date !== null && trip.start_date >= today)
    .sort((a, b) => (a.start_date as string).localeCompare(b.start_date as string) || a.id.localeCompare(b.id))
  const nextTrip = upcoming[0] ?? null

  const upcomingIds = new Set(upcoming.map((trip) => trip.id))
  const rest = trips
    .filter((trip) => !upcomingIds.has(trip.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))

  const yourTrips = [...upcoming, ...rest]
    .filter((trip) => trip.id !== nextTrip?.id)
    .slice(0, YOUR_TRIPS_LIMIT)

  return { nextTrip, upcoming, yourTrips }
}

export interface DashboardStat {
  label: string
  value: number
}

export function dashboardStats(trips: readonly DashboardTrip[], upcomingCount: number): DashboardStat[] {
  const destinations = new Set(trips.map((trip) => trip.destination.trim().toLowerCase())).size
  const days = trips.reduce((sum, trip) => {
    if (!trip.start_date || !trip.end_date) return sum
    return sum + Math.max(0, tripDurationDays(trip.start_date, trip.end_date))
  }, 0)
  return [
    { label: "Trips", value: trips.length },
    { label: "Upcoming", value: upcomingCount },
    { label: "Destinations", value: destinations },
    { label: "Days planned", value: days },
  ]
}

/**
 * Whether the trip's first day can have a forecast yet. Open-Meteo serves
 * `forecastDays` days ahead and refuses anything further, so a trip that
 * starts later gets the date a forecast becomes available instead — worked
 * out here, with no request.
 */
export type ForecastWindow =
  | { kind: "available" }
  | { kind: "later"; availableFrom: string }
  | { kind: "none" }

export function forecastWindow(
  startDate: string | null,
  today: string,
  forecastDays: number
): ForecastWindow {
  if (!startDate || startDate < today) return { kind: "none" }
  const availableFrom = addDays(startDate, -forecastDays)
  return availableFrom <= today ? { kind: "available" } : { kind: "later", availableFrom }
}
