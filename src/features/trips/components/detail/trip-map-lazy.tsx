"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

import type { MapMarker } from "@/services/map-service"

/**
 * Loads the map only when it is about to be seen.
 *
 * MapLibre is roughly 250kB — more than the rest of this page combined — and
 * putting it in the initial bundle pushed the trip page to 414kB First Load.
 * Two things keep it out of the critical path:
 *
 *   `ssr: false`, because the library needs `window` and a WebGL canvas, so
 *   there is nothing useful to render on the server; and an IntersectionObserver,
 *   so the download starts when the map approaches the viewport rather than on
 *   page load. A traveller who only reads the first day's plan never pays for it.
 */
const TripMap = dynamic(
  () => import("@/features/trips/components/detail/trip-map").then((m) => m.TripMap),
  {
    ssr: false,
    loading: () => <MapPlaceholder label="Loading map…" />,
  }
)

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex h-64 w-full items-center justify-center rounded-xl border border-border bg-muted/30 sm:h-72"
      // Announced politely rather than assertively: it is a progress note,
      // not something that should interrupt what a screen reader is saying.
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function LazyTripMap({
  markers,
  center,
}: {
  markers: MapMarker[]
  center: { latitude: number; longitude: number } | null
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    // Without IntersectionObserver (very old browsers, some test runners)
    // load immediately — a working map matters more than the saving.
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      // Start fetching a little before it scrolls in, so the map is usually
      // ready by the time it is actually on screen.
      { rootMargin: "300px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={sentinelRef}>
      {shouldLoad ? (
        <TripMap markers={markers} center={center} />
      ) : (
        <MapPlaceholder label="Map loads as you scroll" />
      )}
    </div>
  )
}
