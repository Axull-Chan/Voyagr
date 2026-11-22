import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MAP_STYLE_URL,
  FRANKFURTER_DEFAULT_BASE,
  OPENTRIPMAP_DEFAULT_BASE,
  PUBLIC_NOMINATIM_MIN_INTERVAL_MS,
  PUBLIC_NOMINATIM_SEARCH,
  frankfurterBaseUrl,
  geminiModels,
  geocodingConfig,
  mapStyleConfig,
  openMeteoConfig,
  openTripMapBaseUrl,
  usableUrl,
} from "@/lib/config/providers"
import { fetchDailyForecast } from "@/integrations/openmeteo/weather"
import { geocodePlace } from "@/integrations/nominatim/geocoding"
import { createStructuredResponse } from "@/integrations/gemini/generate"

describe("zero configuration keeps the free defaults", () => {
  it("uses every free, keyless endpoint", () => {
    expect(openMeteoConfig({})).toEqual({ forecastUrl: "https://api.open-meteo.com/v1/forecast", apiKey: null })
    expect(geocodingConfig({})).toEqual({
      searchUrl: PUBLIC_NOMINATIM_SEARCH,
      apiKey: null,
      userAgent: "Voyagr/1.0 (AI travel planner)",
      minIntervalMs: PUBLIC_NOMINATIM_MIN_INTERVAL_MS,
    })
    expect(openTripMapBaseUrl({})).toBe(OPENTRIPMAP_DEFAULT_BASE)
    expect(frankfurterBaseUrl({})).toBe(FRANKFURTER_DEFAULT_BASE)
    expect(mapStyleConfig({}).styleUrl).toBe(DEFAULT_MAP_STYLE_URL)
    expect(geminiModels({})).toEqual({ primary: DEFAULT_GEMINI_MODEL, fallback: null })
  })

  it("defaults to a stable GA Gemini model, not a preview tag", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.8-flash")
    expect(DEFAULT_GEMINI_MODEL).not.toMatch(/preview|exp/)
  })
})

describe("Open-Meteo", () => {
  it("moves to the customer host with a key", () => {
    expect(openMeteoConfig({ OPEN_METEO_API_KEY: "  k-123  " })).toEqual({
      forecastUrl: "https://customer-api.open-meteo.com/v1/forecast",
      apiKey: "k-123",
    })
  })

  it("lets an explicit host win, with or without a key", () => {
    expect(openMeteoConfig({ OPEN_METEO_BASE_URL: "https://weather.internal/" }).forecastUrl).toBe(
      "https://weather.internal/v1/forecast"
    )
    expect(openMeteoConfig({ OPEN_METEO_BASE_URL: "https://weather.internal", OPEN_METEO_API_KEY: "k" })).toEqual({
      forecastUrl: "https://weather.internal/v1/forecast",
      apiKey: "k",
    })
  })

  it("ignores an unusable host", () => {
    expect(openMeteoConfig({ OPEN_METEO_BASE_URL: "not a url" }).forecastUrl).toBe("https://api.open-meteo.com/v1/forecast")
  })
})

describe("geocoding", () => {
  it("adds /search to a bare host and keeps a full endpoint as given", () => {
    expect(geocodingConfig({ GEOCODING_BASE_URL: "https://nominatim.example.com" }).searchUrl).toBe(
      "https://nominatim.example.com/search"
    )
    expect(geocodingConfig({ GEOCODING_BASE_URL: "https://us1.example.com/v1/search" }).searchUrl).toBe(
      "https://us1.example.com/v1/search"
    )
  })

  it("throttles only the public OpenStreetMap server", () => {
    expect(geocodingConfig({}).minIntervalMs).toBe(PUBLIC_NOMINATIM_MIN_INTERVAL_MS)
    expect(geocodingConfig({ GEOCODING_BASE_URL: "https://nominatim.example.com" }).minIntervalMs).toBe(0)
    expect(geocodingConfig({ GEOCODING_BASE_URL: "https://nominatim.openstreetmap.org" }).minIntervalMs).toBe(
      PUBLIC_NOMINATIM_MIN_INTERVAL_MS
    )
  })

  it("identifies the app and carries the contact, sanitised for a header", () => {
    expect(geocodingConfig({ GEOCODING_CONTACT: "ops@example.com" }).userAgent).toBe(
      "Voyagr/1.0 (AI travel planner; ops@example.com)"
    )
    // No header injection, no breaking out of the parentheses.
    const ua = geocodingConfig({ GEOCODING_CONTACT: "ops@example.com\r\nX-Evil: 1) (" }).userAgent
    expect(ua).not.toMatch(/[\r\n]/)
    expect(ua).toBe("Voyagr/1.0 (AI travel planner; ops@example.comX-Evil: 1)")
  })

  it("passes a key through", () => {
    expect(geocodingConfig({ GEOCODING_API_KEY: "g-1" }).apiKey).toBe("g-1")
  })
})

describe("places, currency and URLs", () => {
  it("accepts http(s) overrides and refuses anything else", () => {
    expect(openTripMapBaseUrl({ OPENTRIPMAP_BASE_URL: "https://otm.proxy/places/" })).toBe("https://otm.proxy/places")
    expect(frankfurterBaseUrl({ FRANKFURTER_BASE_URL: "https://fx.internal/v2" })).toBe("https://fx.internal/v2")
    expect(usableUrl("ftp://x.test")).toBeNull()
    expect(usableUrl("javascript:alert(1)")).toBeNull()
    expect(usableUrl("https://user:pass@x.test")).toBeNull()
    expect(frankfurterBaseUrl({ FRANKFURTER_BASE_URL: "nope" })).toBe(FRANKFURTER_DEFAULT_BASE)
  })
})

