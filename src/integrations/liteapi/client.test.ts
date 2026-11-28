import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { IntegrationError } from "@/integrations/core/errors"
import {
  VOYAGR_REF_TAG,
  book,
  cancelBooking,
  findBookingByReference,
  parseCancellation,
  prebook,
  searchRates,
  toUtcIso,
  type EnabledBookingConfig,
} from "@/integrations/liteapi/client"
import { bookingConfig, LITEAPI_BOOK_BASE, LITEAPI_DATA_BASE } from "@/lib/config/providers"
import { serialiseError } from "@/lib/monitoring/error-model"

/**
 * The LiteAPI client against a stubbed `fetch` — no network, no real key.
 * Shapes follow the provider's documented examples (docs.nuitee.com, Nov 2026).
 */

const KEY = "sand_test-key-0123456789abcdef"
const cfg: EnabledBookingConfig = {
  enabled: true,
  mode: "sandbox",
  apiKey: KEY,
  dataBase: LITEAPI_DATA_BASE,
  bookBase: LITEAPI_BOOK_BASE,
}

let fetchMock: ReturnType<typeof vi.fn>
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const call = (i = 0) => {
  const [url, init] = fetchMock.mock.calls[i]! as [string, RequestInit]
  return {
    url: new URL(url),
    method: init.method,
    headers: Object.fromEntries(Object.entries(init.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])),
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  }
}
const visible = (e: unknown) =>
  [String(e), JSON.stringify(e, Object.getOwnPropertyNames(e as object)), JSON.stringify(serialiseError(e))].join("\n")

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const rfnPolicies = {
  refundableTag: "RFN",
  hotelRemarks: [],
  cancelPolicyInfos: [
    { cancelTime: "2026-12-10 08:00:00", amount: 712.39, currency: "EUR", type: "amount", timezone: "GMT" },
    { cancelTime: "2026-12-01 08:00:00", amount: 0, currency: "EUR", type: "amount", timezone: "GMT" },
    { cancelTime: "2026-12-05 12:00:00", amount: 100, currency: "EUR", type: "amount", timezone: "GMT" },
  ],
}

describe("cancellation terms", () => {
  it("converts the provider's GMT times to ISO", () => {
    expect(toUtcIso("2025-11-11 08:00:00")).toBe("2025-11-11T08:00:00Z")
    expect(toUtcIso("2025-11-11 08:00")).toBe("2025-11-11T08:00:00Z")
    expect(toUtcIso("soon")).toBeNull()
  })

  it("is free until the earliest policy that charges, ignoring 0-amount ones", () => {
    expect(parseCancellation(rfnPolicies)).toMatchObject({ refundable: true, freeUntil: "2026-12-05T12:00:00Z" })
  })

  it("never calls a non-refundable rate free, even with refundable parts", () => {
    expect(parseCancellation({ ...rfnPolicies, refundableTag: "NRFN" })).toMatchObject({ refundable: false, freeUntil: null })
    expect(parseCancellation(undefined)).toEqual({ refundable: false, freeUntil: null, policies: [] })
  })
})

