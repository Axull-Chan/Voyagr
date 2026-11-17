import { NextResponse } from "next/server"

import { getTripDetail } from "@/features/trips/queries/trip-detail"
import {
  buildTripExport,
  exportFilename,
} from "@/features/trips/services/trip-export"
import { tripIdSchema } from "@/features/trips/schemas/trip-management.schemas"

/**
 * GET /trips/:id/export — the trip as a downloadable JSON file.
 *
 * Authentication comes from the middleware (everything under `/trips` is
 * protected) and ownership from RLS inside `getTripDetail`, which 404s for a
 * trip that isn't the caller's — the same reasoning as the trip page itself.
 * `no-store` because this is private, per-user data and must never be served
 * from a shared cache.
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
  const body = JSON.stringify(buildTripExport(detail), null, 2)

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(detail.trip.title)}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
