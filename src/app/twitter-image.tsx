import { OG_SIZE, renderBrandImage } from "@/lib/og/brand-image"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

// Same card as the Open Graph image; X/Twitter only reads `twitter-image`.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`
export const size = OG_SIZE
export const contentType = "image/png"

export default function TwitterImage() {
  return renderBrandImage()
}
