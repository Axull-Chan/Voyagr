import { CACHE_TTL, integrationCache } from "@/integrations/core/cache"
import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"
import type { Interest } from "@/lib/trips/trip-domain"

/**
 * OpenTripMap — real places, sourced from OpenStreetMap and Wikidata.
 *
 * This is what lets the planner stop inventing restaurants and museums. Two
 * endpoints matter: a radius search returning lightweight summaries, and a
 * per-place detail lookup carrying the description, image and website.
 *
 * The category vocabulary below was established by asking the API rather than
 * reading docs — there is no endpoint listing valid kinds, and an invalid one
 * fails the whole request with `Unknown category name`. Notably `spa` is not
 * a category, which is exactly the sort of plausible guess that would have
 * broken the wellness interest in production.
 */

const PROVIDER = "opentripmap"
const BASE_URL = "https://api.opentripmap.com/0.1/en/places"

/** Verified against the live API; every entry returns 200. */
export const OTM_KINDS = {
  foods: "foods",
  restaurants: "restaurants",
  cafes: "cafes",
  museums: "museums",
  historic: "historic",
  historicArchitecture: "historic_architecture",
  natural: "natural",
  gardens: "gardens_and_parks",
  cultural: "cultural",
  architecture: "architecture",
  accommodations: "accomodations",
  shops: "shops",
  marketplaces: "marketplaces",
  theatres: "theatres_and_entertainments",
  beaches: "beaches",
  bars: "bars",
  nightclubs: "nightclubs",
  pubs: "pubs",
  sport: "sport",
  amusements: "amusements",
  religion: "religion",
  bridges: "bridges",
  interesting: "interesting_places",
} as const

/**
 * Maps the app's interest vocabulary onto real categories.
 *
 * `wellness` has no clean counterpart — OpenTripMap has no spa category — so
 * it borrows gardens and natural features, which is the honest approximation
 * rather than an invented one.
 */
export const INTEREST_TO_KINDS: Record<Interest, string[]> = {
  food: [OTM_KINDS.foods, OTM_KINDS.restaurants, OTM_KINDS.cafes],
  history: [OTM_KINDS.historic, OTM_KINDS.historicArchitecture],
  art: [OTM_KINDS.museums, OTM_KINDS.theatres],
  nature: [OTM_KINDS.natural, OTM_KINDS.gardens],
  nightlife: [OTM_KINDS.bars, OTM_KINDS.pubs, OTM_KINDS.nightclubs],
  shopping: [OTM_KINDS.shops, OTM_KINDS.marketplaces],
  adventure: [OTM_KINDS.sport, OTM_KINDS.amusements],
  architecture: [OTM_KINDS.architecture, OTM_KINDS.bridges],
  beaches: [OTM_KINDS.beaches],
  wellness: [OTM_KINDS.gardens, OTM_KINDS.natural],
}

interface RadiusRow {
  xid?: string
  name?: string
  dist?: number
  rate?: number | string
  kinds?: string
  point?: { lon?: number; lat?: number }
}

export interface PlaceSummary {
  xid: string
  name: string
  /** Metres from the search centre. */
  distanceM: number
  /** 0–7 significance. Higher is more notable. */
  rating: number
  kinds: string[]
  latitude: number
  longitude: number
}

export interface PlaceDetail extends PlaceSummary {
  description: string | null
  imageUrl: string | null
  websiteUrl: string | null
  wikipediaUrl: string | null
  /** City/country as OpenTripMap has them; often in the local language. */
  city: string | null
  country: string | null
}

/**
 * `rate` arrives as a number or as a string like `"3h"`, where the suffix
 * marks a UNESCO/heritage listing. `parseInt` keeps the numeric part; without
 * this the heritage sites — the most interesting ones — would score NaN and
 * sort last.
 */
