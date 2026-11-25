import { describe, expect, it } from "vitest"

import { IntegrationError } from "@/integrations/core/errors"
import { statusAfterBook } from "@/lib/bookings/booking-state"
import { classifyBookFailure, prebookFailureMessage } from "@/features/bookings/services/book-outcome"

const err = (kind: ConstructorParameters<typeof IntegrationError>[1], providerCode?: string) =>
  new IntegrationError("LiteAPI", kind, "x", { providerCode })

describe("classifyBookFailure", () => {
  it("records a booking as failed only when the provider clearly refused it", () => {
    for (const code of ["2001", "2013", "4000", "4002", "4003", "4004", "4006", "4007", "40010", "4290"]) {
      const f = classifyBookFailure(err("invalid_response", code))
      expect(f.outcome.kind, code).toBe("declined")
      expect(statusAfterBook(f.outcome as never)).toBe("failed")
    }
  })

  it("never records a possibly-taken booking as failed", () => {
    const maybe = [
      err("unavailable"), // timeout, network, 5xx
      err("unavailable", "2014"), // booking incomplete
      err("unavailable", "5000"),
      err("invalid_response"), // a 200 we couldn't read
      err("invalid_response", "99999"), // a code we don't know
      new Error("socket hang up"),
      "weird",
    ]
    for (const e of maybe) {
      const f = classifyBookFailure(e)
      expect(f.outcome.kind).toBe("unknown")
      expect(statusAfterBook(f.outcome as never)).toBe("pending_confirmation")
    }
  })

  it("treats a reused reference as 'look it up', not success or failure", () => {
    expect(classifyBookFailure(err("invalid_response", "4005")).outcome.kind).toBe("duplicate")
  })
})

describe("prebookFailureMessage", () => {
  it("sends the traveller back to search when the offer is gone", () => {
    expect(prebookFailureMessage(err("invalid_response", "2001"))).toMatchObject({ retryable: false })
    expect(prebookFailureMessage(err("unavailable", "4020"))).toMatchObject({ retryable: false })
  })

  it("lets a timeout be retried", () => {
    expect(prebookFailureMessage(err("invalid_response", "4016"))).toMatchObject({ retryable: true })
    expect(prebookFailureMessage(err("unavailable"))).toMatchObject({ retryable: true })
  })
})
