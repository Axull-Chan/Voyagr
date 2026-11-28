import { describe, expect, it } from "vitest"

import { BOOKING_STATUSES } from "@/lib/bookings/booking-state"
import {
  bookingPrice,
  bookingStatusView,
  cancellationText,
  defaultStay,
  nightsBetween,
  priceChangeText,
  showInStaysPanel,
  storedCancellation,
  totalText,
  utcDateTime,
} from "@/features/bookings/services/booking-view"

const NOW = new Date("2026-11-28T12:00:00Z")

describe("money and dates", () => {
  it("counts nights and states a total in plain words", () => {
    expect(nightsBetween("2027-01-12", "2027-01-14")).toBe(2)
    expect(totalText(239.71, "EUR", 2)).toBe("€239.71 total · 2 nights")
    expect(totalText(438, "USD", 1)).toBe("$438 total · 1 night")
  })

  it("shows deadlines in UTC, which is what the provider gives", () => {
    expect(utcDateTime("2026-12-27T09:59:00Z")).toBe("27 Dec 2026, 09:59 UTC")
  })

  it("defaults a stay to the trip's dates, giving a one-day trip one night", () => {
    expect(defaultStay("2027-01-12", "2027-01-14")).toEqual({ checkIn: "2027-01-12", checkOut: "2027-01-14" })
    expect(defaultStay("2027-01-12", "2027-01-12")).toEqual({ checkIn: "2027-01-12", checkOut: "2027-01-13" })
  })
})

describe("cancellation wording", () => {
  it("never calls a non-refundable rate free", () => {
    expect(cancellationText({ refundable: false, freeUntil: "2026-12-27T09:59:00Z" }, NOW)).toEqual({ text: "Non-refundable", tone: "caution" })
    expect(cancellationText(null, NOW).text).toBe("Non-refundable")
  })

  it("names the deadline, and says when it has passed", () => {
    expect(cancellationText({ refundable: true, freeUntil: "2026-12-27T09:59:00Z" }, NOW)).toEqual({
      text: "Free cancellation until 27 Dec 2026, 09:59 UTC",
      tone: "positive",
    })
    expect(cancellationText({ refundable: true, freeUntil: "2026-11-01T00:00:00Z" }, NOW)).toMatchObject({ tone: "caution" })
    expect(cancellationText({ refundable: true, freeUntil: null }, NOW).text).toBe("Free cancellation")
  })

  it("reads the stored policy back, refundable only when it said so", () => {
    expect(storedCancellation({ refundable: false, freeUntil: null }, "2026-12-27T09:59:00Z")).toEqual({ refundable: false, freeUntil: null })
    expect(storedCancellation({ refundable: true }, "2026-12-27T09:59:00Z")).toEqual({ refundable: true, freeUntil: "2026-12-27T09:59:00Z" })
  })
})

describe("price changes", () => {
  it("says nothing when the price held, and the direction when it moved", () => {
    expect(priceChangeText(239.71, 239.71, "EUR")).toBeNull()
    expect(priceChangeText(412, 438, "EUR")).toBe("The price went up from €412 to €438 since you chose this room.")
    expect(priceChangeText(412, 400.5, "EUR")).toMatch(/^The price went down/)
  })

  it("shows the paid price as confirmed only once booked", () => {
    expect(bookingPrice({ status: "booked", final_total: "239.71", prebook_total: 240, quoted_total: 239 })).toEqual({ amount: 239.71, confirmed: true })
    expect(bookingPrice({ status: "prebooked", final_total: null, prebook_total: 240, quoted_total: 239 })).toEqual({ amount: 240, confirmed: false })
    expect(bookingPrice({ status: "room_selected", final_total: null, prebook_total: null, quoted_total: "239" })).toEqual({ amount: 239, confirmed: false })
    // A cancelled booking still has the price it was booked at, but it is no longer a held, paid stay.
    expect(bookingPrice({ status: "cancelled", final_total: 239.71, prebook_total: 239.71, quoted_total: 239.71 })).toMatchObject({ confirmed: false })
  })
})

describe("status wording", () => {
  it("has a label for every state", () => {
    for (const status of BOOKING_STATUSES) expect(bookingStatusView(status).label).not.toBe("Unknown")
  })

  it("never calls an unconfirmed booking failed", () => {
    for (const status of ["booking", "pending_confirmation"]) {
      const v = bookingStatusView(status)
      expect(v.tone).toBe("notice")
      expect(`${v.label} ${v.description}`.toLowerCase()).not.toMatch(/fail|didn't go through|not booked/)
    }
  })

  it("lists held and in-flight bookings in the Stays panel, not dead ones", () => {
    expect(BOOKING_STATUSES.filter(showInStaysPanel)).toEqual(["room_selected", "prebooked", "booking", "pending_confirmation", "booked"])
  })
})
