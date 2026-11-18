import localFont from "next/font/local"

/**
 * Self-hosted app fonts (loaded in the root layout).
 *
 * These used to come from `next/font/google`, which fetches the font CSS from
 * Google at build time — and Google intermittently answers with an
 * extensionless font URL that Next 15's loader cannot parse, failing roughly
 * one build in three. Local files remove the build-time network dependency.
 * The CSS variable names are unchanged, so nothing downstream moved.
 *
 * Provenance and licences: see src/fonts/README.md.
 */

// Variable font, weight axis 100-900 (same as the Google version's default).
export const geistSans = localFont({
  src: "./Geist-Variable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
})

export const geistMono = localFont({
  src: "./GeistMono-Variable.woff2",
  variable: "--font-mono",
  weight: "100 900",
  display: "swap",
})

// Voice, per DESIGN.md — headlines, day headings, and dialog/sheet/card
// titles via --font-heading. The file is the full variable font (weight,
// optical size, SOFT and WONK axes, latin subset): optical sizing and
// SOFT/WONK are what the display sizes need to stay legible rather than thin,
// so static cuts would not do.
export const fraunces = localFont({
  src: "./Fraunces-latin-VF.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
})
