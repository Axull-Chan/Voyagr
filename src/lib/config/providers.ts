/**
 * Where each external provider lives, and how to talk to it — read from the
 * environment in one place, with the free, keyless defaults the app has always
 * used when nothing is set.
 *
 * Every function takes the environment as an argument (defaulting to
 * `process.env`) so tests can pass a plain object. Anything unusable — a
 * malformed URL, a model id with odd characters — falls back to the default
 * rather than failing: a typo in a setting should cost a commercial feature,
 * never the app.
 *
 * Commercial overrides, all optional:
 *  - OPEN_METEO_API_KEY   -> customer-api.open-meteo.com with `&apikey=`
 *  - OPEN_METEO_BASE_URL  -> any Open-Meteo-compatible host (wins over the above)
 *  - GEOCODING_BASE_URL   -> any Nominatim-compatible search endpoint
 *  - GEOCODING_API_KEY    -> sent as `?key=` (hosted Nominatim services)
 *  - GEOCODING_CONTACT    -> email or URL added to the User-Agent
 *  - OPENTRIPMAP_BASE_URL, FRANKFURTER_BASE_URL
 *  - NEXT_PUBLIC_MAP_STYLE_URL, NEXT_PUBLIC_MAP_ATTRIBUTION (browser-side map)
 *  - GEMINI_MODEL, GEMINI_FALLBACK_MODEL
 *  - LITEAPI_API_KEY, BOOKING_MODE (hotel booking; sandbox only for now)
 */

export type Env = Record<string, string | undefined>

/** A trimmed, non-empty value, or null. */
function setting(env: Env, name: string): string | null {
  const value = env[name]?.trim()
  return value ? value : null
}

/** An absolute http(s) URL with no trailing slash, or null if unusable. */
export function usableUrl(raw: string | null): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (url.username || url.password) return null
    return url.toString().replace(/\/+$/, "")
  } catch {
    return null
  }
}

/** Free text safe to put in an HTTP header: printable ASCII, no CR/LF, capped. */
function headerSafe(raw: string | null, max = 200): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\x20-\x7e]/g, "").replace(/[()]/g, "").trim().slice(0, max)
  return cleaned || null
}

/** Text for display: any characters (©, accents) but no control characters, capped. */
function displaySafe(raw: string | null, max = 160): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\p{Cc}/gu, "").trim().slice(0, max)
  return cleaned || null
}

// ---------------------------------------------------------------------------
// Weather — Open-Meteo
// ---------------------------------------------------------------------------

export const OPEN_METEO_FREE_HOST = "https://api.open-meteo.com"
export const OPEN_METEO_CUSTOMER_HOST = "https://customer-api.open-meteo.com"

export interface OpenMeteoConfig {
  forecastUrl: string
  /** Sent as the `apikey` query parameter when set. */
  apiKey: string | null
}

/**
 * The free API is for non-commercial use. A paid plan uses the customer host
 * plus an `apikey` parameter; `OPEN_METEO_BASE_URL` overrides the host either
 * way (e.g. a self-hosted instance).
 */
export function openMeteoConfig(env: Env = process.env): OpenMeteoConfig {
  const apiKey = setting(env, "OPEN_METEO_API_KEY")
  const host =
    usableUrl(setting(env, "OPEN_METEO_BASE_URL")) ?? (apiKey ? OPEN_METEO_CUSTOMER_HOST : OPEN_METEO_FREE_HOST)
  return { forecastUrl: `${host}/v1/forecast`, apiKey }
}

// ---------------------------------------------------------------------------
// Geocoding — Nominatim or a compatible service
// ---------------------------------------------------------------------------

export const PUBLIC_NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
const PUBLIC_NOMINATIM_HOST = "nominatim.openstreetmap.org"
/** The public instance's usage policy: at most one request per second. */
export const PUBLIC_NOMINATIM_MIN_INTERVAL_MS = 1_100
export const APP_USER_AGENT_BASE = "Voyagr/1.0 (AI travel planner"

export interface GeocodingConfig {
  searchUrl: string
  /** Sent as the `key` query parameter when set. */
  apiKey: string | null
  userAgent: string
  /** Throttle between requests; only the public OpenStreetMap server needs one. */
  minIntervalMs: number
}

/**
 * `GEOCODING_BASE_URL` may be a host ("https://nominatim.example.org", then
 * `/search` is added) or a full search endpoint ("https://…/v1/search", used
 * as given). The User-Agent always identifies the app, and carries
 * `GEOCODING_CONTACT` when set, as Nominatim's usage policy asks.
 */
export function geocodingConfig(env: Env = process.env): GeocodingConfig {
  const base = usableUrl(setting(env, "GEOCODING_BASE_URL"))
  let searchUrl = PUBLIC_NOMINATIM_SEARCH
  if (base) {
    const url = new URL(base)
    searchUrl = url.pathname === "/" || url.pathname === "" ? `${base}/search` : base
  }
  const contact = headerSafe(setting(env, "GEOCODING_CONTACT"))
  return {
    searchUrl,
    apiKey: setting(env, "GEOCODING_API_KEY"),
    userAgent: `${APP_USER_AGENT_BASE}${contact ? `; ${contact}` : ""})`,
    minIntervalMs: new URL(searchUrl).host === PUBLIC_NOMINATIM_HOST ? PUBLIC_NOMINATIM_MIN_INTERVAL_MS : 0,
  }
}

