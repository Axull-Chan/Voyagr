import { describe, expect, it } from "vitest"

import type { TripDetail } from "@/features/trips/queries/trip-detail"
import {
  TRIP_EXPORT_FORMAT,
  TRIP_EXPORT_VERSION,
  buildTripExport,
  exportFilename,
} from "@/features/trips/services/trip-export"

/**
 * A deliberately minimal fixture: only the columns these tests care about, cast
 * once. The point of the export is what it *removes* and what it *keeps*, not
 * the full row shape.
 */
const detail = {
  trip: {
    id: "trip-1",
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    title: "Lisbon",
    destination: "Lisbon",
    currency: "EUR",
    status: "ready",
  },
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2026-03-01",
      summary: "Arrive",
      dailyCost: 40,
      weather: {
        id: "w-1",
        trip_day_id: "day-1",
        created_at: "2026-01-01T00:00:00Z",
        condition: "Rain",
        source: "mock",
      },
      activities: [
        {
          id: "a-1",
          trip_day_id: "day-1",
          created_at: "2026-01-01T00:00:00Z",
          title: "Walk the Alfama",
          sort_order: 0,
        },
      ],
      restaurants: [
        {
          id: "r-1",
          trip_day_id: "day-1",
          created_at: "2026-01-01T00:00:00Z",
          name: "Cafe Central",
        },
      ],
    },
  ],
  hotels: [
    {
      id: "h-1",
      trip_id: "trip-1",
      created_at: "2026-01-01T00:00:00Z",
      name: "Example hotel in Lisbon",
      source: "mock",
    },
  ],
  transportation: [{ id: "t-1", trip_id: "trip-1", trip_day_id: null, mode: "metro" }],
  budget: [{ id: "b-1", trip_id: "trip-1", category: "food", planned_amount: 100 }],
  expenses: [{ id: "e-1", trip_id: "trip-1", amount: 12 }],
  packing: [{ id: "p-1", trip_id: "trip-1", item: "Passport", is_checked: false }],
} as unknown as TripDetail

describe("buildTripExport", () => {
  const exportedAt = new Date("2026-06-01T10:00:00Z")
  const out = buildTripExport(detail, exportedAt)

  it("is labelled and versioned so a future importer can recognise it", () => {
    expect(out.format).toBe(TRIP_EXPORT_FORMAT)
    expect(out.version).toBe(TRIP_EXPORT_VERSION)
    expect(out.exportedAt).toBe("2026-06-01T10:00:00.000Z")
  })

  it("carries no database ids, foreign keys, timestamps or owner", () => {
    const json = JSON.stringify(out)
    for (const leaked of [
      '"id"',
      '"user_id"',
      '"trip_id"',
      '"trip_day_id"',
      '"created_at"',
      '"updated_at"',
      "user-1",
      "trip-1",
      "day-1",
    ]) {
      expect(json).not.toContain(leaked)
    }
  })

  it("nests children under what they belong to", () => {
    expect(out.days).toHaveLength(1)
    expect(out.days[0]?.activities).toHaveLength(1)
    expect(out.days[0]?.restaurants).toHaveLength(1)
    expect(out.days[0]?.activities[0]).toMatchObject({ title: "Walk the Alfama" })
    expect(out.hotels).toHaveLength(1)
    expect(out.packing).toHaveLength(1)
    expect(out.expenses).toHaveLength(1)
  })

  it("keeps provenance, so an example can't pass as a real reading once exported", () => {
    expect(out.hotels[0]).toMatchObject({ source: "mock" })
    expect(out.days[0]?.weather).toMatchObject({ source: "mock", condition: "Rain" })
  })

  it("handles a day with no weather", () => {
    const bare = {
      ...detail,
      days: [{ ...detail.days[0]!, weather: null }],
    } as unknown as TripDetail
    expect(buildTripExport(bare).days[0]?.weather).toBeNull()
  })
})

describe("exportFilename", () => {
  it("makes a readable slug and appends the extension", () => {
    expect(exportFilename("Trip to Kyoto")).toBe("trip-to-kyoto.voyagr.json")
  })

  it("folds accents rather than dropping the letters", () => {
    expect(exportFilename("Lisboa — São Paulo")).toBe("lisboa-sao-paulo.voyagr.json")
  })

  it("cannot be steered by a hostile title", () => {
    // Path traversal, a quote that would close the header value, and a CRLF
    // that would inject another header — none may survive into the filename.
    for (const title of [
      "../../etc/passwd",
      '"; rm -rf /',
      "x\r\nX-Evil: 1",
      'a"b',
    ]) {
      const name = exportFilename(title)
      expect(name).toMatch(/^[a-z0-9-]+\.voyagr\.json$/)
    }
  })

  it("falls back to a generic name when nothing usable is left", () => {
    expect(exportFilename("東京")).toBe("trip.voyagr.json")
    expect(exportFilename("")).toBe("trip.voyagr.json")
    expect(exportFilename("---")).toBe("trip.voyagr.json")
  })

  it("caps the slug length", () => {
    const name = exportFilename("a".repeat(500))
    expect(name).toBe(`${"a".repeat(60)}.voyagr.json`)
  })
})
