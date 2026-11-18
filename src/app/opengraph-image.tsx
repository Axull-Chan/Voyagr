import { OG_SIZE, renderBrandImage } from "@/lib/og/brand-image"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

// Next reads these exports statically, so they are literals/plain values here
// rather than re-exports of another module's config.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`
export const size = OG_SIZE
export const contentType = "image/png"

export default function OpenGraphImage() {
  return renderBrandImage()
}
