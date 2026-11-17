import { renderToBuffer } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"

import { TripPdfDocument } from "@/features/trips/pdf/trip-pdf-document"
import { buildTripPdfModel } from "@/features/trips/pdf/trip-pdf-model"
import { makeDays, makeDetail } from "@/features/trips/pdf/test-fixtures"

/**
 * Smoke tests: the document really renders to a PDF for the shapes of trip the
 * app produces. What the PDF *says* is covered by the model tests; what it
 * *looks like* has to be checked by eye (and was — see CLAUDE.md, Phase 11).
 * These guard the part a refactor can break silently: a renderer exception, an
 * empty file, or a long trip failing to paginate.
 */

const RATES = { base: "EUR", rates: { USD: 1.08 }, asOf: "2026-11-17" }

/** PDF page objects are written in plain text, so they can be counted without a parser. */
function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

async function render(overrides: Record<string, unknown> = {}) {
  const model = buildTripPdfModel(makeDetail(overrides), RATES, new Date("2026-11-17T12:00:00Z"))
  return renderToBuffer(<TripPdfDocument model={model} />)
}

describe("TripPdfDocument", () => {
  it("renders a normal trip to a real PDF", async () => {
    const pdf = await render()
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pdf.length).toBeGreaterThan(3_000)
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(1)
  }, 30_000)

  it("renders a trip with no itinerary, hotel, budget or packing", async () => {
    const pdf = await render({
      days: [], hotels: [], transportation: [], budget: [], expenses: [], packing: [],
      trip: { ...makeDetail().trip, budget: null, additional_notes: null },
    })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  }, 30_000)

  it("paginates a long trip across several pages", async () => {
    const pdf = await render({ days: makeDays(14) })
    expect(pageCount(pdf)).toBeGreaterThan(3)
  }, 60_000)

  it("survives text the standard fonts cannot draw", async () => {
    const days = makeDays(1)
    days[0]!.activities[0]!.title = "浅草寺 Ωmega Я ✓ 😀"
    const pdf = await render({ days })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  }, 30_000)
})
