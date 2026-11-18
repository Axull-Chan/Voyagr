import type { MetadataRoute } from "next"

import { SITEMAP_PATHS, absoluteUrl } from "@/lib/site"

// No `lastModified`: nothing here tracks real edit dates, and a made-up one
// (e.g. "now" on every request) would tell crawlers the pages change daily.
export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((path) => ({ url: absoluteUrl(path) }))
}