describe("searchRates", () => {
  const q = {
    latitude: 38.71,
    longitude: -9.14,
    radius: 300,
    checkin: "2026-12-04",
    checkout: "2026-12-06",
    adults: 2,
    childrenAges: [7],
    currency: "EUR",
    guestNationality: "PT",
  }

  it("searches by location on the data host with the key in X-API-Key, never the URL", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], hotels: [] }))
    await searchRates(cfg, q)
    const c = call()
    expect(c.url.toString()).toBe(`${LITEAPI_DATA_BASE}/hotels/rates`)
    expect(c.method).toBe("POST")
    expect(c.headers["x-api-key"]).toBe(KEY)
    expect(c.url.toString()).not.toContain(KEY)
    expect(c.body).toMatchObject({
      latitude: 38.71,
      longitude: -9.14,
      radius: 1000, // provider minimum
      checkin: "2026-12-04",
      checkout: "2026-12-06",
      currency: "EUR",
      guestNationality: "PT",
      occupancies: [{ adults: 2, children: [7] }],
      includeHotelData: true,
    })
  })

  it("joins rates to hotel details, cheapest offer first, and drops hotels with no usable offer", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        data: [
          {
            hotelId: "lp1",
            roomTypes: [
              { offerId: "B", offerRetailRate: [{ amount: 300, currency: "EUR" }], rates: [{ name: "Suite", boardName: "Room Only", boardType: "RO", cancellationPolicies: rfnPolicies }] },
              { offerId: "A", offerRetailRate: { amount: 210.5, currency: "EUR" }, rates: [{ name: "Double", boardType: "BB", cancellationPolicies: { refundableTag: "NRFN" } }] },
            ],
          },
          { hotelId: "lp2", roomTypes: [{ offerId: "X" }] },
        ],
        hotels: [{ id: "lp1", name: "Casa Azul", address: "Rua 1", latitude: 38.7, longitude: -9.1, thumbnail: "https://img/t.jpg", stars: 4 }],
      })
    )
    const hotels = await searchRates(cfg, q)
    expect(hotels).toHaveLength(1)
    expect(hotels[0]).toMatchObject({ hotelId: "lp1", name: "Casa Azul", lat: 38.7, stars: 4, photo: "https://img/t.jpg" })
    expect(hotels[0]!.offers.map((o) => [o.offerId, o.total])).toEqual([["A", 210.5], ["B", 300]])
    expect(hotels[0]!.offers[1]!.cancellation.freeUntil).toBe("2026-12-05T12:00:00Z")
  })

  it("treats HTTP 200 with error 2001 as no availability, and other 200 errors as errors", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 2001, message: "no availability found" } }))
    await expect(searchRates(cfg, q)).resolves.toEqual([])
    fetchMock.mockResolvedValueOnce(json({ error: { code: 4002, message: "required request field is missing" } }))
    await expect(searchRates(cfg, q)).rejects.toMatchObject({ providerCode: "4002" })
  })
})

describe("prebook", () => {
  it("posts the offer to the booking host without the payment SDK and reads the three checks", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        data: {
          prebookId: "PB1",
          price: 438,
          currency: "EUR",
          priceDifferencePercent: 6,
          cancellationChanged: true,
          boardChanged: false,
          roomTypes: [{ rates: [{ name: "Double", boardName: "Breakfast", cancellationPolicies: rfnPolicies }] }],
        },
      })
    )
    const r = await prebook(cfg, "offer-123")
    const c = call()
    expect(c.url.toString()).toBe(`${LITEAPI_BOOK_BASE}/rates/prebook`)
    expect(c.body).toEqual({ offerId: "offer-123", usePaymentSdk: false })
    expect(r).toMatchObject({ prebookId: "PB1", total: 438, priceDifferencePercent: 6, cancellationChanged: true, roomName: "Double" })
  })

  it("does not retry on its own, and keeps the provider's error code", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 4016, message: "prebook timeout exceeded" } }, 503))
    await expect(prebook(cfg, "o")).rejects.toMatchObject({ providerCode: "4016" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("book", () => {
  const req = {
    prebookId: "PB1",
    clientReference: "11111111-2222-4333-8444-555555555555",
    holder: { firstName: "Ana", lastName: "Silva", email: "ana@example.com" },
  }
  const confirmed = {
    data: { bookingId: "BK1", clientReference: req.clientReference, status: "CONFIRMED", hotelConfirmationCode: "HC9", price: 438, currency: "EUR", checkin: "2026-12-04", checkout: "2026-12-06", cancellationPolicies: rfnPolicies },
    sandbox: true,
  }

  it("sends our reference as clientReference and as a findable tag, with the sandbox payment method", async () => {
    fetchMock.mockResolvedValueOnce(json(confirmed))
    const r = await book(cfg, req)
    const c = call()
    expect(c.url.toString()).toBe(`${LITEAPI_BOOK_BASE}/rates/book`)
    expect(c.body).toMatchObject({
      prebookId: "PB1",
      clientReference: req.clientReference,
      customTags: { [VOYAGR_REF_TAG]: req.clientReference },
      payment: { method: "ACC_CREDIT_CARD" },
      holder: { firstName: "Ana", lastName: "Silva", email: "ana@example.com" },
      guests: [{ occupancyNumber: 1, firstName: "Ana", lastName: "Silva", email: "ana@example.com" }],
    })
    expect(c.body.holder).not.toHaveProperty("phone")
    expect(r).toMatchObject({ bookingId: "BK1", status: "CONFIRMED", total: 438, sandbox: true, hotelConfirmationCode: "HC9" })
  })

  it("makes exactly one attempt even on a 5xx or a timeout — a retry could book twice", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 5000, message: "unable to process request" } }, 500))
    await expect(book(cfg, req)).rejects.toBeInstanceOf(IntegrationError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps 4005 (reference already used) and never leaks the key", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 4005, message: `duplicate booking attempt; key=${KEY}` } }, 400))
    const error = await book(cfg, req).catch((e: unknown) => e)
    expect(error).toMatchObject({ providerCode: "4005" })
    expect(visible(error)).not.toContain(KEY)
  })
})

