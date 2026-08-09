import { CACHE_TTL, integrationCache } from "@/integrations/core/cache"
import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"

/**
 * Unsplash destination imagery.
 *
 * Their API guidelines are licence terms, not suggestions, and three of them
 * shape this file:
 *   1. Photos must be *hotlinked* from the returned URLs, never downloaded and
 *      re-served — so we persist the URL and photographer, never the file.
 *   2. Every photo must credit the photographer and Unsplash, with links
 *      carrying `utm_source`/`utm_medium`. `attribution` below is built ready
 *      for the UI to render.
 *   3. The download endpoint must be pinged when a photo is actually *used*.
 *      That is `trackDownload`, called once when a trip adopts an image.
 *
 * The Access Key is server-side only: it never reaches the browser, so every
 * caller here must be a Server Component or server action.
 * https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
 */

const PROVIDER = "unsplash"
const BASE_URL = "https://api.unsplash.com"

/** Identifies this app in the referral links Unsplash requires. */
const UTM_SOURCE = "voyagr"

interface UnsplashUser {
  name?: string
  username?: string
  links?: { html?: string }
}

interface UnsplashPhoto {
  id?: string
  alt_description?: string | null
  blur_hash?: string | null
  width?: number
  height?: number
  urls?: { raw?: string; full?: string; regular?: string; small?: string }
  links?: { html?: string; download_location?: string }
  user?: UnsplashUser
}

interface SearchResponse {
  results?: UnsplashPhoto[]
}

export interface DestinationImage {
  id: string
  /** Hotlink these; do not download and re-host. */
  url: string
  thumbUrl: string
  /** Suitable as alt text; Unsplash's own description of the photo. */
  alt: string
  width: number
  height: number
  /** Compact hash for a blurred placeholder, avoiding layout shift. */
  blurHash: string | null
  attribution: {
    photographerName: string
    photographerUrl: string
    photoUrl: string
  }
  /** Ping via `trackDownload` when the image is actually adopted. */
  downloadLocation: string | null
}

function requireAccessKey(): string {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) {
    throw new IntegrationError(
      PROVIDER,
      "not_configured",
      "UNSPLASH_ACCESS_KEY is not set"
    )
  }
  return key
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Client-ID ${requireAccessKey()}`,
    // Pinning the version protects against a future breaking change.
    "Accept-Version": "v1",
  }
}

/** Appends the referral parameters Unsplash requires on credit links. */
function withUtm(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.set("utm_source", UTM_SOURCE)
  parsed.searchParams.set("utm_medium", "referral")
  return parsed.toString()
}

function toDestinationImage(photo: UnsplashPhoto): DestinationImage | null {
  const url = photo.urls?.regular
  const id = photo.id
  if (!url || !id) return null

  const user = photo.user ?? {}
  return {
    id,
    url,
    thumbUrl: photo.urls?.small ?? url,
    alt: photo.alt_description?.trim() || "Destination photograph",
    width: photo.width ?? 0,
    height: photo.height ?? 0,
    blurHash: photo.blur_hash ?? null,
    attribution: {
      photographerName: user.name ?? "Unknown photographer",
      photographerUrl: withUtm(
        user.links?.html ??
          `https://unsplash.com/@${user.username ?? ""}`
      ),
      photoUrl: withUtm(photo.links?.html ?? `https://unsplash.com/photos/${id}`),
    },
    downloadLocation: photo.links?.download_location ?? null,
  }
}

/**
 * Best landscape photo for a destination.
 *
 * Cached hard: the free tier allows 50 requests an hour, so a destination is
 * looked up once and reused rather than fetched per render. Returns null when
 * nothing matches, which the caller shows as a plain gradient instead.
 */
export async function findDestinationImage(
  destination: string,
  signal?: AbortSignal
): Promise<DestinationImage | null> {
  const query = destination.trim()
  if (query.length < 2) return null

  const key = `unsplash:${query.toLowerCase()}`

  return integrationCache.getOrSet(key, CACHE_TTL.images, async () => {
    const url = buildUrl(`${BASE_URL}/search/photos`, {
      query,
      per_page: 1,
      orientation: "landscape",
      // Bias away from stock-looking crowds towards places.
      content_filter: "high",
    })

    const data = await fetchJson<SearchResponse>(PROVIDER, url, {
      signal,
      headers: authHeaders(),
      // The hourly allowance is small; hammering it on failure would spend it.
      retries: 1,
    })

    const first = data.results?.[0]
    if (!first) return null
    return toDestinationImage(first)
  })
}

/**
 * Tells Unsplash a photo was used, as their guidelines require.
 *
 * Deliberately best-effort: this is a courtesy ping, and a trip should never
 * fail to save because an analytics call did. It also does not count against
 * the hourly rate limit.
 */
export async function trackDownload(
  downloadLocation: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    await fetchJson<unknown>(PROVIDER, downloadLocation, {
      signal,
      headers: authHeaders(),
      retries: 0,
      timeoutMs: 4_000,
    })
  } catch {
    // Swallowed on purpose — see above.
  }
}

/** Whether the integration can run at all, for the fallback decision. */
export function isUnsplashConfigured(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY)
}
