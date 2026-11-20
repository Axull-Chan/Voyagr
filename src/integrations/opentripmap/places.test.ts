import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { IntegrationError } from "@/integrations/core/errors"
import { fetchPlaceDetail, searchPlaces } from "@/integrations/opentripmap/places"
import { serialiseError } from "@/lib/monitoring/error-model"

/**
 * OpenTripMap authenticates ONLY with an `apikey` query parameter. Checked
 * live (Nov 2026): `?apikey=` -> 200, while an `x-api-key` header, a bare
 * `Authorization` header and `Authorization: Bearer` all -> 401. So the key
 * necessarily sits in the request URL, which makes it worth pinning that no
 * error built from a failed request ever repeats that URL.
 *
 * `fetch` is stubbed: no network, no real key. Every test uses its own
 * coordinates or xid because the integration cache is module-level.
 */

const KEY = "test-otm-key-0123456789abcdef"

let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function requestedUrl(call = 0): URL {
  return new URL(String(fetchMock.mock.calls[call]![0]))
}

function requestedHeaders(call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call]![1] as RequestInit | undefined
  return Object.fromEntries(
    Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ])
  )
}

/** Everything a thrown error could leak through: message, cause, stack, report. */
function everythingVisible(error: unknown): string {
  const own =
    error instanceof Error
      ? JSON.stringify(error, Object.getOwnPropertyNames(error))
      : JSON.stringify(error)
  const cause = error instanceof Error ? String(error.cause ?? "") : ""
  return [String(error), own, cause, JSON.stringify(serialiseError(error))].join("\n")
}

beforeEach(() => {
  vi.stubEnv("OPENTRIPMAP_API_KEY", KEY)
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("OpenTripMap authentication", () => {
  it("sends the key as the apikey query parameter and in no header", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await searchPlaces({ latitude: 1.001, longitude: 2.001, kinds: ["museums"] })

    const url = requestedUrl()
    expect(url.host).toBe("api.opentripmap.com")
    expect(url.searchParams.get("apikey")).toBe(KEY)
    const headers = requestedHeaders()
    expect(headers).not.toHaveProperty("authorization")
    expect(headers).not.toHaveProperty("x-api-key")
    expect(Object.values(headers).some((value) => value.includes(KEY))).toBe(false)
  })

  it("uses the same query parameter for the detail lookup", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ xid: "N1", name: "Somewhere", point: { lat: 1, lon: 2 } })
    )

    await fetchPlaceDetail("N1-auth")

    expect(requestedUrl().searchParams.get("apikey")).toBe(KEY)
    expect(requestedHeaders()).not.toHaveProperty("authorization")
  })
})

describe("OpenTripMap errors never carry the key", () => {
  it("a rejected key (401) is unauthorized and key-free", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "Unauthorized" } }, 401))

    const error = await searchPlaces({
      latitude: 3.003,
      longitude: 4.004,
      kinds: ["museums"],
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(IntegrationError)
    expect((error as IntegrationError).kind).toBe("unauthorized")
    expect((error as IntegrationError).status).toBe(401)
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("a network failure is unavailable and key-free, cause included", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const error = await fetchPlaceDetail("N2-network").catch((e: unknown) => e)

    expect(error).toBeInstanceOf(IntegrationError)
    expect((error as IntegrationError).kind).toBe("unavailable")
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("a missing key is not_configured and makes no request", async () => {
    vi.stubEnv("OPENTRIPMAP_API_KEY", "")

    await expect(
      searchPlaces({ latitude: 7.007, longitude: 8.008, kinds: ["museums"] })
    ).rejects.toMatchObject({ kind: "not_configured" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
