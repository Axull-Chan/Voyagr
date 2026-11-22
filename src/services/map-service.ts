import { geocodePlace, OSM_ATTRIBUTION } from "@/integrations/nominatim/geocoding"
import { attempt, live, unavailable, type ServiceResult } from "@/services/service-result"
import { mapStyleConfig, type Credit } from "@/lib/config/providers"

/**
 * Map and geocoding concerns for the app.
 *
 * The tile style and attribution live here rather than in the map component
 * so that switching tile hosts — the likeliest change, since OpenFreeMap is
 * community-run with no SLA — touches one file and no UI.
 */

// The NEXT_PUBLIC_ values are written out so Next.js inlines them into the
// browser bundle; reading `process.env` generically would leave them undefined.
const mapStyle = mapStyleConfig({
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
})

/** OpenFreeMap's Liberty style by default (no key, no account), or NEXT_PUBLIC_MAP_STYLE_URL. */
export const MAP_STYLE_URL = mapStyle.styleUrl

/**
 * The credit line under the map: OpenStreetMap (ODbL; the tiles, the geocoding
 * and the places all derive from it) plus the tile provider, each linked.
 */
export const MAP_CREDITS: Credit[] = mapStyle.credits

/** Plain-text OpenStreetMap credit, for places that can't render links. */
export const MAP_ATTRIBUTION = OSM_ATTRIBUTION

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface GeocodedDestination extends Coordinates {
  /** Short English label, e.g. "Kyoto". */
  name: string
  /** Full label, e.g. "Kyoto, Kyoto Prefecture, Japan". */
  displayName: string
  /** `[west, south, east, north]`, for fitting the map to the place. */
  boundingBox: [number, number, number, number] | null
}

/**
 * Resolves a destination to coordinates.
 *
 * Returns `data: null` rather than guessing when the place can't be found:
 * planning weather and activities around the wrong coordinates is worse than
 * telling the user we didn't recognise the destination.
 */
export async function geocodeDestination(
  destination: string
): Promise<ServiceResult<GeocodedDestination | null>> {
  return attempt("Location lookup", null, async () => {
    const result = await geocodePlace(destination)
    if (!result) {
      return unavailable(
        null,
        `We couldn't find "${destination}" on the map. Try a nearby city.`
      )
    }
    return live({
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      displayName: result.displayName,
      boundingBox: result.boundingBox,
    })
  })
}

/** A pin on the trip map. `kind` drives the marker colour and icon. */
export interface MapMarker {
  id: string
  kind: "destination" | "hotel" | "restaurant" | "activity"
  name: string
  latitude: number
  longitude: number
  /** Secondary line in the popup, e.g. a time or cuisine. */
  detail?: string
}

/**
 * The smallest box containing every marker, padded slightly.
 *
 * Returned rather than computed in the component so the map has no geometry
 * logic of its own, and so an empty marker list has one obvious answer.
 */
export function boundsForMarkers(
  markers: MapMarker[]
): [number, number, number, number] | null {
  if (markers.length === 0) return null

  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY

  for (const marker of markers) {
    west = Math.min(west, marker.longitude)
    east = Math.max(east, marker.longitude)
    south = Math.min(south, marker.latitude)
    north = Math.max(north, marker.latitude)
  }

  // A single marker produces a zero-area box, which fitBounds cannot zoom to.
  const pad = 0.01
  return [west - pad, south - pad, east + pad, north + pad]
}
