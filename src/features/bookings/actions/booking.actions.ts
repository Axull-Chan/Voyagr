"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { reportServerError } from "@/lib/monitoring/report-server"
import { bookingConfig } from "@/lib/config/providers"
import {
  book,
  cancelBooking,
  findBookingByReference,
  prebook,
  searchRates,
  type BookingRecord,
  type EnabledBookingConfig,
  type HotelResult,
} from "@/integrations/liteapi/client"
import {
  bookBlockedReason,
  prebookPriceDecision,
  type BookingStatus,
  type PrebookPriceDecision,
} from "@/lib/bookings/booking-state"
import {
  BOOK_BLOCK_MESSAGES,
  classifyBookFailure,
  prebookFailureMessage,
} from "@/features/bookings/services/book-outcome"
import {
  bookRoomSchema,
  bookingIdSchema,
  searchHotelsSchema,
  selectRoomSchema,
  type BookRoomInput,
  type SearchHotelsInput,
  type SelectRoomInput,
} from "@/features/bookings/schemas/booking.schemas"
import type { Json, Tables, TablesUpdate } from "@/types/database.types"

/**
 * Hotel booking server actions (Phase 2: sandbox only).
 *
 * Who may do what: the traveller is identified from their own session, and
 * every booking read or write is scoped to that user id — never to an id from
 * the request. Reads of the trip go through the user's own client (RLS); all
 * `hotel_bookings` writes go through the service-role client, because that
 * table has no write policy for users at all. The table's triggers enforce the
 * state machine on every write, so a bug here can't skip a step.
 *
 * Every status change is a compare-and-set (`.eq("status", from)`), so two
 * requests racing for the same booking can't both win: the second one updates
 * nothing and is told so.
 *
 * Not in this phase: turning a confirmed booking into the trip's stay, budget
 * line and expense (Phase 4), and the UI (Phase 3).
 */

type BookingRow = Tables<"hotel_bookings">
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const DISABLED = "Hotel booking isn't available right now."

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

function enabledConfig(): EnabledBookingConfig | null {
  const cfg = bookingConfig()
  return cfg.enabled ? cfg : null
}

