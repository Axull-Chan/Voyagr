import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { IntegrationError } from "@/integrations/core/errors"
import {
  buildUrl,
  collectSecrets,
  fetchJson,
  redactSecrets,
} from "@/integrations/core/http"
import { serialiseError } from "@/lib/monitoring/error-model"

/**
 * Several providers take their key as a query parameter (Gemini `key`,
 * OpenTripMap `apikey`), so the request URL is itself a secret. If a provider
 * ever echoes that URL back in an error body, or the runtime puts it in a
 * network error, nothing built from it may carry the key into a thrown error,
 * a log line or a stored error report.
 */

const KEY = "sk-live-0123456789abcdefSECRET"
const URL_WITH_KEY = buildUrl("https://api.example.test/v1/thing", { q: "lisbon", key: KEY })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Everything a thrown error could expose: message, stack, cause, report. */
function everythingVisible(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined
  return [
    String(error),
    error instanceof Error ? error.stack ?? "" : "",
    cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause ?? ""),
    JSON.stringify(serialiseError(error)),
  ].join("\n")
}

describe("redactSecrets", () => {
  it.each([
    ["apikey", "https://x.test/p?lat=1&apikey=abc123SECRET&lon=2"],
    ["key", "https://x.test/p?key=abc123SECRET"],
    ["token", "GET /p?token=abc123SECRET failed"],
    ["access_token", "https://x.test/p?a=1&access_token=abc123SECRET"],
    ["API_KEY (case)", "https://x.test/p?API_KEY=abc123SECRET"],
    ["percent-encoded", "redirect=https%3A%2F%2Fx.test%2Fp%3Fkey%3Dabc123SECRET%26a%3D1"],
  ])("redacts a %s parameter in an echoed URL", (_label, text) => {
    const out = redactSecrets(text)
    expect(out).not.toContain("abc123SECRET")
    expect(out).toContain("[REDACTED]")
  })

  it("keeps the rest of the URL readable", () => {
    expect(redactSecrets("https://x.test/p?lat=1&apikey=abc123SECRET&lon=2")).toBe(
      "https://x.test/p?lat=1&apikey=[REDACTED]&lon=2"
    )
  })

  it("does not touch parameters that merely end in a sensitive name", () => {
    expect(redactSecrets("https://x.test/p?monkey=banana")).toBe("https://x.test/p?monkey=banana")
  })

  it("removes a known secret wherever it appears, raw or encoded", () => {
    const secret = "a+b/c=SECRETVALUE"
    const text = `invalid credential ${secret} (sent as ${encodeURIComponent(secret)})`
    const out = redactSecrets(text, [secret])
    expect(out).not.toContain(secret)
    expect(out).not.toContain(encodeURIComponent(secret))
  })
})

describe("collectSecrets", () => {
  it("collects sensitive query values and auth headers, not ordinary ones", () => {
    const secrets = collectSecrets(URL_WITH_KEY, {
      Authorization: "Bearer bearer-SECRET-1",
      "x-api-key": "header-SECRET-2",
      accept: "application/json",
    })
    expect(secrets).toEqual([KEY, "bearer-SECRET-1", "header-SECRET-2"])
  })

  it("strips an Unsplash-style Client-ID prefix so the bare key is what gets redacted", () => {
    expect(collectSecrets("https://x.test/p", { Authorization: "Client-ID unsplash-SECRET-3" })).toEqual([
      "unsplash-SECRET-3",
    ])
  })

  it("ignores values too short to replace safely", () => {
    expect(collectSecrets("https://x.test/p?key=1")).toEqual([])
  })
})

describe("fetchJson never leaks a key from its own URL", () => {
  it("400: an error body echoing the request URL is redacted", async () => {
    fetchMock.mockImplementation(async (input: unknown) =>
      jsonResponse({ error: { message: `Bad request for ${String(input)}` } }, 400)
    )

    const error = await fetchJson("example", URL_WITH_KEY, { retries: 0 }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(IntegrationError)
    expect((error as IntegrationError).status).toBe(400)
    expect(String(error)).toContain("key=[REDACTED]")
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("500: the same after retries are exhausted", async () => {
    fetchMock.mockImplementation(async (input: unknown) =>
      jsonResponse({ message: `upstream failed: ${String(input)}` }, 500)
    )

    const error = await fetchJson("example", URL_WITH_KEY, { retries: 1 }).catch((e: unknown) => e)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((error as IntegrationError).kind).toBe("unavailable")
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("an echo of just the key value, without its parameter name, is redacted", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: `API key ${KEY} is invalid` }, 403))

    const error = await fetchJson("example", URL_WITH_KEY, { retries: 0 }).catch((e: unknown) => e)

    expect((error as IntegrationError).kind).toBe("unauthorized")
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("a network error whose message contains the URL is redacted in the cause", async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed: ${URL_WITH_KEY}`))

    const error = await fetchJson("example", URL_WITH_KEY, { retries: 0 }).catch((e: unknown) => e)

    expect((error as IntegrationError).kind).toBe("unavailable")
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("a non-JSON 200 body quoting the URL is redacted in the parse-error cause", async () => {
    fetchMock.mockResolvedValue(new Response(`<html>${URL_WITH_KEY}</html>`, { status: 200 }))

    const error = await fetchJson("example", URL_WITH_KEY, { retries: 0 }).catch((e: unknown) => e)

    expect((error as IntegrationError).kind).toBe("invalid_response")
    expect(everythingVisible(error)).not.toContain(KEY)
  })

  it("a bearer token echoed from a header is redacted", async () => {
    const token = "bearer-token-SECRET-xyz"
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: `token ${token} expired` } }, 401))

    const error = await fetchJson("example", "https://api.example.test/v1", {
      retries: 0,
      headers: { Authorization: `Bearer ${token}` },
    }).catch((e: unknown) => e)

    expect(everythingVisible(error)).not.toContain(token)
  })
})
