"use server"

import { z } from "zod"

import type { ChatOperation } from "@/lib/ai/types"
import { createClient } from "@/lib/supabase/server"
import { reportServerError } from "@/lib/monitoring/report-server"
import type { Json } from "@/types/database.types"
import { TIME_SLOTS, type TimeSlot } from "@/lib/trips/trip-domain"
import { tripStartPoint } from "@/lib/trips/feasibility"
import { SUPERSEDED_NOTE } from "@/features/trips/components/detail/replan-events"
import {
  proposePaceFix,
  proposeWeatherFix,
  type ForecastLike,
  type ReplanTrip,
} from "@/lib/trips/replan"

/**
 * One-click replans ("Optimize pace", "Adapt for weather") for one day.
 *
 * Deterministic: no model call (so no AI quota) and no external request. It
 * reads the trip's own rows, runs the pure replanner, and saves the result as
 * an assistant chat message with ordinary operations, so it is previewed and
 * applied through the chat panel's existing Apply/Discard and resync.
 *
 * At most one pending replan per day: a new one replaces the previous unapplied
 * one (its operations are cleared, so it can no longer be applied). Replan rows
 * are tagged in `provider_id` as `replan:day-N` — a free-text column that
 * already records who produced an assistant row.
 */

const forecastSchema = z.object({
  condition: z.string().trim().min(1).max(60),
  precipitationChance: z.number().int().min(0).max(100).nullable(),
  windKph: z.number().min(0).max(400).nullable(),
})

const proposeReplanSchema = z.object({
  tripId: z.string().uuid(),
  dayNumber: z.number().int().min(1).max(366),
  kind: z.enum(["pace", "weather"]),
  /** The forecast the page showed for this day; the stored row is used if absent. */
  forecast: forecastSchema.optional(),
})

export type ProposeReplanInput = z.infer<typeof proposeReplanSchema>

export interface ReplanProposalMessage {
  id: string
  content: string
  operations: ChatOperation[]
}

export type ProposeReplanResult =
  | {
      ok: true
      /** Null when no safe change was found; `reply` says why. */
      proposal: ReplanProposalMessage | null
      reply: string
      /** Earlier pending replans for this day, now no longer applicable. */
      supersededIds: string[]
    }
  | { ok: false; error: string }

const replanProviderId = (dayNumber: number) => `replan:day-${dayNumber}`


/** A stored weather row counts as a forecast only when it came from a real one. */
function storedForecast(row: {
  condition: string
  precipitation_chance: number | null
  wind_kph: number | string | null
  source: string
} | null): ForecastLike | null {
  if (!row || row.source !== "open-meteo") return null
  return {
    condition: row.condition,
    precipitationChance: row.precipitation_chance,
    windKph: row.wind_kph === null ? null : Number(row.wind_kph),
  }
}

export async function proposeReplanAction(input: ProposeReplanInput): Promise<ProposeReplanResult> {
  const parsed = proposeReplanSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request." }
  const { tripId, dayNumber, kind, forecast } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { ok: false, error: "You need to be signed in to do that." }

  const [tripRes, daysRes, hotelsRes] = await Promise.all([
    supabase.from("trips").select("id, transportation").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_days")
      .select(
        "day_number, weather(condition, precipitation_chance, wind_kph, source), activities(id, title, time_slot, start_time, duration_minutes, lat, lng, sort_order, category)"
      )
      .eq("trip_id", tripId),
    supabase.from("hotels").select("lat, lng, is_primary, source").eq("trip_id", tripId),
  ])
  if (tripRes.error || daysRes.error || hotelsRes.error) {
    await reportServerError(tripRes.error ?? daysRes.error ?? hotelsRes.error, { context: "action:proposeReplan:read" })
    return { ok: false, error: "We couldn't load this trip. Please try again." }
  }
  if (!tripRes.data) return { ok: false, error: "That trip no longer exists." }
  const days = daysRes.data ?? []
  if (!days.some((d) => d.day_number === dayNumber)) {
    return { ok: false, error: "That day no longer exists." }
  }

  const trip: ReplanTrip = {
    dayNumbers: days.map((d) => d.day_number).sort((a, b) => a - b),
    activities: days.flatMap((d) =>
      (d.activities ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        dayNumber: d.day_number,
        timeSlot: (TIME_SLOTS as readonly string[]).includes(a.time_slot ?? "") ? (a.time_slot as TimeSlot) : null,
        startTime: a.start_time,
        durationMinutes: a.duration_minutes,
        lat: a.lat,
        lng: a.lng,
        sortOrder: a.sort_order,
        category: a.category,
      }))
    ),
    start: tripStartPoint(hotelsRes.data ?? []),
    transport: tripRes.data.transportation,
  }

  // Embedded one-to-one rows arrive as an object or a one-item array.
  const weatherOf = (d: (typeof days)[number]) => (Array.isArray(d.weather) ? (d.weather[0] ?? null) : d.weather)
  const forecasts: Record<number, ForecastLike | null> = {}
  for (const d of days) forecasts[d.day_number] = storedForecast(weatherOf(d))
  if (forecast) forecasts[dayNumber] = forecast

  const result = kind === "pace" ? proposePaceFix(trip, dayNumber) : proposeWeatherFix(trip, dayNumber, forecasts)
  if (!result.ok) return { ok: true, proposal: null, reply: result.reply, supersededIds: [] }

  // One pending replan per day: retire the previous unapplied one.
  const providerId = replanProviderId(dayNumber)
  const { data: pending } = await supabase
    .from("trip_chat_messages")
    .select("id, content")
    .eq("trip_id", tripId)
    .eq("provider_id", providerId)
    .is("applied_at", null)
    .not("proposed_operations", "is", null)
  const supersededIds: string[] = []
  for (const row of pending ?? []) {
    const { error } = await supabase
      .from("trip_chat_messages")
      .update({ proposed_operations: null, content: `${row.content}${SUPERSEDED_NOTE}` })
      .eq("id", row.id)
      .is("applied_at", null)
    if (!error) supersededIds.push(row.id)
  }

  const { data: inserted, error: insertError } = await supabase
    .from("trip_chat_messages")
    .insert({
      trip_id: tripId,
      role: "assistant",
      content: result.reply,
      proposed_operations: result.operations as unknown as Json,
      provider_id: providerId,
    })
    .select("id")
    .single()
  if (insertError || !inserted) {
    await reportServerError(insertError, { context: "action:proposeReplan:insert" })
    return { ok: false, error: "We couldn't save the suggestion. Please try again." }
  }

  return {
    ok: true,
    proposal: { id: inserted.id, content: result.reply, operations: result.operations },
    reply: result.reply,
    supersededIds,
  }
}
