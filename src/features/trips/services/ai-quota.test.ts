import type { SupabaseClient } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { confirmAiQuota, reserveAiQuota } from "@/features/trips/services/ai-quota"
import type { Database } from "@/types/database.types"

type Client = SupabaseClient<Database>

/** A stand-in for the database client: only `rpc` is ever called. */
function fakeClient(rpc: (...args: unknown[]) => unknown) {
  const spy = vi.fn(rpc)
  return { client: { rpc: spy } as unknown as Client, rpc: spy }
}

const now = new Date("2026-11-17T12:00:00Z")
const REAL = { providerId: "gemini", now }

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("reserveAiQuota", () => {
  it("applies no limits to the free mock provider, and never touches the database", async () => {
    const { client, rpc } = fakeClient(() => {
      throw new Error("should not be called")
    })
    const result = await reserveAiQuota(client, "trip_generation", {
      providerId: "mock",
      now,
    })
    expect(result).toEqual({ allowed: true, usageId: null })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("reserves a slot and hands back its id when there is room", async () => {
    const { client } = fakeClient(async () => ({
      data: [{ allowed: true, reason: null, usage_id: 42, used_count: 1, max_allowed: 5, resets_at: null }],
      error: null,
    }))
    expect(await reserveAiQuota(client, "trip_generation", REAL)).toEqual({
      allowed: true,
      usageId: 42,
    })
  })

  it("asks the database for this kind's limits, from the defaults", async () => {
    const { client, rpc } = fakeClient(async () => ({
      data: [{ allowed: true, reason: null, usage_id: 1, used_count: 1, max_allowed: 30, resets_at: null }],
      error: null,
    }))
    await reserveAiQuota(client, "chat_message", REAL)
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", {
      p_kind: "chat_message",
      p_user_limit: 30,
      p_global_limit: 500,
    })
  })

  it("passes along limits overridden by environment variables", async () => {
    vi.stubEnv("AI_LIMIT_TRIPS_PER_USER", "2")
    vi.stubEnv("AI_LIMIT_TRIPS_GLOBAL", "40")
    const { client, rpc } = fakeClient(async () => ({
      data: [{ allowed: true, reason: null, usage_id: 1, used_count: 1, max_allowed: 2, resets_at: null }],
      error: null,
    }))
    await reserveAiQuota(client, "trip_generation", REAL)
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", {
      p_kind: "trip_generation",
      p_user_limit: 2,
      p_global_limit: 40,
    })
  })

  it("refuses with a plain message when the traveller is over their own limit", async () => {
    const resets = new Date(now.getTime() + 2 * 3_600_000).toISOString()
    const { client } = fakeClient(async () => ({
      data: [{ allowed: false, reason: "user", usage_id: null, used_count: 5, max_allowed: 5, resets_at: resets }],
      error: null,
    }))
    const result = await reserveAiQuota(client, "trip_generation", REAL)
    expect(result).toEqual({
      allowed: false,
      message: "You've used all 5 of today's AI-planned trips. You can plan another in about 2 hours.",
    })
  })

  it("refuses with a no-fault message when the shared pool is used up", async () => {
    const { client } = fakeClient(async () => ({
      data: [{ allowed: false, reason: "global", usage_id: null, used_count: 250, max_allowed: 250, resets_at: null }],
      error: null,
    }))
    const result = await reserveAiQuota(client, "trip_generation", REAL)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.message).toContain("across all travellers")
  })

  describe("fails open if the limiter itself is broken", () => {
    it("when the database returns an error (e.g. the migration isn't applied yet)", async () => {
      const { client } = fakeClient(async () => ({
        data: null,
        error: { message: "function public.consume_ai_quota does not exist" },
      }))
      expect(await reserveAiQuota(client, "trip_generation", REAL)).toEqual({
        allowed: true,
        usageId: null,
      })
      expect(console.error).toHaveBeenCalled()
    })

    it("when the call throws", async () => {
      const { client } = fakeClient(async () => {
        throw new Error("connection reset")
      })
      expect(await reserveAiQuota(client, "chat_message", REAL)).toEqual({
        allowed: true,
        usageId: null,
      })
      expect(console.error).toHaveBeenCalled()
    })

    it("when the database answers with no row at all", async () => {
      const { client } = fakeClient(async () => ({ data: [], error: null }))
      expect(await reserveAiQuota(client, "chat_message", REAL)).toEqual({
        allowed: true,
        usageId: null,
      })
    })
  })

  it("does NOT fail open on a genuine refusal, however the reason is spelled", async () => {
    // An unexpected reason string must still block, never allow.
    const { client } = fakeClient(async () => ({
      data: [{ allowed: false, reason: "something-new", usage_id: null, used_count: 5, max_allowed: 5, resets_at: null }],
      error: null,
    }))
    const result = await reserveAiQuota(client, "trip_generation", REAL)
    expect(result.allowed).toBe(false)
  })

  it("allows the request when AI_PROVIDER is unrecognised, leaving the action to report it", async () => {
    vi.stubEnv("AI_PROVIDER", "not-a-provider")
    const { client, rpc } = fakeClient(() => {
      throw new Error("should not be called")
    })
    expect(await reserveAiQuota(client, "trip_generation", { now })).toEqual({
      allowed: true,
      usageId: null,
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe("confirmAiQuota", () => {
  it("does nothing when no slot was reserved", async () => {
    const { client, rpc } = fakeClient(() => {
      throw new Error("should not be called")
    })
    await confirmAiQuota(client, null)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("marks the reserved slot as used", async () => {
    const { client, rpc } = fakeClient(async () => ({ data: true, error: null }))
    await confirmAiQuota(client, 42)
    expect(rpc).toHaveBeenCalledWith("confirm_ai_quota", { p_usage_id: 42 })
  })

  it("never throws, even if the database errors or the call blows up", async () => {
    const errored = fakeClient(async () => ({ data: null, error: { message: "boom" } }))
    await expect(confirmAiQuota(errored.client, 1)).resolves.toBeUndefined()

    const thrown = fakeClient(async () => {
      throw new Error("network down")
    })
    await expect(confirmAiQuota(thrown.client, 1)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
