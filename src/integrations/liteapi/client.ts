import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, extractErrorCode, fetchJson } from "@/integrations/core/http"
import type { BookingConfig } from "@/lib/config/providers"

/**
 * LiteAPI (Nuitee Connect) hotel booking client.
 *
 * Endpoints, fields and error codes were checked against the provider's docs
 * (docs.nuitee.com, read Nov 2026), not taken from memory:
 *  - api.liteapi.travel/v3.0   POST /hotels/rates            search + rates in one call
 *  - book.liteapi.travel/v3.0  POST /rates/prebook           re-check price, get prebookId
 *                              POST /rates/book              book (clientReference = idempotency key)
 *                              GET  /bookings/{id}           one booking
 *                              GET  /bookings/?bookingStartDate=&bookingEndDate=   find ours by clientReference
 *                              PUT  /bookings/{id}           cancel
 *  - Auth: `X-API-Key` header (redacted from every error by core/http.ts).
 *  - Match on `error.code`, not the HTTP status; rates can answer HTTP 200
 *    with an `error` object (2001, no availability).
 *
 * Retries: searches and lookups use the shared retry policy. Prebook and book
 * do NOT retry automatically — a retried book could meet our own first
 * attempt — and get the long timeout the provider recommends (~2 minutes),
 * because a book that times out may still have happened.
 */

const PROVIDER = "LiteAPI"

/** The provider recommends ~6 s for an interactive rate search. */
const RATES_TIMEOUT_MS = 8_000
/** Prebook and book "can take up to about 2 minutes" (docs). Under our 150 s function limit. */
const CHECKOUT_TIMEOUT_MS = 125_000
const LOOKUP_TIMEOUT_MS = 15_000

/** Our own tag on every booking, so one can be found again after a lost response. */
export const VOYAGR_REF_TAG = "VOYAGR_REF"

export type EnabledBookingConfig = Extract<BookingConfig, { enabled: true }>

// ---------------------------------------------------------------------------
// Domain shapes (what the rest of the app sees)
// ---------------------------------------------------------------------------

export interface Cancellation {
  refundable: boolean
  /** Last moment cancelling is free (ISO, UTC); null when not refundable or unknown. */
  freeUntil: string | null
  /** As sent by the provider, kept for display and audit. */
  policies: { cancelTime: string; amount: number; currency: string }[]
}

export interface RoomOffer {
  offerId: string
  roomName: string | null
  boardName: string | null
  boardType: string | null
  total: number
  currency: string
  cancellation: Cancellation
}

export interface HotelResult {
  hotelId: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  photo: string | null
  stars: number | null
  offers: RoomOffer[]
}

export interface PrebookResult {
  prebookId: string
  total: number
  currency: string
  /** The provider's three "check these" fields. */
  priceDifferencePercent: number
  cancellationChanged: boolean
  boardChanged: boolean
  roomName: string | null
  boardName: string | null
  cancellation: Cancellation
}

export interface BookingRecord {
  bookingId: string
  status: "CONFIRMED" | "CANCELED" | string
  clientReference: string | null
  hotelConfirmationCode: string | null
  total: number
  currency: string
  checkin: string | null
  checkout: string | null
  /** True for a sandbox (test) booking; null when the response didn't say. */
  sandbox: boolean | null
  cancellation: Cancellation
}

export interface CancelResult {
  bookingId: string
  status: string
  cancellationFee: number | null
  refundAmount: number | null
  currency: string | null
  sandbox: boolean | null
}

// ---------------------------------------------------------------------------
// Parsing — tolerant of missing fields, strict about the ones we rely on
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : v === 1 ? true : v === 0 ? false : null)

function invalid(what: string): IntegrationError {
  return new IntegrationError(PROVIDER, "invalid_response", `${PROVIDER} returned ${what}`)
}

