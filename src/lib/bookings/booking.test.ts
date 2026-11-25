import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  PREBOOK_EXPIRY_MARGIN_MS,
  bookBlockedReason,
  canTransition,
  isFinalStatus,
  isPrebookExpired,
  prebookPriceDecision,
  statusAfterBook,
  type BookingStatus,
} from "@/lib/bookings/booking-state"
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_BLOCK_MESSAGES,
  bookingBlockReason,
  generatedStayIsPrimary,
  isActiveBooking,
} from "@/lib/bookings/booking-guards"

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261125090000_add_hotel_bookings.sql"), "utf8")
  .replace(/''/g, "'")

describe("state machine", () => {
  it("allows the happy path and nothing that skips a step", () => {
    const path: BookingStatus[] = ["room_selected", "prebooked", "booking", "booked", "cancelled"]
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1]!, path[i]!)).toBe(true)
    expect(canTransition("room_selected", "booked")).toBe(false)
    expect(canTransition("prebooked", "booked")).toBe(false) // must pass through `booking`
    expect(canTransition("booked", "prebooked")).toBe(false)
  })

  it("never lets a possibly-taken booking go back to selecting", () => {
    expect(canTransition("pending_confirmation", "room_selected")).toBe(false)
    expect(canTransition("pending_confirmation", "cancelled")).toBe(false)
  })

  it("treats failed and cancelled as final", () => {
    for (const status of BOOKING_STATUSES) {
      expect(isFinalStatus(status)).toBe(status === "failed" || status === "cancelled")
    }
  })

  it("lists every status and allows exactly the transitions the database trigger allows", () => {
    expect(sql).toContain(`'${BOOKING_STATUSES.join("', '")}'`.replace("'pending_confirmation', ", "'pending_confirmation',\n    "))
    for (const [from, tos] of Object.entries(BOOKING_TRANSITIONS)) {
      if (tos.length === 0) {
        expect(sql).toMatch(new RegExp(`old\\.status in \\('failed', 'cancelled'\\)`))
        continue
      }
      const list = tos.length === 1 ? `new.status = '${tos[0]}'` : `new.status in ('${tos.join("', '")}')`
      expect(sql, from).toContain(`(old.status = '${from}' and ${list})`)
    }
  })
})

describe("between choosing a room and booking it", () => {
  const NOW = new Date("2026-11-25T12:00:00Z")
  const ready = {
    status: "prebooked" as BookingStatus,
    quotedTotal: 412,
    prebookTotal: 412,
    prebookExpiresAt: "2026-11-25T12:10:00Z",
    priceChangeAcceptedAt: null,
  }

  it("compares prices to the cent, in both directions", () => {
    expect(prebookPriceDecision(412, 412.004)).toEqual({ kind: "same" })
    expect(prebookPriceDecision(412, 438)).toEqual({ kind: "changed", from: 412, to: 438, difference: 26 })
    expect(prebookPriceDecision(412, 400.5)).toMatchObject({ kind: "changed", difference: -11.5 })
  })

  it("expires a prebook a margin early, and an unreadable expiry counts as expired", () => {
    expect(isPrebookExpired(null, NOW)).toBe(false)
    expect(isPrebookExpired(new Date(NOW.getTime() + PREBOOK_EXPIRY_MARGIN_MS + 1).toISOString(), NOW)).toBe(false)
    expect(isPrebookExpired(new Date(NOW.getTime() + PREBOOK_EXPIRY_MARGIN_MS).toISOString(), NOW)).toBe(true)
    expect(isPrebookExpired("not a date", NOW)).toBe(true)
  })

  it("lets Book through only for a live prebook at a price the traveller has seen", () => {
    expect(bookBlockedReason(ready, NOW)).toBeNull()
    expect(bookBlockedReason({ ...ready, status: "room_selected" }, NOW)).toBe("not_prebooked")
    expect(bookBlockedReason({ ...ready, prebookTotal: null }, NOW)).toBe("not_prebooked")
    expect(bookBlockedReason({ ...ready, prebookExpiresAt: "2026-11-25T11:00:00Z" }, NOW)).toBe("prebook_expired")
    expect(bookBlockedReason({ ...ready, prebookTotal: 438 }, NOW)).toBe("price_change_not_accepted")
    expect(bookBlockedReason({ ...ready, prebookTotal: 400 }, NOW)).toBe("price_change_not_accepted")
    expect(bookBlockedReason({ ...ready, prebookTotal: 438, priceChangeAcceptedAt: "2026-11-25T11:59:00Z" }, NOW)).toBeNull()
  })

  it("never records an unknown outcome as a failure", () => {
    expect(statusAfterBook({ kind: "confirmed" })).toBe("booked")
    expect(statusAfterBook({ kind: "declined" })).toBe("failed")
    expect(statusAfterBook({ kind: "price_changed" })).toBe("room_selected")
    expect(statusAfterBook({ kind: "unknown" })).toBe("pending_confirmation")
    for (const kind of ["confirmed", "declined", "price_changed", "unknown"] as const) {
      expect(canTransition("booking", statusAfterBook({ kind }))).toBe(true)
    }
  })
})

describe("active-booking guards", () => {
  const TODAY = "2026-11-25"

  it("counts in-flight, unconfirmed and booked stays until check-out day ends", () => {
    expect(isActiveBooking({ status: "booked", check_out: TODAY }, TODAY)).toBe(true)
    expect(isActiveBooking({ status: "booked", check_out: "2026-11-24" }, TODAY)).toBe(false)
    expect(isActiveBooking({ status: "pending_confirmation", check_out: "2026-12-01" }, TODAY)).toBe(true)
    expect(isActiveBooking({ status: "booking", check_out: "2026-12-01" }, TODAY)).toBe(true)
    for (const status of ["room_selected", "prebooked", "failed", "cancelled"]) {
      expect(isActiveBooking({ status, check_out: "2026-12-01" }, TODAY)).toBe(false)
    }
  })

  it("refuses with the action's own message, only when something is active", () => {
    const active = [{ status: "cancelled", check_out: "2026-12-01" }, { status: "booked", check_out: "2026-12-01" }]
    expect(bookingBlockReason("shiftDates", active, TODAY)).toBe(BOOKING_BLOCK_MESSAGES.shiftDates)
    expect(bookingBlockReason("deleteTrip", active, TODAY)).toBe(BOOKING_BLOCK_MESSAGES.deleteTrip)
    expect(bookingBlockReason("deleteTrip", [active[0]!], TODAY)).toBeNull()
    expect(bookingBlockReason("deleteTrip", [], TODAY)).toBeNull()
  })

  it("matches the database: same statuses, same date rule, same words", () => {
    expect(sql).toContain(`p_status in ('${ACTIVE_BOOKING_STATUSES.join("', '")}')`)
    expect(sql).toContain("and p_check_out >= current_date")
    expect(sql).toContain(`b.status in ('${ACTIVE_BOOKING_STATUSES.join("', '")}')`)
    for (const message of Object.values(BOOKING_BLOCK_MESSAGES)) expect(sql).toContain(message)
  })

  it("never makes a generated stay primary over a booked one", () => {
    expect(generatedStayIsPrimary(true, false)).toBe(true)
    expect(generatedStayIsPrimary(true, true)).toBe(false)
    expect(generatedStayIsPrimary(false, false)).toBe(false)
  })
})