describe("map style and credits", () => {
  it("credits OpenStreetMap and the default tile provider, linked", () => {
    const { credits } = mapStyleConfig({})
    expect(credits.map((c) => c.label)).toEqual(["© OpenStreetMap contributors", "OpenFreeMap", "© OpenMapTiles"])
    expect(credits[0]!.href).toBe("https://www.openstreetmap.org/copyright")
    expect(credits.every((c) => c.href?.startsWith("https://"))).toBe(true)
  })

  it("keeps the OpenStreetMap credit with a custom tile provider", () => {
    expect(
      mapStyleConfig({ NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.example.com/style.json", NEXT_PUBLIC_MAP_ATTRIBUTION: "© Example Maps" })
    ).toEqual({
      styleUrl: "https://tiles.example.com/style.json",
      credits: [
        { label: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
        { label: "© Example Maps", href: null },
      ],
    })
  })

  it("keeps symbols in a custom credit but strips control characters", () => {
    const { credits } = mapStyleConfig({
      NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.example.com/style.json",
      NEXT_PUBLIC_MAP_ATTRIBUTION: `© Cartes Ünïcode${String.fromCodePoint(0)}\n`,
    })
    expect(credits[1]!.label).toBe("© Cartes Ünïcode")
  })
})

describe("Gemini models", () => {
  it("uses a valid override and ignores an invalid one", () => {
    expect(geminiModels({ GEMINI_MODEL: "gemini-3-flash-preview" }).primary).toBe("gemini-3-flash-preview")
    expect(geminiModels({ GEMINI_MODEL: "../../etc" }).primary).toBe(DEFAULT_GEMINI_MODEL)
    expect(geminiModels({ GEMINI_MODEL: "Gemini Flash" }).primary).toBe(DEFAULT_GEMINI_MODEL)
  })

  it("has a fallback only when it is valid and different", () => {
    expect(geminiModels({ GEMINI_FALLBACK_MODEL: "gemini-2.5-flash-lite" }).fallback).toBe("gemini-2.5-flash-lite")
    expect(geminiModels({ GEMINI_FALLBACK_MODEL: "gemini-3.8-flash" }).fallback).toBeNull()
    expect(geminiModels({ GEMINI_FALLBACK_MODEL: "bad model!" }).fallback).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Wiring: the integrations really use the config (fetch stubbed, no network)
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

describe("integrations read the config", () => {
  it("Open-Meteo: a paid key moves requests to the customer host with apikey", async () => {
    vi.stubEnv("OPEN_METEO_API_KEY", "om-key-123456")
    fetchMock.mockResolvedValue(json({ daily: { time: [] } }))
    const today = new Date().toISOString().slice(0, 10)
    await fetchDailyForecast({ latitude: 11.11, longitude: 22.22, startDate: today, endDate: today })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.host).toBe("customer-api.open-meteo.com")
    expect(url.searchParams.get("apikey")).toBe("om-key-123456")
  })

  it("geocoding: a hosted service gets its key and the contact User-Agent", async () => {
    vi.stubEnv("GEOCODING_BASE_URL", "https://geo.example.com")
    vi.stubEnv("GEOCODING_API_KEY", "geo-key-123456")
    vi.stubEnv("GEOCODING_CONTACT", "ops@example.com")
    fetchMock.mockResolvedValue(json([]))
    await geocodePlace("Unit Test Town")
    const [input, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    const url = new URL(input)
    expect(url.origin + url.pathname).toBe("https://geo.example.com/search")
    expect(url.searchParams.get("key")).toBe("geo-key-123456")
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("Voyagr/1.0 (AI travel planner; ops@example.com)")
  })

  describe("Gemini fallback", () => {
    const request = { system: "s", user: "u", schema: { type: "object" } }
    // A fresh Response each time: a body can only be read once.
    const ok = () => json({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] }, finishReason: "STOP" }] })
    const modelOf = (call: unknown[]) => String(call[0]).match(/models\/([^:]+):/)![1]

    beforeEach(() => {
      vi.stubEnv("GEMINI_API_KEY", "gm-key-123456")
      vi.stubEnv("GEMINI_MODEL", "primary-model")
    })

    it("retries once on the fallback model when the primary is unavailable (503)", async () => {
      vi.stubEnv("GEMINI_FALLBACK_MODEL", "fallback-model")
      fetchMock.mockResolvedValueOnce(json({ error: { message: "high demand" } }, 503)).mockResolvedValueOnce(ok())
      const result = await createStructuredResponse<{ a: number }>(request)
      expect(result.data).toEqual({ a: 1 })
      expect(fetchMock.mock.calls.map(modelOf)).toEqual(["primary-model", "fallback-model"])
    })

    it("does not fall back for a bad request", async () => {
      vi.stubEnv("GEMINI_FALLBACK_MODEL", "fallback-model")
      fetchMock.mockResolvedValue(json({ error: { message: "bad schema" } }, 400))
      await expect(createStructuredResponse(request)).rejects.toMatchObject({ kind: "invalid_response" })
      expect(fetchMock.mock.calls.map(modelOf)).toEqual(["primary-model"])
    })

    it("without a fallback, keeps the usual single retry on the primary", async () => {
      fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(ok())
      await createStructuredResponse(request)
      expect(fetchMock.mock.calls.map(modelOf)).toEqual(["primary-model", "primary-model"])
    })

    it("uses the GA default when GEMINI_MODEL is unset", async () => {
      vi.stubEnv("GEMINI_MODEL", "")
      fetchMock.mockImplementation(async () => ok())
      await createStructuredResponse(request)
      expect(modelOf(fetchMock.mock.calls[0]!)).toBe("gemini-3.8-flash")
    })
  })
})
