import type { Metadata } from "next"

/**
 * Where the site lives, what it is called, and which pages search engines are
 * told about. Pure data and string handling — no Next runtime — so it can be
 * unit-tested and shared by the layout, `robots.ts`, `sitemap.ts` and the
 * Open Graph image.
 */

export const SITE_NAME = "Voyagr"
export const SITE_TAGLINE = "Plan smarter trips with AI"
export const SITE_DESCRIPTION =
  "Voyagr is an AI travel planner that builds day-by-day itineraries, tracks your budget, and adapts your trip in real time."

/** Dimensions of the generated share card (`opengraph-image.tsx`). */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const

/** The production origin, used when `NEXT_PUBLIC_SITE_URL` is unset or unusable. */
export const DEFAULT_SITE_URL = "https://voyagr-taupe.vercel.app"

/**
 * Resolve the site's origin from an env value. Anything that is not an
 * absolute http(s) URL falls back to the default rather than throwing — a
 * typo in a deploy variable must not take the whole site's metadata down
 * (`new URL(bad)` in the root layout would fail every page's render).
 * Path, query and trailing slash are dropped: this is an origin, not a page.
 */
export function resolveSiteUrl(raw: string | undefined | null): string {
  const value = raw?.trim()
  if (!value) return DEFAULT_SITE_URL
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return DEFAULT_SITE_URL
    }
    return url.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

/** The site origin for this build. `NEXT_PUBLIC_*` is inlined at build time. */
export function getSiteUrl(): string {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
}

/** An absolute URL on this site for a root-relative path. */
export function absoluteUrl(path: string, siteUrl: string = getSiteUrl()) {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Pages worth sending a search engine to. Everything here must be indexable:
 * a URL that is both listed in the sitemap and marked `noindex` sends
 * contradictory signals. `/privacy` and `/terms` are the legal pages.
 */
export const SITEMAP_PATHS = [
  "/",
  "/blue-hour",
  "/login",
  "/sign-up",
  "/privacy",
  "/terms",
] as const

/**
 * Paths crawlers are asked not to fetch: the signed-in app, the API and the
 * OAuth callback. Deliberately NOT the password-reset pages — those are marked
 * `noindex`, and a crawler that is forbidden from fetching a page never sees
 * its `noindex`, so a blocked URL can still end up listed from external links.
 */
export const ROBOTS_DISALLOW = [
  "/dashboard",
  "/trips",
  "/favorites",
  "/api",
  "/auth",
] as const

/** True when robots.txt would stop a crawler fetching `path`. */
export function isDisallowed(path: string): boolean {
  return ROBOTS_DISALLOW.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

/** Keep a page out of search results (and its links unfollowed). */
export const NOINDEX: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
}

/**
 * Per-page metadata for a public page: canonical URL plus Open Graph/Twitter
 * fields that name *this* page. A page that sets its own `openGraph` replaces
 * the root layout's wholesale (Next merges metadata one top-level key at a
 * time, not deeply), so a page that only set a title would otherwise lose
 * its `og:url`/`og:site_name` or inherit the wrong ones. `path` is
 * root-relative and is resolved against `metadataBase`.
 */
export function pageMetadata(input: {
  title: string
  description: string
  path: string
}): Metadata {
  const { title, description, path } = input
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title,
      description,
      url: path,
      // Named explicitly because a page's own `openGraph` replaces the root
      // layout's, and with it the image Next attaches from the file
      // convention. Same card for every page; the alt text is the page title.
      images: [{ url: "/opengraph-image", ...OG_IMAGE_SIZE, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: "/twitter-image", ...OG_IMAGE_SIZE, alt: title }],
    },
  }
}
