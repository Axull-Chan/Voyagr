import type { CreateTripInput } from "@/features/trips/schemas/trip.schemas"

/**
 * One-click starters for the trip wizard: a destination and a style, nothing
 * else. Dates, budget, travellers and currency keep the wizard's own defaults,
 * and the traveller still checks every step and presses Create themselves —
 * a preset never generates a trip or spends AI quota on its own.
 *
 * Every value here is one the wizard already offers (a test checks each against
 * the schema), so a preset can't put the form into a state the user couldn't
 * have chosen by hand.
 */

export interface TripPreset {
  id: string
  /** Rail label, "Lisbon · food". */
  label: string
  values: Pick<CreateTripInput, "destination" | "travelStyle" | "interests"> &
    Partial<Pick<CreateTripInput, "accommodation" | "transportation">>
}

export const TRIP_PRESETS: readonly TripPreset[] = [
  {
    id: "lisbon-food",
    label: "Lisbon · food",
    values: {
      destination: "Lisbon, Portugal",
      travelStyle: "balanced",
      interests: ["food", "history"],
      transportation: "public",
    },
  },
  {
    id: "kyoto-culture",
    label: "Kyoto · culture",
    values: {
      destination: "Kyoto, Japan",
      travelStyle: "balanced",
      interests: ["history", "architecture", "art"],
      transportation: "public",
    },
  },
  {
    id: "bali-relaxed",
    label: "Bali · relaxed",
    values: {
      destination: "Bali, Indonesia",
      travelStyle: "relaxed",
      interests: ["beaches", "wellness", "nature"],
      accommodation: "resort",
      transportation: "rideshare",
    },
  },
  {
    id: "iceland-nature",
    label: "Iceland · nature",
    values: {
      destination: "Reykjavik, Iceland",
      travelStyle: "packed",
      interests: ["nature", "adventure"],
      transportation: "car",
    },
  },
]

/** The preset for a `?preset=` value, or null for anything unknown or malformed. */
export function presetById(id: string | string[] | null | undefined): TripPreset | null {
  if (typeof id !== "string") return null
  return TRIP_PRESETS.find((preset) => preset.id === id) ?? null
}

/**
 * Where the wizard starts. A preset the traveller just clicked wins outright —
 * it replaces a saved draft rather than mixing with it, since a Kyoto preset
 * merged into a half-finished Lisbon draft would be neither. Without one, a
 * saved draft is merged over the defaults (drafts are partial), as before.
 */
export function wizardStartValues<T extends object>(
  defaults: T,
  draft: Partial<T> | null,
  preset: Partial<T> | null
): { values: T; source: "preset" | "draft" | "defaults" } {
  if (preset) return { values: { ...defaults, ...preset }, source: "preset" }
  if (draft) return { values: { ...defaults, ...draft }, source: "draft" }
  return { values: defaults, source: "defaults" }
}
