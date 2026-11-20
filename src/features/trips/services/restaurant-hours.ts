/**
 * Restaurant opening hours, said honestly.
 *
 * No provider this app uses supplies a restaurant's real hours. Until Nov 2026
 * generation filled `restaurants.opening_hours` with one fixed window per meal
 * (the three below) for every restaurant, real venue or not, and the trip page
 * showed it as if it were that restaurant's hours. New generations store null
 * instead. Rows written before that still hold the guesses, and stored records
 * are not rewritten, so they are recognised here by value: shown with a
 * "Typical meal hours" label and left out of exports.
 */

/** The exact strings generation used to write, by meal. */
export const MEAL_WINDOW_GUESSES = ["07:00 – 11:00", "11:30 – 15:00", "17:30 – 22:30"] as const

/** Hyphen, the U+2010-U+2015 dashes and the minus sign, built from code points
 * (typed escapes can turn into literal characters in this repo's tooling). */
const DASHES = new RegExp(
  `[-${String.fromCodePoint(0x2010)}-${String.fromCodePoint(0x2015)}${String.fromCodePoint(0x2212)}]`,
  "g"
)

const normalise = (value: string) =>
  value.normalize("NFKC").replace(DASHES, "-").replace(/\s+/g, "")

const GUESSES = new Set(MEAL_WINDOW_GUESSES.map(normalise))

/** True when a stored value is one of the old meal-window guesses. */
export function isMealWindowGuess(value: string | null | undefined): boolean {
  return typeof value === "string" && GUESSES.has(normalise(value))
}

export type RestaurantHoursDisplay =
  | { kind: "typical"; label: "Typical meal hours"; hours: string }
  | { kind: "listed"; hours: string }

/**
 * What to show for a restaurant's hours, or null for nothing. A meal-window
 * guess is always labelled as typical, never shown as the venue's own hours.
 */
export function restaurantHoursDisplay(
  value: string | null | undefined
): RestaurantHoursDisplay | null {
  const hours = value?.trim()
  if (!hours) return null
  if (isMealWindowGuess(hours)) return { kind: "typical", label: "Typical meal hours", hours }
  return { kind: "listed", hours }
}

/** The text for a one-line display. */
export function restaurantHoursText(value: string | null | undefined): string | null {
  const display = restaurantHoursDisplay(value)
  if (!display) return null
  return display.kind === "typical" ? `${display.label} ${display.hours}` : display.hours
}

/** Hours for an export file: a guess is dropped, so a file can't state it as fact. */
export function restaurantHoursForExport(value: string | null | undefined): string | null {
  return value && !isMealWindowGuess(value) ? value : null
}