async function loadOwnBooking(userId: string, bookingId: string): Promise<BookingRow | null> {
  const { data, error } = await createServiceClient()
    .from("hotel_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Compare-and-set: changes the row only if it is still in `from`. True when it did. */
async function transition(
  userId: string,
  bookingId: string,
  from: BookingStatus,
  patch: TablesUpdate<"hotel_bookings">
): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("hotel_bookings")
    .update(patch)
    .eq("id", bookingId)
    .eq("user_id", userId)
    .eq("status", from)
    .select("id")
  if (error) throw error
  return (data ?? []).length === 1
}

function bookedPatch(record: BookingRecord): TablesUpdate<"hotel_bookings"> {
  return {
    status: "booked",
    booking_id: record.bookingId,
    confirmation_code: record.hotelConfirmationCode,
    final_total: record.total,
    refundable_until: record.cancellation.freeUntil,
    cancellation_policy: record.cancellation as unknown as Json,
  }
}

/** A live booking in sandbox mode would mean the key check failed somewhere. Never silent. */
async function warnIfNotSandbox(record: BookingRecord, bookingId: string) {
  if (record.sandbox === false) {
    await reportServerError(
      new Error(`LiteAPI returned a NON-sandbox booking ${record.bookingId} (row ${bookingId}) in sandbox mode`),
      { context: "booking:not-sandbox" }
    )
  }
}

function revalidateTrip(tripId: string | null) {
  if (tripId) revalidatePath(`/trips/${tripId}`)
}

// ---------------------------------------------------------------------------
// Search (nothing is stored: "searching" is page state only)
// ---------------------------------------------------------------------------

/** Where to search: the trip's first located stay, else its first located activity. */
async function tripCentre(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string) {
  const [hotels, days] = await Promise.all([
    supabase.from("hotels").select("lat, lng").eq("trip_id", tripId).not("lat", "is", null).limit(1),
    supabase.from("trip_days").select("activities(lat, lng)").eq("trip_id", tripId).order("day_number"),
  ])
  const hotel = hotels.data?.[0]
  if (hotel?.lat != null && hotel.lng != null) return { lat: hotel.lat, lng: hotel.lng }
  for (const day of (days.data ?? []) as unknown as { activities: { lat: number | null; lng: number | null }[] }[]) {
    const a = day.activities?.find((x) => x.lat != null && x.lng != null)
    if (a) return { lat: a.lat as number, lng: a.lng as number }
  }
  return null
}

export async function searchHotelsAction(input: SearchHotelsInput): Promise<Result<{ hotels: HotelResult[]; currency: string }>> {
  const parsed = searchHotelsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the search details." }
  const cfg = enabledConfig()
  if (!cfg) return { ok: false, error: DISABLED }
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in to search for hotels." }

  const { tripId, stay, guestNationality } = parsed.data
  const { data: trip } = await supabase.from("trips").select("currency").eq("id", tripId).maybeSingle()
  if (!trip) return { ok: false, error: "That trip couldn't be found." }
  const centre = await tripCentre(supabase, tripId)
  if (!centre) return { ok: false, error: "This trip has no places on the map yet, so there's nowhere to search around." }

  try {
    const hotels = await searchRates(cfg, {
      latitude: centre.lat,
      longitude: centre.lng,
      radius: 5000,
      checkin: stay.checkIn,
      checkout: stay.checkOut,
      adults: stay.adults,
      childrenAges: stay.childrenAges,
      currency: trip.currency,
      guestNationality,
    })
    return { ok: true, hotels, currency: trip.currency }
  } catch (error) {
    await reportServerError(error, { context: "action:searchHotels" })
    return { ok: false, error: "We couldn't search for hotels right now. Please try again." }
  }
}

// ---------------------------------------------------------------------------
// Choose a room -> row at room_selected
// ---------------------------------------------------------------------------

export async function selectRoomAction(input: SelectRoomInput): Promise<Result<{ bookingId: string }>> {
  const parsed = selectRoomSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the room details." }
  const cfg = enabledConfig()
  if (!cfg) return { ok: false, error: DISABLED }
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in to book a hotel." }

  const v = parsed.data
  // Through the user's own client: RLS proves the trip is theirs.
  const { data: trip } = await supabase.from("trips").select("id").eq("id", v.tripId).maybeSingle()
  if (!trip) return { ok: false, error: "That trip couldn't be found." }

  const { data, error } = await createServiceClient()
    .from("hotel_bookings")
    .insert({
      user_id: user.id,
      trip_id: v.tripId,
      mode: cfg.mode,
      provider: "liteapi",
      provider_hotel_id: v.hotel.providerHotelId,
      hotel_name: v.hotel.name,
      address: v.hotel.address,
      lat: v.hotel.lat,
      lng: v.hotel.lng,
      room_name: v.roomName,
      board_type: v.boardType,
      check_in: v.stay.checkIn,
      check_out: v.stay.checkOut,
      adults: v.stay.adults,
      children: v.stay.childrenAges.length,
      currency: v.currency,
      quoted_total: v.quotedTotal,
      rate_id: v.offerId,
      refundable_until: v.cancellation.freeUntil,
      cancellation_policy: v.cancellation as unknown as Json,
    })
    .select("id")
    .single()
  if (error || !data) {
    await reportServerError(error, { context: "action:selectRoom" })
    return { ok: false, error: "We couldn't hold that choice. Please try again." }
  }
  return { ok: true, bookingId: data.id }
}

// ---------------------------------------------------------------------------
// Prebook -> prebooked (re-checks the live price)
// ---------------------------------------------------------------------------

export async function prebookRoomAction(
  bookingId: string
): Promise<Result<{ price: PrebookPriceDecision; total: number; currency: string; cancellationChanged: boolean; boardChanged: boolean }>> {
  if (!bookingIdSchema.safeParse(bookingId).success) return { ok: false, error: "That booking couldn't be found." }
  const cfg = enabledConfig()
  if (!cfg) return { ok: false, error: DISABLED }
  const { user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in to book a hotel." }

  try {
    let row = await loadOwnBooking(user.id, bookingId)
    if (!row) return { ok: false, error: "That booking couldn't be found." }
    // A fresh check of an already-prebooked room starts over from room_selected.
    if (row.status === "prebooked") {
      await transition(user.id, bookingId, "prebooked", { status: "room_selected", price_change_accepted_at: null })
      row = await loadOwnBooking(user.id, bookingId)
    }
    if (!row || row.status !== "room_selected" || !row.rate_id) {
      return { ok: false, error: "This booking can't be checked again. Please choose the room again." }
    }

    let result
    try {
      result = await prebook(cfg, row.rate_id)
    } catch (error) {
      const failure = prebookFailureMessage(error)
      if (!failure.retryable) {
        await transition(user.id, bookingId, "room_selected", {
          status: "failed",
          failure_code: "prebook_unavailable",
          failure_message: failure.message,
        })
      }
      await reportServerError(error, { context: "action:prebookRoom", severity: "warning" })
      return { ok: false, error: failure.message }
    }

    if (result.currency !== row.currency) {
      await transition(user.id, bookingId, "room_selected", {
        status: "failed",
        failure_code: "currency_mismatch",
        failure_message: `Priced in ${result.currency}, not ${row.currency}.`,
      })
      return { ok: false, error: "The hotel quoted a different currency. Please search again." }
    }

    const moved = await transition(user.id, bookingId, "room_selected", {
      status: "prebooked",
      prebook_id: result.prebookId,
      prebook_total: result.total,
      price_change_accepted_at: null,
      room_name: result.roomName ?? row.room_name,
      refundable_until: result.cancellation.freeUntil,
      cancellation_policy: result.cancellation as unknown as Json,
    })
    if (!moved) return { ok: false, error: "This booking changed in another window. Refresh and try again." }

    return {
      ok: true,
      price: prebookPriceDecision(Number(row.quoted_total), result.total),
      total: result.total,
      currency: result.currency,
      cancellationChanged: result.cancellationChanged,
      boardChanged: result.boardChanged,
    }
  } catch (error) {
    await reportServerError(error, { context: "action:prebookRoom" })
    return { ok: false, error: "We couldn't check that room. Please try again." }
  }
}

export async function acceptPriceChangeAction(bookingId: string): Promise<Result> {
  if (!bookingIdSchema.safeParse(bookingId).success) return { ok: false, error: "That booking couldn't be found." }
  const { user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in." }
  try {
    const ok = await transition(user.id, bookingId, "prebooked", { price_change_accepted_at: new Date().toISOString() })
    return ok ? { ok: true } : { ok: false, error: "This price check is no longer current. Check the room again." }
  } catch (error) {
    await reportServerError(error, { context: "action:acceptPriceChange" })
    return { ok: false, error: "We couldn't save that. Please try again." }
  }
}

// ---------------------------------------------------------------------------
// Book -> booking -> booked | pending_confirmation | failed | room_selected
// ---------------------------------------------------------------------------

export type BookRoomResult = Result<{ status: BookingStatus; message: string }>

export async function bookRoomAction(input: BookRoomInput): Promise<BookRoomResult> {
  const parsed = bookRoomSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the guest details." }
  const cfg = enabledConfig()
  if (!cfg) return { ok: false, error: DISABLED }
  const { user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in to book a hotel." }
  const { bookingId, guest } = parsed.data

  let row: BookingRow | null
  try {
    row = await loadOwnBooking(user.id, bookingId)
  } catch (error) {
    await reportServerError(error, { context: "action:bookRoom:read" })
    return { ok: false, error: "We couldn't start the booking. Please try again." }
  }
  if (!row) return { ok: false, error: "That booking couldn't be found." }

  const blocked = bookBlockedReason(
    {
      status: row.status as BookingStatus,
      quotedTotal: Number(row.quoted_total),
      prebookTotal: row.prebook_total === null ? null : Number(row.prebook_total),
      prebookExpiresAt: row.prebook_expires_at,
      priceChangeAcceptedAt: row.price_change_accepted_at,
    },
    new Date()
  )
  if (blocked) return { ok: false, error: BOOK_BLOCK_MESSAGES[blocked] }

  // The compare-and-set that makes a double click harmless: only one request
  // moves prebooked -> booking; the other updates nothing and stops here.
  const claimed = await transition(user.id, bookingId, "prebooked", {
    status: "booking",
    guest_first_name: guest.firstName,
    guest_last_name: guest.lastName,
    guest_email: guest.email,
  }).catch(() => false)
  if (!claimed) return { ok: false, error: "This booking is already being processed." }

  try {
    const record = await book(cfg, {
      prebookId: row.prebook_id as string,
      clientReference: row.idempotency_key,
      holder: { ...guest, phone: guest.phone ?? null },
    })
    await warnIfNotSandbox(record, bookingId)
    if (record.status !== "CONFIRMED") {
      await transition(user.id, bookingId, "booking", {
        status: "failed",
        failure_code: `status_${record.status}`.slice(0, 40),
        failure_message: "The hotel didn't confirm the booking.",
      })
      revalidateTrip(row.trip_id)
      return { ok: true, status: "failed", message: "The hotel didn't confirm the booking. Nothing was booked." }
    }
    await transition(user.id, bookingId, "booking", bookedPatch(record))
    revalidateTrip(row.trip_id)
    return { ok: true, status: "booked", message: "Booked." }
  } catch (error) {
    const failure = classifyBookFailure(error)
    await reportServerError(error, { context: `action:bookRoom:${failure.outcome.kind}`, severity: "warning" })

    if (failure.outcome.kind === "declined") {
      await transition(user.id, bookingId, "booking", {
        status: "failed",
        failure_code: failure.code,
        failure_message: failure.message,
      })
      revalidateTrip(row.trip_id)
      return { ok: true, status: "failed", message: failure.message }
    }

    // Duplicate (our reference was already used) or unknown: the booking may
    // exist. Look it up before saying anything about it.
    await transition(user.id, bookingId, "booking", { status: "pending_confirmation" })
    const resolved = await resolveOwnPending(cfg, user.id, bookingId)
    revalidateTrip(row.trip_id)
    return resolved
  }
}

/** Looks a pending booking up by our reference and settles it if the provider knows. */
async function resolveOwnPending(cfg: EnabledBookingConfig, userId: string, bookingId: string): Promise<BookRoomResult> {
  const row = await loadOwnBooking(userId, bookingId)
  if (!row) return { ok: false, error: "That booking couldn't be found." }
  if (row.status !== "pending_confirmation" && row.status !== "booking") {
    return { ok: true, status: row.status as BookingStatus, message: "Nothing to check." }
  }
  const from = row.status as "pending_confirmation" | "booking"
  let found: BookingRecord | null
  try {
    found = await findBookingByReference(cfg, row.idempotency_key)
  } catch (error) {
    await reportServerError(error, { context: "action:resolveBooking", severity: "warning" })
    return { ok: true, status: from, message: "We're still confirming this booking with the hotel. Check back shortly." }
  }
  if (!found) {
    return { ok: true, status: from, message: "We're still confirming this booking with the hotel. Check back shortly." }
  }
  await warnIfNotSandbox(found, bookingId)
  if (found.status === "CONFIRMED") {
    if (from === "booking") await transition(userId, bookingId, "booking", { status: "pending_confirmation" })
    await transition(userId, bookingId, "pending_confirmation", bookedPatch(found))
    return { ok: true, status: "booked", message: "Booked." }
  }
  if (from === "booking") await transition(userId, bookingId, "booking", { status: "pending_confirmation" })
  await transition(userId, bookingId, "pending_confirmation", {
    status: "failed",
    failure_code: `status_${found.status}`.slice(0, 40),
    failure_message: "The provider reports this booking as not confirmed.",
  })
  return { ok: true, status: "failed", message: "This booking wasn't confirmed. Nothing is held." }
}

export async function resolvePendingBookingAction(bookingId: string): Promise<BookRoomResult> {
  if (!bookingIdSchema.safeParse(bookingId).success) return { ok: false, error: "That booking couldn't be found." }
  const cfg = enabledConfig()
  if (!cfg) return { ok: false, error: DISABLED }
  const { user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in." }
  try {
    return await resolveOwnPending(cfg, user.id, bookingId)
  } catch (error) {
    await reportServerError(error, { context: "action:resolvePendingBooking" })
    return { ok: false, error: "We couldn't check this booking. Please try again." }
  }
}

// ---------------------------------------------------------------------------
// Cancel / discard
// ---------------------------------------------------------------------------

export async function cancelBookingAction(
  bookingId: string
): Promise<Result<{ refundAmount: number | null; cancellationFee: number | null; currency: string | null }>> {
  if (!bookingIdSchema.safeParse(bookingId).success) return { ok: false, error: "That booking couldn't be found." }
  const cfg = enabledConfig()
  if (!cfg) return { ok: false, error: DISABLED }
  const { user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in." }
  try {
    const row = await loadOwnBooking(user.id, bookingId)
    if (!row || row.status !== "booked" || !row.booking_id) return { ok: false, error: "Only a confirmed booking can be cancelled." }
    const result = await cancelBooking(cfg, row.booking_id)
    if (!/^CANCEL/.test(result.status)) {
      return { ok: false, error: "The hotel didn't confirm the cancellation. Please try again." }
    }
    await transition(user.id, bookingId, "booked", { status: "cancelled" })
    revalidateTrip(row.trip_id)
    return { ok: true, refundAmount: result.refundAmount, cancellationFee: result.cancellationFee, currency: result.currency }
  } catch (error) {
    await reportServerError(error, { context: "action:cancelBooking" })
    return { ok: false, error: "We couldn't cancel the booking. Please try again." }
  }
}

/** Gives up on a room that was chosen but never booked. Nothing is held, so nothing to tell the provider. */
export async function discardSelectionAction(bookingId: string): Promise<Result> {
  if (!bookingIdSchema.safeParse(bookingId).success) return { ok: false, error: "That booking couldn't be found." }
  const { user } = await requireUser()
  if (!user) return { ok: false, error: "You need to be signed in." }
  try {
    const done =
      (await transition(user.id, bookingId, "room_selected", { status: "cancelled" })) ||
      (await transition(user.id, bookingId, "prebooked", { status: "cancelled" }))
    return done ? { ok: true } : { ok: false, error: "This booking can't be discarded any more." }
  } catch (error) {
    await reportServerError(error, { context: "action:discardSelection" })
    return { ok: false, error: "We couldn't discard that. Please try again." }
  }
}
