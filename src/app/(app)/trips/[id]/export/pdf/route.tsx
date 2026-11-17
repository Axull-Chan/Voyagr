import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"

import { getTripDetail } from "@/features/trips/queries/trip-detail"
import { TripPdfDocument } from "@/features/trips/pdf/trip-pdf-document"
import { buildTripPdfModel } from "@/features/trips/pdf/trip-pdf-model"
import { tripIdSchema } from "@/features/trips/schemas/trip-management.schemas"
import { pdfFilename } from "@/features/trips/services/trip-export"
import { getRates } from "@/services/currency-service"

// The PDF renderer needs Node APIs, so this can never run on the Edge runtime.
export const runtime = "nodejs"

/**
 * GET /trips/:id/export/pdf — the trip as a downloadable PDF.
 *
 * Authentication comes from the middleware (everything under `/trips` is
 * protected) and ownership from RLS inside `getTripDetail`, which 404s for a trip
 * that isn't the caller's — the same arrangement as the JSON export beside it.
 * `no-store` because this is private, per-user data.
 *
 * Exchange rates are fetched exactly as the trip page does (the trip's currency
 * as the base, quotes only for currencies actually used by expenses), so the
 * budget figures here agree with the page. If rates are unavailable the model
 * says how many expenses it could not count rather than quietly leaving them out.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!tripIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 })
  }

  const detail = await getTripDetail(id)

  const quoteCurrencies = [
    ...new Set(detail.expenses.map((e) => e.currency)),
  ].filter((c) => c !== detail.trip.currency)
  const rates =
    quoteCurrencies.length > 0
      ? (await getRates(detail.trip.currency, quoteCurrencies)).data
      : { base: detail.trip.currency, rates: {}, asOf: "" }

  const model = buildTripPdfModel(detail, rates)

  let pdf: Buffer
  try {
    pdf = await renderToBuffer(<TripPdfDocument model={model} />)
  } catch (error) {
    console.error("[trip pdf] render failed", error)
    return NextResponse.json(
      { error: "We couldn't build that PDF. Please try again." },
      { status: 500 }
    )
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(detail.trip.title)}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
