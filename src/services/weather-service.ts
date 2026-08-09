import {
  describeWeatherCode,
  fetchDailyForecast,
  MAX_FORECAST_OFFSET_DAYS,
  type DailyForecast,
} from "@/integrations/openmeteo/weather"
import { attempt, fallback, live, type ServiceResult } from "@/services/service-result"

/**
 * Weather for a trip, keyed by date so a day can look up its own forecast.
 */

export interface DayWeather {
  /** ISO `YYYY-MM-DD`. */
  date: string
  condition: string
  tempHighC: number | null
  tempLowC: number | null
  precipitationChance: number | null
  windKph: number | null
  humidity: number | null
  sunrise: string | null
  sunset: string | null
}

export interface TripWeather {
  /** Date → forecast. Days beyond the horizon are simply absent. */
  byDate: Record<string, DayWeather>
  /** True when the trip starts further out than the model forecasts. */
  beyondForecastHorizon: boolean
}

const EMPTY: TripWeather = { byDate: {}, beyondForecastHorizon: false }

function toDayWeather(row: DailyForecast): DayWeather {
  return {
    date: row.date,
    condition: describeWeatherCode(row.weatherCode),
    tempHighC: row.tempMaxC,
    tempLowC: row.tempMinC,
    precipitationChance: row.precipitationChance,
    windKph: row.windKph,
    humidity: row.humidity,
    sunrise: row.sunrise,
    sunset: row.sunset,
  }
}

/**
 * Forecast for a trip's date range.
 *
 * A trip beyond the forecast horizon is the normal case, not a failure — most
 * people plan further ahead than a fortnight — so it returns an empty map
 * flagged `beyondForecastHorizon`, letting the UI say "forecast appears
 * closer to departure" instead of showing an error.
 */
export async function getTripWeather(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<ServiceResult<TripWeather>> {
  return attempt("Weather", EMPTY, async () => {
    const rows = await fetchDailyForecast({
      latitude,
      longitude,
      startDate,
      endDate,
    })

    const byDate: Record<string, DayWeather> = {}
    for (const row of rows) byDate[row.date] = toDayWeather(row)

    if (rows.length === 0) {
      return fallback(
        { byDate, beyondForecastHorizon: true },
        `Forecasts run about ${MAX_FORECAST_OFFSET_DAYS} days ahead — we'll fill this in closer to your trip.`
      )
    }

    // Some days covered, some not: still live data, just partial.
    return live({ byDate, beyondForecastHorizon: false })
  })
}
