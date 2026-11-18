import { describe, expect, it } from "vitest"

import {
  DEFAULT_SITE_URL,
  ROBOTS_DISALLOW,
  SITEMAP_PATHS,
  absoluteUrl,
  isDisallowed,
  pageMetadata,
  resolveSiteUrl,
} from "@/lib/site"

describe("resolveSiteUrl", () => {
  it("falls back to the production origin when unset or blank", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl(null)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("   ")).toBe(DEFAULT_SITE_URL)
  })

  it("uses a valid override, reduced to its origin", () => {
    expect(resolveSiteUrl("https://voyagr.example")).toBe(
      "https://voyagr.example"
    )
    expect(resolveSiteUrl("https://voyagr.example/")).toBe(
      "https://voyagr.example"
    )
    expect(resolveSiteUrl("  https://voyagr.example/some/path?x=1  ")).toBe(
      "https://voyagr.example"
    )
    expect(resolveSiteUrl("http://localhost:3000")).toBe("http://localhost:3000")
  })

  it("never throws on junk: a typo in a deploy variable must not break every page", () => {
    expect(resolveSiteUrl("voyagr.example")).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("not a url")).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("ftp://voyagr.example")).toBe(DEFAULT_SITE_URL)
  })
})

describe("absoluteUrl", () => {
  it("joins an origin and a root-relative path", () => {
    expect(absoluteUrl("/", "https://a.test")).toBe("https://a.test/")
    expect(absoluteUrl("/terms", "https://a.test")).toBe("https://a.test/terms")
    expect(absoluteUrl("terms", "https://a.test")).toBe("https://a.test/terms")
  })
})

describe("robots and sitemap agree", () => {
  it("never lists a path in the sitemap that robots.txt blocks", () => {
    for (const path of SITEMAP_PATHS) {
      expect(isDisallowed(path), path).toBe(false)
    }
  })

  it("blocks the signed-in app and everything under it, but not look-alike paths", () => {
    expect(isDisallowed("/dashboard")).toBe(true)
    expect(isDisallowed("/trips/abc/export/pdf")).toBe(true)
    expect(isDisallowed("/auth/callback")).toBe(true)
    expect(isDisallowed("/api/anything")).toBe(true)
    expect(isDisallowed("/tripsy")).toBe(false)
    expect(isDisallowed("/")).toBe(false)
  })

  it("does not block the auth pages, so their noindex can be seen", () => {
    for (const path of ["/login", "/sign-up", "/forgot-password", "/reset-password"]) {
      expect(isDisallowed(path), path).toBe(false)
    }
    expect(ROBOTS_DISALLOW).not.toContain("/login")
  })

  it("has no duplicate or non-root-relative sitemap entries", () => {
    expect(new Set(SITEMAP_PATHS).size).toBe(SITEMAP_PATHS.length)
    for (const path of SITEMAP_PATHS) expect(path.startsWith("/")).toBe(true)
  })
})

describe("pageMetadata", () => {
  it("names the page itself in canonical, og and twitter fields", () => {
    const meta = pageMetadata({
      title: "Blue Hour",
      description: "A film.",
      path: "/blue-hour",
    })
    expect(meta.alternates?.canonical).toBe("/blue-hour")
    expect(meta.openGraph).toMatchObject({
      title: "Blue Hour",
      description: "A film.",
      url: "/blue-hour",
      siteName: "Voyagr",
    })
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" })
    expect(meta.openGraph).toMatchObject({
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    })
  })
})
