import { describe, expect, it } from "vitest"

import { createTripSchema } from "@/features/trips/schemas/trip.schemas"
import { recoverStaleGeneration } from "@/features/trips/services/generation-recovery"
import {
  effectiveTripStatus,
  GENERATION_MAX_DURATION_MS,
  isStaleGeneration,
  regenerateBlockedReason,
  staleGenerationCutoff,
  STALE_GENERATION_AFTER_MS,
  tripRowToCreateInput,
  type TripGenerationRow,
} from "@/features/trips/services/generation-state"

const NOW = Date.parse("2026-11-20T12:00:00.000Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe("stale generation", () => {
  it("is never stale while a request could still be running", () => {
    expect(STALE_GENERATION_AFTER_MS).toBeGreaterThan(GENERATION_MAX_DURATION_MS)
    expect(isStaleGeneration("generating", ago(GENERATION_MAX_DURATION_MS), NOW)).toBe(false)
    expect(isStaleGeneration("generating", ago(STALE_GENERATION_AFTER_MS - 1), NOW)).toBe(false)
  })

  it("is stale once past the threshold, e.g. a request killed at the 150 s limit", () => {
    expect(isStaleGeneration("generating", ago(STALE_GENERATION_AFTER_MS), NOW)).toBe(true)
    expect(isStaleGeneration("generating", ago(24 * 3600_000), NOW)).toBe(true)
  })

  it("treats a missing or unreadable timestamp as recoverable", () => {
    expect(isStaleGeneration("generating", null, NOW)).toBe(true)
    expect(isStaleGeneration("generating", "not a date", NOW)).toBe(true)
  })

  it("only ever applies to generating trips", () => {
    for (const status of ["draft", "ready", "archived"]) {
      expect(isStaleGeneration(status, ago(24 * 3600_000), NOW)).toBe(false)
      expect(effectiveTripStatus(status, ago(24 * 3600_000), NOW)).toBe(status)
    }
  })

  it("shows a stale generation as a draft and a live one as generating", () => {
    expect(effectiveTripStatus("generating", ago(10 * 60_000), NOW)).toBe("draft")
    expect(effectiveTripStatus("generating", ago(30_000), NOW)).toBe("generating")
  })

  it("puts the cutoff exactly the threshold before now", () => {
    expect(staleGenerationCutoff(NOW)).toBe(ago(STALE_GENERATION_AFTER_MS))
  })
})

describe("regenerateBlockedReason", () => {
  it("allows only drafts", () => {
    expect(regenerateBlockedReason("draft")).toBeNull()
    expect(regenerateBlockedReason("generating")).toMatch(/still being generated/)
    expect(regenerateBlockedReason("archived")).toMatch(/Restore/)
    expect(regenerateBlockedReason("ready")).toMatch(/already has an itinerary/)
  })
})

describe("tripRowToCreateInput", () => {
  const row: TripGenerationRow = {
    destination: "Lisbon, Portugal",
    starting_city: null,
    start_date: "2026-11-23",
    end_date: "2026-11-25",
    travelers: 2,
    budget: "1500",
    currency: "EUR",
    travel_style: "balanced",
    interests: ["history", "food"],
    accommodation: "hotel",
    transportation: "public",
    additional_notes: null,
  }

  it("turns a stored trip back into input the creation schema accepts", () => {
    const parsed = createTripSchema.safeParse(tripRowToCreateInput(row))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.budget).toBe(1500)
    expect(parsed.data?.interests).toEqual(["history", "food"])
  })

  it("keeps a missing budget as no budget", () => {
    expect(createTripSchema.safeParse(tripRowToCreateInput({ ...row, budget: null })).data?.budget).toBeNull()
  })

  it("refuses a row missing what generation needs instead of guessing", () => {
    expect(createTripSchema.safeParse(tripRowToCreateInput({ ...row, start_date: null })).success).toBe(false)
    expect(createTripSchema.safeParse(tripRowToCreateInput({ ...row, travel_style: null })).success).toBe(false)
  })
})

describe("recoverStaleGeneration", () => {
  /** A stand-in for the Supabase query builder that records the filters used. */
  function fakeClient(result: { data: unknown; error: unknown }) {
    const calls: [string, ...unknown[]][] = []
    const builder: Record<string, (...args: unknown[]) => unknown> = {}
    for (const method of ["update", "eq", "lt", "select"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, ...args])
        return method === "select" ? Promise.resolve(result) : builder
      }
    }
    const client = {
      from: (table: string) => {
        calls.push(["from", table])
        return builder
      },
    }
    return { client: client as never, calls }
  }

  it("is a compare-and-set on status AND age, scoped to the trip", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "t1" }], error: null })
    await expect(recoverStaleGeneration(client, "t1", NOW)).resolves.toBe(true)
    expect(calls).toEqual([
      ["from", "trips"],
      ["update", { status: "draft" }],
      ["eq", "id", "t1"],
      ["eq", "status", "generating"],
      ["lt", "updated_at", staleGenerationCutoff(NOW)],
      ["select", "id"],
    ])
  })

  it("reports nothing recovered when no row matched", async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(recoverStaleGeneration(client, "t1", NOW)).resolves.toBe(false)
  })

  it("never throws on a database error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } })
    await expect(recoverStaleGeneration(client, "t1", NOW)).resolves.toBe(false)
  })
})