/** "2025-11-11 08:00:00" (always GMT per the docs) -> "2025-11-11T08:00:00Z". */
export function toUtcIso(cancelTime: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(cancelTime.trim())
  if (!m) return null
  const time = m[2]!.length === 5 ? `${m[2]}:00` : m[2]
  const iso = `${m[1]}T${time}Z`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

/**
 * Reads `cancellationPolicies`. Following the provider's guidance: `RFN` means
 * refundable, a 0-amount policy charges nothing (it is ignored), and cancelling
 * is free until the earliest policy that charges something. A `NRFN` rate is
 * never "free until" anything, even when part of it would be refunded.
 */
export function parseCancellation(raw: unknown): Cancellation {
  const policies = arr(obj(raw)?.cancelPolicyInfos)
    .map((p) => {
      const o = obj(p)
      const cancelTime = str(o?.cancelTime)
      const amount = num(o?.amount)
      return cancelTime !== null && amount !== null
        ? { cancelTime, amount, currency: str(o?.currency) ?? "" }
        : null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
  const refundable = str(obj(raw)?.refundableTag) === "RFN"
  if (!refundable) return { refundable, freeUntil: null, policies }
  const charging = policies
    .filter((p) => p.amount > 0)
    .map((p) => toUtcIso(p.cancelTime))
    .filter((t): t is string => t !== null)
    .sort()
  return { refundable, freeUntil: charging[0] ?? null, policies }
}

/** `offerRetailRate` is documented as a list of {amount, currency}; tolerate a single object too. */
function offerPrice(raw: unknown): { total: number; currency: string } | null {
  const first = Array.isArray(raw) ? obj(raw[0]) : obj(raw)
  const total = num(first?.amount)
  const currency = str(first?.currency)
  return total !== null && currency ? { total, currency } : null
}

export function parseRatesResponse(body: unknown): HotelResult[] {
  const root = obj(body)
  if (!root) throw invalid("a rates body that was not an object")
  const error = obj(root.error)
  if (error) {
    // HTTP 200 with an error object: 2001 is "no availability", an empty
    // result rather than a failure; anything else is a real error.
    if (extractErrorCode(root) === "2001") return []
    throw new IntegrationError(PROVIDER, "invalid_response", `${PROVIDER} rates error: ${str(error.message) ?? "unknown"}`, {
      providerCode: extractErrorCode(root) ?? undefined,
    })
  }
  const details = new Map<string, Json>()
  for (const h of arr(root.hotels)) {
    const o = obj(h)
    const id = str(o?.id)
    if (o && id) details.set(id, o)
  }
  return arr(root.data)
    .map((entry): HotelResult | null => {
      const e = obj(entry)
      const hotelId = str(e?.hotelId)
      if (!e || !hotelId) return null
      const d = details.get(hotelId)
      const offers = arr(e.roomTypes)
        .map((rt): RoomOffer | null => {
          const r = obj(rt)
          const offerId = str(r?.offerId)
          const price = offerPrice(r?.offerRetailRate)
          if (!r || !offerId || !price) return null
          const rate = obj(arr(r.rates)[0])
          return {
            offerId,
            roomName: str(rate?.name),
            boardName: str(rate?.boardName),
            boardType: str(rate?.boardType),
            total: price.total,
            currency: price.currency,
            cancellation: parseCancellation(rate?.cancellationPolicies),
          }
        })
        .filter((o): o is RoomOffer => o !== null)
        .sort((a, b) => a.total - b.total)
      return {
        hotelId,
        name: str(d?.name) ?? hotelId,
        address: str(d?.address),
        lat: num(d?.latitude),
        lng: num(d?.longitude),
        photo: str(d?.thumbnail) ?? str(d?.main_photo),
        stars: num(d?.stars),
        offers,
      }
    })
    .filter((h): h is HotelResult => h !== null && h.offers.length > 0)
}

export function parsePrebookResponse(body: unknown): PrebookResult {
  const data = obj(obj(body)?.data)
  const prebookId = str(data?.prebookId)
  const total = num(data?.price)
  const currency = str(data?.currency)
  if (!data || !prebookId || total === null || !currency) throw invalid("a prebook without prebookId, price or currency")
  const rate = obj(arr(obj(arr(data.roomTypes)[0])?.rates)[0])
  return {
    prebookId,
    total,
    currency,
    priceDifferencePercent: num(data.priceDifferencePercent) ?? 0,
    cancellationChanged: bool(data.cancellationChanged) ?? false,
    boardChanged: bool(data.boardChanged) ?? false,
    roomName: str(rate?.name),
    boardName: str(rate?.boardName),
    cancellation: parseCancellation(rate?.cancellationPolicies),
  }
}

export function parseBookingRecord(raw: unknown, sandboxFlag: unknown = undefined): BookingRecord {
  const data = obj(raw)
  const bookingId = str(data?.bookingId)
  const status = str(data?.status)
  const total = num(data?.price)
  const currency = str(data?.currency)
  if (!data || !bookingId || !status || total === null || !currency) {
    throw invalid("a booking without bookingId, status, price or currency")
  }
  return {
    bookingId,
    status,
    clientReference: str(data.clientReference),
    hotelConfirmationCode: str(data.hotelConfirmationCode),
    total,
    currency,
    checkin: str(data.checkin),
    checkout: str(data.checkout),
    sandbox: bool(sandboxFlag ?? data.sandbox),
    cancellation: parseCancellation(data.cancellationPolicies),
  }
}

/**
 * One entry of `GET /bookings` — a DIFFERENT shape from `GET /bookings/{id}`,
 * checked live (sandbox, Nov 2026) and not in the docs: snake_case keys
 * (`booking_Id`, `client_reference`, `hotel_confirmation_code`), the price as a
 * string in `retail_rate`, and `cancelPolicies` as a JSON *string*.
 */
export function parseListedBooking(raw: unknown): BookingRecord {
  const d = obj(raw)
  const bookingId = str(d?.booking_Id) ?? str(d?.bookingId)
  const status = str(d?.status)
  const total = num(d?.retail_rate) ?? (typeof d?.retail_rate === "string" ? Number(d.retail_rate) : null) ?? num(d?.price)
  const currency = str(d?.currency)
  if (!d || !bookingId || !status || total === null || !Number.isFinite(total) || !currency) {
    throw invalid("a listed booking without id, status, price or currency")
  }
  let policies: unknown = d.cancelPolicies ?? d.cancellationPolicies
  if (typeof policies === "string") {
    try {
      policies = JSON.parse(policies)
    } catch {
      policies = null
    }
  }
  return {
    bookingId,
    status,
    clientReference: str(d.client_reference) ?? str(d.clientReference),
    hotelConfirmationCode: str(d.hotel_confirmation_code) ?? str(d.hotelConfirmationCode),
    total,
    currency,
    checkin: str(d.checkin),
    checkout: str(d.checkout),
    sandbox: bool(d.sandbox),
    cancellation: parseCancellation(policies),
  }
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

const headers = (cfg: EnabledBookingConfig) => ({ "X-API-Key": cfg.apiKey })

export interface RateSearch {
  latitude: number
  longitude: number
  /** Metres; the provider's minimum for location searches is 1000. */
  radius: number
  checkin: string
  checkout: string
  adults: number
  childrenAges: number[]
  currency: string
  /** ISO 3166-1 alpha-2. */
  guestNationality: string
  limit?: number
}

export async function searchRates(cfg: EnabledBookingConfig, q: RateSearch): Promise<HotelResult[]> {
  const body = await fetchJson<unknown>(PROVIDER, `${cfg.dataBase}/hotels/rates`, {
    method: "POST",
    headers: headers(cfg),
    timeoutMs: RATES_TIMEOUT_MS,
    body: {
      latitude: q.latitude,
      longitude: q.longitude,
      radius: Math.max(1000, Math.round(q.radius)),
      checkin: q.checkin,
      checkout: q.checkout,
      currency: q.currency,
      guestNationality: q.guestNationality,
      occupancies: [{ adults: q.adults, children: q.childrenAges }],
      includeHotelData: true,
      maxRatesPerHotel: 3,
      limit: q.limit ?? 20,
      timeout: 6,
    },
  })
  return parseRatesResponse(body)
}

export async function prebook(cfg: EnabledBookingConfig, offerId: string): Promise<PrebookResult> {
  const body = await fetchJson<unknown>(PROVIDER, `${cfg.bookBase}/rates/prebook`, {
    method: "POST",
    headers: headers(cfg),
    timeoutMs: CHECKOUT_TIMEOUT_MS,
    retries: 0,
    // Hosted payment SDK is for live mode; the sandbox flow uses ACC_CREDIT_CARD.
    body: { offerId, usePaymentSdk: false },
  })
  return parsePrebookResponse(body)
}

export interface BookRequest {
  prebookId: string
  /** Our idempotency key: a repeat is refused by the provider with 4005. */
  clientReference: string
  holder: { firstName: string; lastName: string; email: string; phone?: string | null }
}

export async function book(cfg: EnabledBookingConfig, req: BookRequest): Promise<BookingRecord> {
  const holder = {
    firstName: req.holder.firstName,
    lastName: req.holder.lastName,
    email: req.holder.email,
    ...(req.holder.phone ? { phone: req.holder.phone } : {}),
  }
  const body = await fetchJson<unknown>(PROVIDER, `${cfg.bookBase}/rates/book`, {
    method: "POST",
    headers: headers(cfg),
    timeoutMs: CHECKOUT_TIMEOUT_MS,
    retries: 0,
    body: {
      prebookId: req.prebookId,
      clientReference: req.clientReference,
      customTags: { [VOYAGR_REF_TAG]: req.clientReference },
      holder,
      guests: [{ occupancyNumber: 1, firstName: holder.firstName, lastName: holder.lastName, email: holder.email }],
      // Sandbox: simulates payment, nothing is charged (docs). Config refuses
      // any non-sandbox key, so this can't reach a real card.
      payment: { method: "ACC_CREDIT_CARD" },
    },
  })
  const root = obj(body)
  return parseBookingRecord(root?.data, obj(root?.data)?.sandbox ?? root?.sandbox)
}

export async function getBooking(cfg: EnabledBookingConfig, bookingId: string): Promise<BookingRecord> {
  const body = await fetchJson<unknown>(PROVIDER, `${cfg.bookBase}/bookings/${encodeURIComponent(bookingId)}`, {
    headers: headers(cfg),
    timeoutMs: LOOKUP_TIMEOUT_MS,
  })
  const root = obj(body)
  return parseBookingRecord(root?.data, obj(root?.data)?.sandbox ?? root?.sandbox)
}

/** YYYY-MM-DD, UTC, `days` from `from`. */
function isoDay(from: Date, days: number): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The booking made with our idempotency key, or null when the provider has
 * none. This is how a book whose response was lost gets resolved.
 *
 * Checked live (sandbox, Nov 2026), which differs from the docs: `GET /bookings`
 * REFUSES a request without a date range (4000, "at least one pair of dates is
 * required"), and a booking's `customTags` read back as null, so the tag can't be
 * relied on to find it. So this asks for bookings *made* in a window around when
 * our row was created and matches `clientReference` exactly, which every booking
 * echoes (as `client_reference` in this list — see `parseListedBooking`). The
 * VOYAGR_REF tag is stored too (visible in this list), and kept as a label.
 */
export async function findBookingByReference(
  cfg: EnabledBookingConfig,
  clientReference: string,
  createdAround: Date
): Promise<BookingRecord | null> {
  const url = buildUrl(`${cfg.bookBase}/bookings/`, {
    bookingStartDate: isoDay(createdAround, -1),
    bookingEndDate: isoDay(createdAround, 2),
  })
  const body = await fetchJson<unknown>(PROVIDER, url, { headers: headers(cfg), timeoutMs: LOOKUP_TIMEOUT_MS })
  const matches = arr(obj(body)?.data)
    .map((b) => {
      try {
        return parseListedBooking(b)
      } catch {
        return null
      }
    })
    // Only a booking that carries our exact reference counts.
    .filter((b): b is BookingRecord => b !== null && b.clientReference === clientReference)
  return matches[0] ?? null
}

export async function cancelBooking(cfg: EnabledBookingConfig, bookingId: string): Promise<CancelResult> {
  const body = await fetchJson<unknown>(PROVIDER, `${cfg.bookBase}/bookings/${encodeURIComponent(bookingId)}`, {
    method: "PUT",
    headers: headers(cfg),
    timeoutMs: LOOKUP_TIMEOUT_MS,
    retries: 0,
  })
  const root = obj(body)
  const data = obj(root?.data)
  const status = str(data?.status)
  if (!data || !status) throw invalid("a cancellation without a status")
  return {
    bookingId: str(data.bookingId) ?? bookingId,
    status,
    cancellationFee: num(data.cancellation_fee),
    refundAmount: num(data.refund_amount),
    currency: str(data.currency),
    sandbox: bool(root?.sandbox),
  }
}
