import { describe, expect, it, vi } from "vitest"

import {
  AI_LIMIT_ENV,
  AI_RESERVATION_WINDOW_MS,
  AI_USAGE_WINDOW_MS,
  DEFAULT_AI_LIMITS,
  countActiveUsage,
  countsTowardLimit,
  describeQuotaBlock,
  describeRemaining,
  formatWait,
  getAiLimits,
  remainingAllowance,
} from "@/lib/ai/usage-limits"

const MIN = 60_000
const HOUR = 60 * MIN

describe("getAiLimits", () => {
  it("uses the defaults when nothing is configured", () => {
    expect(getAiLimits("trip_generation", {})).toEqual(DEFAULT_AI_LIMITS.trip_generation)
    expect(getAiLimits("chat_message", {})).toEqual(DEFAULT_AI_LIMITS.chat_message)
  })

  it("keeps the global ceilings inside the free-tier budget they were sized for", () => {
    // ~1,500 requests/day on the free tier, and a call can be retried once, so
    // every unit of global allowance can cost two requests.
    const { trip_generation: t, chat_message: c } = DEFAULT_AI_LIMITS
    expect((t.global + c.global) * 2).toBeLessThanOrEqual(1500)
    // And one person can never be allowed more than the whole pool.
    expect(t.perUser).toBeLessThan(t.global)
    expect(c.perUser).toBeLessThan(c.global)
  })

  it("reads each limit from its own environment variable", () => {
    const env = {
      [AI_LIMIT_ENV.trip_generation.perUser]: "3",
      [AI_LIMIT_ENV.trip_generation.global]: "100",
      [AI_LIMIT_ENV.chat_message.perUser]: "12",
      [AI_LIMIT_ENV.chat_message.global]: "200",
    }
    expect(getAiLimits("trip_generation", env)).toEqual({ perUser: 3, global: 100 })
    expect(getAiLimits("chat_message", env)).toEqual({ perUser: 12, global: 200 })
  })

  it("lets one variable be set without disturbing the other", () => {
    const env = { [AI_LIMIT_ENV.trip_generation.perUser]: "9" }
    expect(getAiLimits("trip_generation", env)).toEqual({
      perUser: 9,
      global: DEFAULT_AI_LIMITS.trip_generation.global,
    })
  })

  it("treats blank and whitespace-padded values sensibly", () => {
    const blank = { [AI_LIMIT_ENV.trip_generation.perUser]: "   " }
    expect(getAiLimits("trip_generation", blank).perUser).toBe(5)
    const padded = { [AI_LIMIT_ENV.trip_generation.perUser]: " 7 " }
    expect(getAiLimits("trip_generation", padded).perUser).toBe(7)
  })

  it.each(["abc", "0", "-3", "2.5", "100001", "1e9", "NaN"])(
    "falls back to the default, and warns, for the unusable value %s",
    (bad) => {
      const warn = vi.fn()
      const limits = getAiLimits(
        "trip_generation",
        { [AI_LIMIT_ENV.trip_generation.perUser]: bad },
        warn
      )
      // A typo must never turn protection OFF: the restrictive default applies.
      expect(limits.perUser).toBe(DEFAULT_AI_LIMITS.trip_generation.perUser)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain(AI_LIMIT_ENV.trip_generation.perUser)
    }
  )
})

describe("formatWait", () => {
  it("rounds UP, so nobody is told to come back too early", () => {
    expect(formatWait(30_000)).toBe("in a minute")
    expect(formatWait(MIN)).toBe("in a minute")
    expect(formatWait(MIN + 1)).toBe("in about 2 minutes")
    expect(formatWait(29 * MIN)).toBe("in about 29 minutes")
    expect(formatWait(59.5 * MIN)).toBe("in about an hour")
    expect(formatWait(HOUR)).toBe("in about an hour")
    expect(formatWait(HOUR + 1)).toBe("in about 2 hours")
    expect(formatWait(3 * HOUR)).toBe("in about 3 hours")
    expect(formatWait(23.2 * HOUR)).toBe("in about 24 hours")
  })

  it("copes with a time that has already passed or is not a number", () => {
    expect(formatWait(0)).toBe("in a moment")
    expect(formatWait(-5 * MIN)).toBe("in a moment")
    expect(formatWait(Number.NaN)).toBe("in a moment")
  })
})