function parseRate(rate: number | string | undefined): number {
  if (typeof rate === "number") return rate
  if (typeof rate === "string") {
    const parsed = Number.parseInt(rate, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function requireApiKey(): string {
  const key = process.env.OPENTRIPMAP_API_KEY
  if (!key) {
    throw new IntegrationError(
      PROVIDER,
      "not_configured",
      "OPENTRIPMAP_API_KEY is not set"
    )
  }
  return key
}

export interface SearchPlacesRequest {
  latitude: number
  longitude: number
  /** Metres. OpenTripMap caps this well above any sensible city radius. */
  radiusM?: number
  kinds: string[]
  limit?: number
  /** Drop places below this significance; 2 filters out most noise. */
  minRating?: number
  signal?: AbortSignal
}

/**
 * Places near a coordinate, most significant first.
 *
 * Results are cached per destination and category set: a trip fetches a
 * city's museums once, not once per render, which also keeps us comfortably
 * inside the free tier's daily allowance.
 */
export async function searchPlaces(
  request: SearchPlacesRequest
): Promise<PlaceSummary[]> {
  const {
    latitude,
    longitude,
    radiusM = 8_000,
    kinds,
    limit = 30,
    minRating = 2,
    signal,
  } = request

  if (kinds.length === 0) return []

  const apikey = requireApiKey()
  const kindList = [...kinds].sort().join(",")
  const key = `otm:radius:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${radiusM}:${kindList}:${limit}:${minRating}`

  return integrationCache.getOrSet(key, CACHE_TTL.places, async () => {
    const url = buildUrl(`${BASE_URL}/radius`, {
      lat: latitude,
      lon: longitude,
      radius: radiusM,
      kinds: kindList,
      limit,
      rate: minRating,
      format: "json",
      apikey,
    })

    const rows = await fetchJson<RadiusRow[]>(PROVIDER, url, { signal })
    if (!Array.isArray(rows)) {
      throw new IntegrationError(
        PROVIDER,
        "invalid_response",
        "Radius search did not return an array"
      )
    }

    return rows
      .filter(
        (row): row is RadiusRow & { xid: string; name: string } =>
          typeof row.xid === "string" &&
          typeof row.name === "string" &&
          // Unnamed OSM nodes are useless in an itinerary.
          row.name.trim().length > 0
      )
      .map((row) => ({
        xid: row.xid,
        name: row.name.trim(),
        distanceM: Math.round(row.dist ?? 0),
        rating: parseRate(row.rate),
        kinds: (row.kinds ?? "").split(",").filter(Boolean),
        latitude: row.point?.lat ?? latitude,
        longitude: row.point?.lon ?? longitude,
      }))
      .sort((a, b) => b.rating - a.rating || a.distanceM - b.distanceM)
  })
}

interface DetailResponse {
  xid?: string
  name?: string
  rate?: number | string
  kinds?: string
  point?: { lon?: number; lat?: number }
  address?: { city?: string; town?: string; village?: string; country?: string }
  preview?: { source?: string }
  wikipedia_extracts?: { text?: string }
  info?: { descr?: string } | null
  url?: string
  wikipedia?: string
}

/**
 * Full detail for one place.
 *
 * Returns null rather than throwing when a place has been removed upstream —
 * a stale xid is a normal outcome when OSM data shifts, not a failure worth
 * collapsing an itinerary over.
 */
export async function fetchPlaceDetail(
  xid: string,
  signal?: AbortSignal
): Promise<PlaceDetail | null> {
  const apikey = requireApiKey()
  const key = `otm:xid:${xid}`

  return integrationCache.getOrSet(key, CACHE_TTL.places, async () => {
    const url = buildUrl(`${BASE_URL}/xid/${encodeURIComponent(xid)}`, { apikey })

    let data: DetailResponse
    try {
      data = await fetchJson<DetailResponse>(PROVIDER, url, { signal })
    } catch (error) {
      if (error instanceof IntegrationError && error.status === 404) return null
      throw error
    }

    if (!data.name || !data.xid) return null

    const address = data.address ?? {}
    return {
      xid: data.xid,
      name: data.name.trim(),
      distanceM: 0,
      rating: parseRate(data.rate),
      kinds: (data.kinds ?? "").split(",").filter(Boolean),
      latitude: data.point?.lat ?? 0,
      longitude: data.point?.lon ?? 0,
      // Prefer the Wikipedia extract: it is written prose, whereas `info.descr`
      // is frequently empty or a bare category name.
      description:
        cleanText(data.wikipedia_extracts?.text) ??
        cleanText(data.info?.descr) ??
        null,
      imageUrl: data.preview?.source ?? null,
      websiteUrl: data.url ?? null,
      wikipediaUrl: data.wikipedia ?? null,
      city: address.city ?? address.town ?? address.village ?? null,
      country: address.country ?? null,
    }
  })
}

/** Trims and drops empty strings so callers only see usable prose or null. */
function cleanText(value: string | undefined | null): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

/** Whether the integration can run at all, for the fallback decision. */
export function isOpenTripMapConfigured(): boolean {
  return Boolean(process.env.OPENTRIPMAP_API_KEY)
}