// ---------------------------------------------------------------------------
// Places, currency
// ---------------------------------------------------------------------------

export const OPENTRIPMAP_DEFAULT_BASE = "https://api.opentripmap.com/0.1/en/places"
export const FRANKFURTER_DEFAULT_BASE = "https://api.frankfurter.dev/v2"

/** A paid OpenTripMap plan uses the same API with its own key; this is for a mirror or proxy. */
export function openTripMapBaseUrl(env: Env = process.env): string {
  return usableUrl(setting(env, "OPENTRIPMAP_BASE_URL")) ?? OPENTRIPMAP_DEFAULT_BASE
}

/** Frankfurter is free and can be self-hosted; this points at your own instance. */
export function frankfurterBaseUrl(env: Env = process.env): string {
  return usableUrl(setting(env, "FRANKFURTER_BASE_URL")) ?? FRANKFURTER_DEFAULT_BASE
}

// ---------------------------------------------------------------------------
// Map tiles (browser-side)
// ---------------------------------------------------------------------------

export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"

export interface Credit {
  label: string
  href: string | null
}

/** Always shown: the places, geocoding and map data are OpenStreetMap-derived (ODbL). */
export const OSM_CREDIT: Credit = {
  label: "© OpenStreetMap contributors",
  href: "https://www.openstreetmap.org/copyright",
}

const DEFAULT_TILE_CREDITS: Credit[] = [
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
  { label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" },
]

export interface MapStyleConfig {
  styleUrl: string
  credits: Credit[]
}

/**
 * The map's style and the credit line beneath it. A custom tile provider needs
 * its own credit, given as plain text in `NEXT_PUBLIC_MAP_ATTRIBUTION`; the
 * OpenStreetMap credit stays regardless. Callers must pass the two
 * NEXT_PUBLIC_ values explicitly (`process.env.NEXT_PUBLIC_…` written out), or
 * Next.js can't inline them into the browser bundle.
 */
export function mapStyleConfig(env: Env): MapStyleConfig {
  const custom = usableUrl(setting(env, "NEXT_PUBLIC_MAP_STYLE_URL"))
  const customCredit = displaySafe(setting(env, "NEXT_PUBLIC_MAP_ATTRIBUTION"))
  if (!custom) return { styleUrl: DEFAULT_MAP_STYLE_URL, credits: [OSM_CREDIT, ...DEFAULT_TILE_CREDITS] }
  return {
    styleUrl: custom,
    credits: [OSM_CREDIT, ...(customCredit ? [{ label: customCredit, href: null }] : [])],
  }
}

// ---------------------------------------------------------------------------
// Gemini model
// ---------------------------------------------------------------------------

/** A stable, generally available model, not a preview tag that can change or vanish. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{1,63}$/

export interface GeminiModels {
  primary: string
  /** Tried once if the primary times out or is unavailable; null when unset, invalid or the same. */
  fallback: string | null
}

export function geminiModels(env: Env = process.env): GeminiModels {
  const valid = (name: string) => {
    const value = setting(env, name)
    return value && MODEL_ID.test(value) ? value : null
  }
  const primary = valid("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL
  const fallback = valid("GEMINI_FALLBACK_MODEL")
  return { primary, fallback: fallback && fallback !== primary ? fallback : null }
}

// ---------------------------------------------------------------------------
// Hotel booking — LiteAPI (Nuitee Connect)
// ---------------------------------------------------------------------------

/** Hotel data and rate search. */
export const LITEAPI_DATA_BASE = "https://api.liteapi.travel/v3.0"
/** Prebook, book, booking lookup and cancel. */
export const LITEAPI_BOOK_BASE = "https://book.liteapi.travel/v3.0"
/** LiteAPI sandbox keys start with this; production keys don't. */
export const LITEAPI_SANDBOX_KEY_PREFIX = "sand_"

export type BookingMode = "sandbox"

export type BookingConfig =
  | { enabled: true; mode: BookingMode; apiKey: string; dataBase: string; bookBase: string }
  | { enabled: false; reason: string }

/**
 * Whether hotel booking can run, and against what. Sandbox is the only mode
 * this build allows: `BOOKING_MODE=live` is refused outright rather than
 * quietly falling back, and the key must look like a sandbox key, so a
 * production key pasted into the wrong variable can never place a real,
 * charged booking. Going live is a deliberate code change, not a setting.
 */
export function bookingConfig(env: Env = process.env): BookingConfig {
  const mode = setting(env, "BOOKING_MODE") ?? "sandbox"
  if (mode !== "sandbox") {
    return { enabled: false, reason: `BOOKING_MODE=${mode} is not supported; only sandbox booking is enabled.` }
  }
  const apiKey = setting(env, "LITEAPI_API_KEY")
  if (!apiKey) return { enabled: false, reason: "LITEAPI_API_KEY is not set." }
  if (!apiKey.startsWith(LITEAPI_SANDBOX_KEY_PREFIX)) {
    return { enabled: false, reason: "LITEAPI_API_KEY is not a sandbox key (expected the sand_ prefix)." }
  }
  return { enabled: true, mode: "sandbox", apiKey, dataBase: LITEAPI_DATA_BASE, bookBase: LITEAPI_BOOK_BASE }
}
