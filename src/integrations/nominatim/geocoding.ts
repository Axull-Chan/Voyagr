import { CACHE_TTL, integrationCache } from "@/integrations/core/cache"
import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"
import { geocodingConfig } from "@/lib/config/providers"

/**
 * Nominatim geocoding — https://nominatim.org/release-docs/latest/api/Search/
 *
 * Chosen over Mapbox because it needs no key, no card, and — unlike Mapbox's
 * temporary-results term — its ODbL licence explicitly permits storing the
 * coordinates it returns, provided OpenStreetMap is credited. That is what
 * lets a trip keep its coordinates in the database rather than re-geocoding.
 *
 * The public instance is donated infrastructure with a usage policy this file
 * is written to respect, not merely acknowledge:
 *   - a User-Agent that identifies the application (requests without one are
 *     refused),
 *   - at most one request per second, enforced below rather than hoped for,
 *   - results cached so the same city is never asked for twice.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const PROVIDER = "nominatim"
// Endpoint, key, User-Agent and throttle come from geocodingConfig(): the
// public OpenStreetMap server by default, any Nominatim-compatible service if set.

/** Required by the usage policy; a generic agent gets blocked. */

/** The policy's hard limit. */

/** Credit that must appear wherever these coordinates are shown. */
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors"

interface NominatimPlace {
  lat?: string
  lon?: string
  display_name?: string
  name?: string
  addresstype?: string
  type?: string
  importance?: number
  boundingbox?: string[]
}

/**
 * Place types that can plausibly be a travel destination, best first.
 *
 * Free-text search ranks a well-known point of interest above the region a
 * user meant: "Northern Portugal" returned "Northern Orient Garden", a garden
 * in Madeira roughly 1,000km from the intended area. Asking for several
 * candidates and preferring administrative places over POIs fixes that
 * without hard-coding any destination.
 */
const DESTINATION_TYPE_RANK = [
  // Settlements first. Someone typing a place name into a trip planner almost
  // always means the city: ranking administrative areas higher resolved
  // "New York" to the state's centroid near Utica, 200km from the city.
  "city",
  "town",
  "municipality",
  "village",
  "island",
  // Broader areas next, for genuine region searches like "Tuscany", where no
  // settlement of that name competes.
  "region",
  "state",
  "province",
  "county",
  "country",
  // Natural features people genuinely travel to.
  "archipelago",
  "mountain_range",
  "peninsula",
  "national_park",
  "protected_area",
  "isle",
  // Sub-city areas last: a suburb is rarely the whole trip.
  "city_district",
  "suburb",
]

/** Ranking score, or -1 when the result is not a plausible destination. */
function destinationScore(place: NominatimPlace): number {
  const index = DESTINATION_TYPE_RANK.indexOf(place.addresstype ?? "")
  if (index === -1) return -1
  // Nominatim's own importance breaks ties within a tier.
  return (DESTINATION_TYPE_RANK.length - index) * 10 + (place.importance ?? 0)
}

/** Lowercased, de-accented, punctuation-free, for comparing names to queries. */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Whether a candidate is actually an answer to what was asked.
 *
 * Nominatim's results include loose fuzzy matches: searching "Bali" returns
 * Paris in fifth place. Type ranking alone then promoted Paris, because it is
 * a city with very high importance while Bali is tagged as a state — the
 * ranking was overriding a relevance ordering that had been correct. Requiring
 * the name to relate to the query keeps the ranking useful for genuine
 * ambiguity ("New York" the city vs the state) while discarding matches that
 * were never plausible.
 */
function matchesQuery(place: NominatimPlace, query: string): boolean {
  const name = normalise(place.name ?? "")
  const wanted = normalise(query)
  if (!name || !wanted) return false
  return name.includes(wanted) || wanted.includes(name)
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  /** Full human-readable place name, e.g. "Kyoto, Kyoto Prefecture, Japan". */
  displayName: string
  /** Short label, usually just the city. */
  name: string
  /** `[west, south, east, north]`, for fitting a map to the place. */
  boundingBox: [number, number, number, number] | null
  attribution: string
}

