import { describe, expect, it } from "vitest"

import {
  authErrorMessage,
  DEFAULT_AFTER_SIGN_IN,
  safeRedirectPath,
} from "@/lib/auth/safe-redirect"

describe("safeRedirectPath - accepts same-site paths", () => {
  it.each([
    "/dashboard",
    "/trips",
    "/trips/9b1f5c3e-1111-4a2b-8c3d-aaaaaaaaaaaa",
    "/reset-password",
    "/trips?view=archived",
    "/trips/abc#day-2",
    "/favorites/",
  ])("%s", (path) => {
    expect(safeRedirectPath(path)).toBe(path)
  })
})

describe("safeRedirectPath - refuses anything that can leave the site", () => {
  it.each([
    // The payload that worked against `${origin}${next}`.
    "@evil.example",
    "/@evil.example",
    "/trips@evil.example",
    // Protocol-relative, and the backslash variants browsers normalise to it.
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\\/evil.example",
    // Absolute and scheme URLs.
    "https://evil.example",
    "http://evil.example/dashboard",
    "javascript:alert(1)",
    "data:text/html,hi",
    "/redirect?to=https://evil.example",
    // Not starting with a slash at all.
    "evil.example",
    "dashboard",
    "",
    // Encoded versions of the same tricks.
    "/%2F%2Fevil.example",
    "/%5Cevil.example",
    "/%40evil.example",
    "%2F%2Fevil.example",
    // Whitespace and control characters (tab, newline) that browsers strip.
    "/\t/evil.example",
    "/\n/evil.example",
    " /dashboard",
    // Malformed encoding.
    "/%E0%A4%A",
  ])("%j -> /dashboard", (payload) => {
    expect(safeRedirectPath(payload)).toBe(DEFAULT_AFTER_SIGN_IN)
  })

  it("refuses null, undefined and over-long values", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_AFTER_SIGN_IN)
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_AFTER_SIGN_IN)
    expect(safeRedirectPath(`/${"a".repeat(3000)}`)).toBe(DEFAULT_AFTER_SIGN_IN)
  })

  it("uses the given fallback", () => {
    expect(safeRedirectPath("//evil.example", "/trips")).toBe("/trips")
  })

  it("never yields a value that resolves off-site, whatever the input", () => {
    const origin = "https://voyagr-taupe.vercel.app"
    for (const payload of ["@evil.example", "//evil.example", "/\\evil.example", "https://evil.example"]) {
      // How the callback builds its redirect.
      const target = new URL(`${origin}${safeRedirectPath(payload)}`)
      expect(target.origin).toBe(origin)
    }
  })
})

describe("authErrorMessage", () => {
  it("explains a failed sign-in link", () => {
    expect(authErrorMessage("auth-callback-failed")).toMatch(/couldn't finish signing you in/)
  })

  it("shows nothing for unknown or missing codes, so a link can't inject text", () => {
    expect(authErrorMessage("You have been hacked, call 555-0100")).toBeNull()
    expect(authErrorMessage(null)).toBeNull()
    expect(authErrorMessage(undefined)).toBeNull()
  })
})
