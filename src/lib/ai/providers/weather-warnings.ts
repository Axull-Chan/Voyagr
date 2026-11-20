import type { SourcedContext } from "@/lib/ai/types"

/**
 * Weather warnings come from the forecast, never from the model.
 *
 * Open-Meteo's daily `weather_code` is the most severe code seen at any point in
 * the day, so a day with a brief 10% chance of a shower is labelled "Rain". A
 * model shown that label wrote "Heavy rain is expected" for exactly such a day
 * (Lisbon, 25 Nov 2026, 10% precipitation chance). A warning is a factual claim
 * about the real world, so it gets the same rule as venue names and coordinates:
 * the model does not get to state it. Model-written warnings that talk about the
 * weather are dropped, and the weather warnings shown are built here from the
 * numbers in `weatherByDate` alone.
 */

/** Only what the rules read, so a stored row or a displayed forecast both fit. */
type DayForecast = Pick<
  SourcedContext["weatherByDate"][string],
  "condition" | "precipitationChance" | "windKph"
>

/** At or above this precipitation probability a wet day is worth a warning. */
export const LIKELY_PRECIPITATION_CHANCE = 50
/** Daily maximum wind speed (km/h) worth warning about. */
export const STRONG_WIND_KPH = 40

const WEATHER_WORDS =
  /\b(rain\w*|showers?|drizzle|downpours?|storm\w*|thunder\w*|lightning|snow\w*|sleet|hail(?:stones?|storms?)|blizzards?|wind|windy|gales?|gusts?|typhoons?|hurricanes?|monsoon|heat ?waves?|umbrellas?|waterproof\w*|flood\w*|weather|forecast\w*)\b/i

/** Whether a free-text warning makes a claim about the weather. */
export function isWeatherClaim(text: string): boolean {
  return WEATHER_WORDS.test(text)
}

const RAIN_CONDITIONS = new Set([
  "Drizzle",
  "Freezing drizzle",
  "Rain",
  "Freezing rain",
  "Showers",
])
const SNOW_CONDITIONS = new Set(["Snow", "Snow showers"])

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

/** Warnings for one day, from its real forecast only. */
export function forecastWarningsForDay(date: string, forecast: DayForecast): string[] {
  const warnings: string[] = []
  const chance = forecast.precipitationChance
  const day = formatDay(date)

  // An unknown probability is not evidence of rain, so it never warns.
  if (chance !== null && chance >= LIKELY_PRECIPITATION_CHANCE) {
    if (forecast.condition === "Thunderstorm") {
      warnings.push(`Thunderstorms are possible on ${day} (${chance}% chance of precipitation in the forecast).`)
    } else if (SNOW_CONDITIONS.has(forecast.condition)) {
      warnings.push(`Snow is likely on ${day} (${chance}% chance of precipitation in the forecast).`)
    } else if (RAIN_CONDITIONS.has(forecast.condition)) {
      warnings.push(`Rain is likely on ${day} (${chance}% chance in the forecast) - worth packing a waterproof layer.`)
    }
  }

  if (forecast.windKph !== null && forecast.windKph >= STRONG_WIND_KPH) {
    warnings.push(`Strong wind is forecast on ${day} (up to ${Math.round(forecast.windKph)} km/h).`)
  }

  return warnings
}

/**
 * The trip's warnings with the weather made honest: every model warning that
 * mentions the weather is dropped, and forecast-derived ones are added for the
 * trip's dates. Non-weather warnings are kept in their original order.
 */
export function reconcileWeatherWarnings(
  modelWarnings: string[],
  weatherByDate: SourcedContext["weatherByDate"],
  dates: string[]
): string[] {
  const kept = modelWarnings.filter((warning) => !isWeatherClaim(warning))
  const fromForecast = dates.flatMap((date) => {
    const forecast = weatherByDate[date]
    return forecast ? forecastWarningsForDay(date, forecast) : []
  })
  return [...fromForecast, ...kept]
}

/**
 * Whether a forecast is bad enough to warn about: exactly the rule the warnings
 * above use (rain, snow or storms at >= LIKELY_PRECIPITATION_CHANCE, or wind at
 * >= STRONG_WIND_KPH), so "Adapt for weather" appears exactly when a warning would.
 */
export function isSevereForecast(forecast: DayForecast): boolean {
  return forecastWarningsForDay("1970-01-01", forecast).length > 0
}