/**
 * Serialises outbound requests one second apart.
 *
 * A queue rather than a token bucket: the policy is a hard rate, and three
 * trips generating at once should wait their turn rather than burst and get
 * the whole app blocked. Every call chains onto the previous one's promise.
 */
let requestChain: Promise<unknown> = Promise.resolve()

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const result = await task()
    // Hold the chain open for the interval so the *next* caller waits. Only the
    // public server's policy needs this; a hosted service sets its own limits.
    const { minIntervalMs } = geocodingConfig()
    if (minIntervalMs > 0) await new Promise((resolve) => setTimeout(resolve, minIntervalMs))
    return result
  })
  // Keep the chain alive even if this task threw, or one failure would
  // permanently wedge every later request.
  requestChain = run.catch(() => undefined)
  return run
}

/**
 * Resolves a free-text place ("Kyoto", "Northern Portugal") to coordinates.
 *
 * Returns null when nothing matches, rather than throwing: an unrecognised
 * destination is a normal outcome the caller should degrade around, not an
 * error condition.
 */
export async function geocodePlace(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return null

  const key = `nominatim:${trimmed.toLowerCase()}`

  return integrationCache.getOrSet(key, CACHE_TTL.geocode, () =>
    schedule(async () => {
      const { searchUrl, apiKey, userAgent } = geocodingConfig()
      const url = buildUrl(searchUrl, {
        q: trimmed,
        format: "jsonv2",
        // Several candidates, then ranked below — asking for one lets a
        // popular POI outrank the region the user actually meant.
        limit: 5,
        addressdetails: 0,
        // Without this Nominatim answers in the local language, so "Kyoto"
        // comes back as "京都市" and lands in the UI untranslated.
        "accept-language": "en",
        // Hosted Nominatim services take their key as `key`; absent for the public server.
        key: apiKey,
      })

      const results = await fetchJson<NominatimPlace[]>(PROVIDER, url, {
        signal,
        headers: { "User-Agent": userAgent },
        // The public instance asks callers not to hammer it on failure.
        retries: 1,
      })

      if (!Array.isArray(results)) {
        throw new IntegrationError(
          PROVIDER,
          "invalid_response",
          "Geocoding response was not an array"
        )
      }

      const usable = results.filter(
        (place) => place.lat && place.lon && matchesQuery(place, trimmed)
      )
      if (usable.length === 0) return null

      const best = usable.reduce((winner, candidate) =>
        destinationScore(candidate) > destinationScore(winner) ? candidate : winner
      )

      // Nothing plausible: "Northern Portugal" matches only a flowerbed in
      // Madeira, ~1,000km from the region meant. Returning null lets the
      // caller say it couldn't find the place, which is far better than
      // silently planning weather and activities for the wrong coordinates.
      if (destinationScore(best) < 0) return null

      const latitude = Number.parseFloat(best.lat as string)
      const longitude = Number.parseFloat(best.lon as string)
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null

      return {
        latitude,
        longitude,
        displayName: best.display_name ?? trimmed,
        name: best.name ?? best.display_name?.split(",")[0]?.trim() ?? trimmed,
        boundingBox: parseBoundingBox(best.boundingbox),
        attribution: OSM_ATTRIBUTION,
      }
    })
  )
}

/**
 * Nominatim returns `[south, north, west, east]` as strings; MapLibre's
 * `fitBounds` wants `[west, south, east, north]` as numbers. Getting this
 * order wrong puts the map in the ocean, so it is converted once here.
 */
function parseBoundingBox(
  box: string[] | undefined
): [number, number, number, number] | null {
  if (!box || box.length !== 4) return null
  const [south, north, west, east] = box.map(Number)
  if ([south, north, west, east].some((n) => n === undefined || Number.isNaN(n))) {
    return null
  }
  return [west as number, south as number, east as number, north as number]
}