describe("describeQuotaBlock", () => {
  const now = new Date("2026-11-17T12:00:00Z")
  const in3h = new Date(now.getTime() + 3 * HOUR).toISOString()

  it("tells a traveller over their trip limit how many they had and when to return", () => {
    expect(
      describeQuotaBlock("trip_generation", { reason: "user", resetsAt: in3h, max: 5 }, now)
    ).toBe("You've used all 5 of today's AI-planned trips. You can plan another in about 3 hours.")
  })

  it("words the chat limit as messages, not trips", () => {
    expect(
      describeQuotaBlock("chat_message", { reason: "user", resetsAt: in3h, max: 30 }, now)
    ).toBe("You've reached today's limit of 30 assistant messages. You can send another in about 3 hours.")
  })

  it("says the global limit is nobody's fault and doesn't expose a number", () => {
    for (const kind of ["trip_generation", "chat_message"] as const) {
      const message = describeQuotaBlock(kind, { reason: "global", resetsAt: in3h, max: 250 }, now)
      expect(message).toContain("across all travellers")
      expect(message).toContain("in about 3 hours")
      expect(message).not.toContain("250")
    }
  })

  it("falls back to 'later' when the reset time is unknown or unreadable", () => {
    expect(
      describeQuotaBlock("trip_generation", { reason: "user", resetsAt: null, max: 5 }, now)
    ).toContain("another later.")
    expect(
      describeQuotaBlock("trip_generation", { reason: "user", resetsAt: "garbage", max: 5 }, now)
    ).toContain("another later.")
  })

  it("says 'in a moment' when the slot is already free", () => {
    const past = new Date(now.getTime() - MIN).toISOString()
    expect(
      describeQuotaBlock("chat_message", { reason: "user", resetsAt: past, max: 30 }, now)
    ).toContain("in a moment")
  })
})

describe("the 'N left today' hint", () => {
  const now = new Date("2026-11-18T12:00:00Z")
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  describe("countsTowardLimit (mirrors consume_ai_quota)", () => {
    it("counts a confirmed use for 24 hours, and not at or past the boundary", () => {
      expect(countsTowardLimit({ status: "ok", created_at: ago(HOUR) }, now)).toBe(true)
      expect(countsTowardLimit({ status: "ok", created_at: ago(24 * HOUR - 1) }, now)).toBe(true)
      expect(countsTowardLimit({ status: "ok", created_at: ago(24 * HOUR) }, now)).toBe(false)
      expect(countsTowardLimit({ status: "ok", created_at: ago(25 * HOUR) }, now)).toBe(false)
    })

    it("counts an unconfirmed reservation for only 3 minutes", () => {
      expect(countsTowardLimit({ status: "started", created_at: ago(MIN) }, now)).toBe(true)
      expect(countsTowardLimit({ status: "started", created_at: ago(3 * MIN - 1) }, now)).toBe(true)
      expect(countsTowardLimit({ status: "started", created_at: ago(3 * MIN) }, now)).toBe(false)
      // The failure this guards: an hour-old reservation that was never confirmed
      // (the model call failed) must not eat an allowance.
      expect(countsTowardLimit({ status: "started", created_at: ago(HOUR) }, now)).toBe(false)
    })

    it("counts nothing it does not recognise", () => {
      expect(countsTowardLimit({ status: "refunded", created_at: ago(MIN) }, now)).toBe(false)
      expect(countsTowardLimit({ status: "ok", created_at: "garbage" }, now)).toBe(false)
    })
  })

  it("keeps the windows the SQL uses", () => {
    expect(AI_USAGE_WINDOW_MS).toBe(24 * HOUR)
    expect(AI_RESERVATION_WINDOW_MS).toBe(3 * MIN)
  })

  it("counts only the rows that still count", () => {
    const rows = [
      { status: "ok", created_at: ago(HOUR) },
      { status: "ok", created_at: ago(30 * HOUR) },
      { status: "started", created_at: ago(MIN) },
      { status: "started", created_at: ago(10 * MIN) },
    ]
    expect(countActiveUsage(rows, now)).toBe(2)
    expect(countActiveUsage([], now)).toBe(0)
  })

  it("never reports a negative allowance", () => {
    expect(remainingAllowance(5, 2)).toBe(3)
    expect(remainingAllowance(5, 5)).toBe(0)
    expect(remainingAllowance(5, 9)).toBe(0)
  })

  it("words the caption per kind, and says so plainly at zero", () => {
    expect(describeRemaining("trip_generation", { remaining: 3, max: 5 })).toBe(
      "3 of 5 trips left today"
    )
    expect(describeRemaining("chat_message", { remaining: 24, max: 30 })).toBe(
      "24 of 30 messages left today"
    )
    expect(describeRemaining("trip_generation", { remaining: 0, max: 5 })).toBe(
      "No trips left today"
    )
    expect(describeRemaining("chat_message", { remaining: 0, max: 30 })).toBe(
      "No messages left today"
    )
  })
})
