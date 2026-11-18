import localFont from "next/font/local"

/**
 * Display serif for the film hero and the Blue Hour campaign page only.
 *
 * Kept in its own module (not alongside the app fonts) so that only the two
 * routes that import it pay for it — the product screens never render it.
 * Exposed as `--font-film-serif`; see src/features/film/film-typography.ts.
 * Weights 300 and 400, normal style, latin subset.
 */
export const filmSerifFont = localFont({
  src: [
    {
      path: "./CormorantGaramond-latin-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./CormorantGaramond-latin-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-film-serif",
  display: "swap",
})
