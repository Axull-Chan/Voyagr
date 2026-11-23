import type { NextTripFacts } from "@/features/trips/queries/next-trip-facts"

/**
 * The hero's fact lines, in words. Pure so the honesty rules are tested: a
 * forecast line only from a real forecast (with its numbers), "Forecast from
 * <date>" before one can exist, and no weather line at all otherwise — never
 * an estimate. Packing appears only when there is a list.
 */

export interface HeroFactLine {
  label: string
  value: string
}

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

export function heroFactLines(
  facts: NextTripFacts,
  money: { budget: number | null; formatMoney: (amount: number) => string }
): HeroFactLine[] {
  const lines: HeroFactLine[] = []

  if (facts.forecast.kind === "forecast") {
    const d = facts.forecast.day
    const parts = [d.condition]
    if (d.tempLowC !== null && d.tempHighC !== null) {
      parts.push(`${Math.round(d.tempLowC)}–${Math.round(d.tempHighC)}°C`)
    }
    if (d.precipitationChance !== null) parts.push(`${d.precipitationChance}% rain`)
    lines.push({ label: "Weather, day 1", value: parts.join(" · ") })
  } else if (facts.forecast.kind === "later") {
    lines.push({ label: "Weather", value: `Forecast from ${shortDate(facts.forecast.availableFrom)}` })
  }

  if (facts.packing.total > 0) {
    lines.push({ label: "Packing", value: `${facts.packing.checked}/${facts.packing.total} packed` })
  }

  lines.push({
    label: "Budget",
    value: money.budget !== null && money.budget > 0 ? money.formatMoney(money.budget) : "No budget set",
  })
  lines.push({ label: "Stops", value: facts.stops === 0 ? "None planned yet" : String(facts.stops) })

  return lines
}
