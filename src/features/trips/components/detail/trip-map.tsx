"use client"

import { useEffect, useRef, useState } from "react"
// maplibre-gl v6 ships named exports only; there is no default export.
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl"
import { useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import {
  boundsForMarkers,
  MAP_ATTRIBUTION,
  MAP_STYLE_URL,
  type MapMarker,
} from "@/services/map-service"

import "maplibre-gl/dist/maplibre-gl.css"

interface TripMapProps {
  markers: MapMarker[]
  /** Used when there are no markers to fit. */
  center: { latitude: number; longitude: number } | null
  className?: string
}

// MapLibre decodes vector tiles in a Web Worker that it locates at runtime,
// relative to its own `import.meta.url`. Once bundled that points at
// `/_next/static/chunks/…`, where the worker file doesn't exist, so it 404s to
// Next's HTML error page and the worker never starts — leaving a live canvas
// with markers on it and a permanently blank basemap, since nothing is left to
// decode the tiles. `scripts/copy-maplibre-worker.mjs` publishes the worker to
// this fixed path on predev/prebuild; naming it here takes bundler resolution
// out of the picture. Module scope runs before any map is constructed, and the
// worker pool is only built when the first one is.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")

/**
 * Marker colours by role, so the legend and pins can't drift apart.
 *
 * Field Journal palette (DESIGN.md's map-marker-* components): destination
 * reuses --primary (Pine Blue, the system's identity colour), the other
 * three are a dedicated small set — not a second job for --tertiary, which
 * DESIGN.md reserves for the trip countdown badge alone. These are fixed
 * hex, not theme tokens: a map pin has to stay legible against whatever a
 * tile provider paints under it, unrelated to page light/dark mode.
 */
const MARKER_STYLES: Record<MapMarker["kind"], { color: string; label: string }> = {
  destination: { color: "#587b7f", label: "Destination" },
  hotel: { color: "#A6567E", label: "Stay" },
  restaurant: { color: "#BF6F33", label: "Food" },
  activity: { color: "#3D865A", label: "Activity" },
}

/**
 * The trip map.
 *
 * MapLibre owns its own canvas and mutates it imperatively, so the map is
 * created once and markers are reconciled in a separate effect — rebuilding
 * the map when markers change would flash and lose the user's pan position.
 *
 * Tiles come from OpenFreeMap and the geocoding from Nominatim, both
 * OpenStreetMap-derived, so the ODbL credit is rendered here rather than left
 * to the caller to remember.
 */
export function TripMap({ markers, center, className }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRefs = useRef<Marker[]>([])
  const [failed, setFailed] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const fallbackCentre: [number, number] = center
      ? [center.longitude, center.latitude]
      : [0, 20]

    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container,
        style: MAP_STYLE_URL,
        center: fallbackCentre,
        zoom: center ? 12 : 1,
        // The credit is rendered in our own footer below, which is styled to
        // match the app; MapLibre's default control would duplicate it.
        attributionControl: false,
      })
    } catch {
      // WebGL unavailable (older devices, some VMs, hardened browsers).
      setFailed(true)
      return
    }

    map.addControl(new NavigationControl({ showCompass: false }), "top-right")

    // MapLibre emits `error` for recoverable problems too — a single tile
    // failing, a font missing — and treating those as fatal would swap a
    // working map for an error panel mid-pan. Only a failure *before* the
    // style finishes loading means there is nothing to show.
    let loaded = false
    map.on("load", () => {
      loaded = true
    })
    map.on("error", (event) => {
      if (!loaded) setFailed(true)
      else console.warn("[TripMap] recoverable map error", event.error)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // Created once: `center` only seeds the initial view, and markers are
    // handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of markerRefs.current) marker.remove()
    markerRefs.current = []

    for (const marker of markers) {
      const element = document.createElement("div")
      element.style.cssText = `width:14px;height:14px;border-radius:9999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${MARKER_STYLES[marker.kind].color}`
      element.setAttribute("aria-label", marker.name)

      // `className` is what the themed popup rules in globals.css hang off —
      // MapLibre's own stylesheet paints the panel white and leaves the text
      // colour to the page, which is unreadable in dark mode.
      const popup = new Popup({
        offset: 14,
        closeButton: false,
        className: "trip-map-popup",
      }).setHTML(
        `<strong style="display:block;font-size:12px">${escapeHtml(marker.name)}</strong>` +
          (marker.detail
            ? `<span style="font-size:11px;opacity:.75">${escapeHtml(marker.detail)}</span>`
            : "")
      )

      markerRefs.current.push(
        new Marker({ element })
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(popup)
          .addTo(map)
      )
    }

    const bounds = boundsForMarkers(markers)
    if (bounds) {
      map.fitBounds(bounds, {
        padding: 48,
        maxZoom: 15,
        // Honour reduced motion: an unexpected fly-across is exactly the kind
        // of movement the preference exists to suppress.
        animate: !prefersReducedMotion,
      })
    }
  }, [markers, prefersReducedMotion])

  if (failed) {
    return (
      <div
        className={cn(
          "flex min-h-64 items-center justify-center rounded-xl border border-border bg-muted/30 p-6 text-center",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          The map couldn&apos;t load here. Everything else on this page still works.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        role="application"
        aria-label={`Map of ${markers.length} places on this trip`}
        className="h-64 w-full overflow-hidden rounded-xl border border-border sm:h-72"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(MARKER_STYLES) as MapMarker["kind"][])
            .filter((kind) => markers.some((m) => m.kind === kind))
            .map((kind) => (
              <li
                key={kind}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: MARKER_STYLES[kind].color }}
                />
                {MARKER_STYLES[kind].label}
              </li>
            ))}
        </ul>
        <p className="text-xs text-muted-foreground">{MAP_ATTRIBUTION}</p>
      </div>
    </div>
  )
}

/** Popups take raw HTML, and place names come from user-editable OSM data. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