describe("lookups and cancel", () => {
  it("finds a booking by its exact reference within a booking-date window (the API requires one)", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        // The list's real shape (sandbox, Nov 2026): snake_case, price as a string,
        // policies as a JSON string — not the single-booking shape.
        count: 2,
        data: [
          { booking_Id: "OTHER", client_reference: "someone-else", status: "CONFIRMED", retail_rate: "1.00", currency: "EUR" },
          {
            booking_Id: "BK1",
            id: 5569090,
            client_reference: "ref-1",
            status: "CONFIRMED",
            retail_rate: "239.71",
            currency: "EUR",
            sandbox: 1,
            hotel_confirmation_code: "test",
            checkin: "2027-01-12",
            checkout: "2027-01-14",
            customTags: { [VOYAGR_REF_TAG]: "ref-1" },
            cancelPolicies: JSON.stringify(rfnPolicies),
          },
        ],
      })
    )
    const found = await findBookingByReference(cfg, "ref-1", new Date("2026-11-28T10:00:00Z"))
    expect(call().url.searchParams.get("bookingStartDate")).toBe("2026-11-27")
    expect(call().url.searchParams.get("bookingEndDate")).toBe("2026-11-30")
    expect(found).toMatchObject({ bookingId: "BK1", total: 239.71, sandbox: true, hotelConfirmationCode: "test" })
    expect(found?.cancellation.freeUntil).toBe("2026-12-05T12:00:00Z")
    // A booking without our reference (even with none at all) is never taken as ours.
    fetchMock.mockResolvedValueOnce(json({ data: [{ booking_Id: "X", status: "CONFIRMED", retail_rate: "1", currency: "EUR" }] }))
    await expect(findBookingByReference(cfg, "ref-2", new Date())).resolves.toBeNull()
  })

  it("cancels with PUT on the booking and reports the refund", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { bookingId: "BK1", status: "CANCELLED", cancellation_fee: 0, refund_amount: 438, currency: "EUR" }, sandbox: true }))
    const r = await cancelBooking(cfg, "BK1")
    expect(call().method).toBe("PUT")
    expect(call().url.toString()).toBe(`${LITEAPI_BOOK_BASE}/bookings/BK1`)
    expect(r).toEqual({ bookingId: "BK1", status: "CANCELLED", cancellationFee: 0, refundAmount: 438, currency: "EUR", sandbox: true })
  })
})

describe("bookingConfig (sandbox only)", () => {
  it("is sandbox by default with a sand_ key", () => {
    expect(bookingConfig({ LITEAPI_API_KEY: KEY })).toMatchObject({ enabled: true, mode: "sandbox", apiKey: KEY })
  })

  it("refuses live mode, a missing key, and anything that isn't a sandbox key", () => {
    expect(bookingConfig({ LITEAPI_API_KEY: KEY, BOOKING_MODE: "live" })).toMatchObject({ enabled: false })
    expect(bookingConfig({})).toMatchObject({ enabled: false, reason: "LITEAPI_API_KEY is not set." })
    expect(bookingConfig({ LITEAPI_API_KEY: "prod_0123456789" })).toMatchObject({ enabled: false })
    expect(bookingConfig({ LITEAPI_API_KEY: "  " })).toMatchObject({ enabled: false })
  })
})
