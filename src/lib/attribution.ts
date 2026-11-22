import { INTERESTS } from "@/lib/trips/trip-domain"
import { OSM_CREDIT, type Credit } from "@/lib/config/providers"

/**
 * The credits a trip page owes, worked out from what the trip actually uses.
 *
 * Open-Meteo's data is CC BY 4.0 and OpenStreetMap's (behind OpenTripMap's
 * places, the geocoding and the map) is ODbL; both require visible credit where
 * the data is shown. Unsplash requires credit for its photo (the hero carries
 * the photographer; this line names the source).
 */

export const AI_NOTICE = "Planned with AI. Check opening hours, prices and bookings before you travel."

export const OPEN_METEO_CREDIT: Credit = { label: "Open-Meteo.com (CC BY 4.0)", href: "https://open-meteo.com/" }
export const OPENTRIPMAP_CREDIT: Credit = { label: "OpenTripMap", href: "https://opentripmap.io/" }
export const ODBL_OSM_CREDIT: Credit = { ...OSM_CREDIT, label: `${OSM_CREDIT.label} (ODbL)` }
export const UNSPLASH_CREDIT: Credit = { label: "Unsplash", href: "https://unsplash.com/?utm_source=voyagr&utm_medium=referral" }

export interface DataSourceGroup {
  /** "Weather", "Places", "Photo". */
  heading: string
  credits: Credit[]
}

/**
 * The example planner's activity categories are the app's own interest words
 * ("food", "history"); a real venue's is an OpenStreetMap kind ("museums",
 * "historic"). "beaches" and "architecture" are both, so an activity with only
 * those reads as an example: under-crediting there is the safer mistake than
 * claiming a source the trip may not use. A real stay settles it either way.
 */
const EXAMPLE_CATEGORIES: ReadonlySet<string> = new Set(INTERESTS.map((i) => i.value))

export function usesRealPlaces(
  activities: readonly { category: string | null }[],
  hotels: readonly { source: string | null }[]
): boolean {
  if (hotels.some((h) => h.source === "opentripmap")) return true
  return activities.some((a) => a.category !== null && a.category !== "" && !EXAMPLE_CATEGORIES.has(a.category))
}

export function dataSourceGroups(uses: { weather: boolean; places: boolean; photo: boolean }): DataSourceGroup[] {
  const groups: DataSourceGroup[] = []
  if (uses.weather) groups.push({ heading: "Weather", credits: [OPEN_METEO_CREDIT] })
  if (uses.places) groups.push({ heading: "Places", credits: [OPENTRIPMAP_CREDIT, ODBL_OSM_CREDIT] })
  if (uses.photo) groups.push({ heading: "Photo", credits: [UNSPLASH_CREDIT] })
  return groups
}
