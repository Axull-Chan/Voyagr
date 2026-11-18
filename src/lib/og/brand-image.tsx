import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { OG_IMAGE_SIZE, SITE_NAME, SITE_TAGLINE } from "@/lib/site"


/**
 * The 1200x630 share card: wordmark and tagline on Field Journal paper.
 * Colours are the light-theme tokens from DESIGN.md (an image has no CSS
 * variables to read, and a link preview should look the same whatever theme
 * the viewer prefers). Used by both `opengraph-image.tsx` and
 * `twitter-image.tsx`.
 *
 * ImageResponse (Satori) accepts TTF/OTF/WOFF but not WOFF2, so it loads the
 * static Fraunces cuts in src/fonts/og/ — the same family as the app's
 * headings — rather than the variable WOFF2 the site itself serves.
 */

export const OG_SIZE = OG_IMAGE_SIZE

const PAPER = "#F8F6F4" // surface
const INK = "#1e2019" // on-surface
const PINE = "#244F54" // primary-strong
const SLATE = "#587b7f" // primary
const RULE = "#BBB7B0" // border

export async function renderBrandImage(): Promise<ImageResponse> {
  // `path.join(process.cwd(), "<literal>")` is the form Next documents for
  // fonts in the Node runtime, and the one Vercel's file tracer recognises, so
  // the files are bundled with the route. A `fetch(new URL(..., import.meta.url))`
  // does not work here: at build time it resolves to a bare "/_next/static/..."
  // path, which fetch cannot parse and fails the prerender.
  const [regular, semibold] = await Promise.all([
    readFile(join(process.cwd(), "src/fonts/og/Fraunces-latin-400.woff")),
    readFile(join(process.cwd(), "src/fonts/og/Fraunces-latin-600.woff")),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: "68px 88px",
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 4,
              background: PINE,
              color: PAPER,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 600,
            }}
          >
            V
          </div>
          <div
            style={{
              marginLeft: 20,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: -0.5,
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: -3,
              color: INK,
              maxWidth: 940,
            }}
          >
            {SITE_TAGLINE}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              fontWeight: 400,
              lineHeight: 1.35,
              color: SLATE,
              maxWidth: 860,
            }}
          >
            Day-by-day itineraries, a live budget and a packing list, kept like
            a travel journal.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderTop: `2px solid ${RULE}`,
            paddingTop: 28,
            fontSize: 26,
            color: PINE,
          }}
        >
          <div style={{ display: "flex" }}>Itinerary</div>
          <div style={{ display: "flex", margin: "0 18px", color: RULE }}>/</div>
          <div style={{ display: "flex" }}>Budget</div>
          <div style={{ display: "flex", margin: "0 18px", color: RULE }}>/</div>
          <div style={{ display: "flex" }}>Packing</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Fraunces", data: regular, weight: 400, style: "normal" },
        { name: "Fraunces", data: semibold, weight: 600, style: "normal" },
      ],
    }
  )
}
