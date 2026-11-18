"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import {
  beatOpacity,
  campaignBeats,
  type FilmBeat,
} from "@/features/film/film-beats"
import { filmLabel, filmSerif } from "@/features/film/film-typography"

/** Frames live in public/film/frames, extracted with ffmpeg at 12fps. */
const FRAME_COUNT = 71
const STATIC_FRAME = 36

const framePath = (index: number) =>
  `/film/frames/frame-${String(index + 1).padStart(3, "0")}.jpg`

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

/**
 * The scroll wheel is the playhead: a pinned <canvas> that paints one
 * pre-extracted JPEG per scroll position, so the film advances only as far
 * as the reader scrolls. Deliberately not a <video> element — a video has
 * its own playback clock, and seeking one per scroll frame stutters badly
 * because browsers throttle `currentTime` seeks to keyframes.
 *
 * Everything per-frame (canvas paint, beat opacity, progress bar, counter)
 * is written imperatively inside one rAF callback rather than through React
 * state — at ~60 updates/sec a state-driven rerender of the overlay tree
 * would jank the scrub for no benefit.
 */
interface ScrollFilmProps {
  /** Which narrative to run over the footage. */
  beats?: FilmBeat[]
  /**
   * Scroll distance the film is stretched over. The campaign page can afford
   * a long, slow read; the landing hero uses less so the product content
   * below it isn't buried.
   */
  scrollLength?: string
  /**
   * Rendered inside the final beat, fading in with it. Made clickable only
   * once that beat is essentially opaque — see the rAF loop.
   */
  finalAction?: React.ReactNode
}

export function ScrollFilm({
  beats = campaignBeats,
  scrollLength = "400svh",
  finalAction,
}: ScrollFilmProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beatRefs = useRef<(HTMLDivElement | null)[]>([])
  const progressRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])

  const [loadedCount, setLoadedCount] = useState(0)
  const [ready, setReady] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const draw = useCallback((index: number) => {
    const canvas = canvasRef.current
    const image = imagesRef.current[index]
    if (!canvas || !image || !image.complete || image.naturalWidth === 0) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Cap DPR at 2 — beyond that we'd be scaling a 1280px source up into a
    // buffer 3x the CSS size for no visible gain and a real paint cost.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    // object-fit: cover, by hand.
    const scale = Math.max(
      width / image.naturalWidth,
      height / image.naturalHeight
    )
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    context.drawImage(
      image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    )
  }, [])

  // Preload every frame up front. A scrub that fetches on demand shows holes
  // wherever the reader outruns the network, which is exactly when they're
  // scrolling fastest.
  useEffect(() => {
    // Reduced motion serves one still (below), so the other 70 frames — about
    // 4.3 MB — would be downloaded for nothing.
    if (prefersReducedMotion) return

    let cancelled = false
    let settled = 0
    const images: HTMLImageElement[] = []

    for (let i = 0; i < FRAME_COUNT; i += 1) {
      const image = new window.Image()
      const onSettle = () => {
        if (cancelled) return
        settled += 1
        setLoadedCount(settled)
        // Paint frame 0 the moment it lands so the pinned panel is never
        // an empty black box while the rest streams in.
        if (i === 0) draw(0)
        if (settled === FRAME_COUNT) setReady(true)
      }
      image.onload = onSettle
      image.onerror = onSettle
      image.src = framePath(i)
      images.push(image)
    }
    imagesRef.current = images

    return () => {
      cancelled = true
    }
  }, [draw, prefersReducedMotion])

  useEffect(() => {
    if (!ready || prefersReducedMotion) return

    let frame = 0
    const update = () => {
      frame = 0
      const section = sectionRef.current
      if (!section) return

      const scrollable = section.offsetHeight - window.innerHeight
      const progress =
        scrollable <= 0
          ? 0
          : clamp(-section.getBoundingClientRect().top / scrollable, 0, 1)

      const index = Math.round(progress * (FRAME_COUNT - 1))
      draw(index)

      beats.forEach((beat, i) => {
        const element = beatRefs.current[i]
        if (!element) return
        const opacity = beatOpacity(beat, progress)
        element.style.opacity = String(opacity)
        // Only the settled beat is clickable — a half-faded CTA sitting over
        // the film would otherwise swallow clicks aimed at nothing.
        element.style.pointerEvents = opacity > 0.95 ? "auto" : "none"
      })
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`
      }
      if (counterRef.current) {
        counterRef.current.textContent = `${String(index + 1).padStart(3, "0")} / ${FRAME_COUNT}`
      }
      if (cueRef.current) {
        cueRef.current.style.opacity = String(clamp(1 - progress * 14, 0, 1))
      }
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ready, prefersReducedMotion, draw, beats])

  // Reduced motion: a scroll-scrubbed film is exactly the large, scroll-
  // coupled movement this preference asks us to drop. Serve one still frame
  // and lay the beats out as ordinary stacked copy instead.
  if (prefersReducedMotion) {
    return (
      <section className="relative isolate overflow-hidden">
        <Image
          src={framePath(STATIC_FRAME)}
          alt="A Tokyo side street at blue hour, steam rising from a yakitori stall beneath Tokyo Tower."
          width={1280}
          height={720}
          priority
          // Without `sizes` Next assumes the width=1280 prop is the display
          // size and offers only 1x/2x, so a 2.6x phone was sent the 3840px
          // rendition of a 1280px source.
          sizes="100vw"
          className="h-[70svh] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-film-bg via-film-bg/40 to-film-bg/70" />
        <div className="relative mx-auto max-w-2xl space-y-10 px-6 py-20 text-center">
          {beats.map((beat) => {
            const Line = beat.isHeading ? "h1" : "p"
            return (
              <div key={beat.kicker}>
                <p className={filmLabel}>{beat.kicker}</p>
                <Line
                  className={cn(
                    filmSerif,
                    "mt-3 text-3xl leading-tight font-light text-film-ink sm:text-4xl"
                  )}
                >
                  {beat.line}
                </Line>
              </div>
            )
          })}
          {finalAction}
        </div>
      </section>
    )
  }

  const percent = Math.round((loadedCount / FRAME_COUNT) * 100)

  return (
    <section
      ref={sectionRef}
      style={{ height: scrollLength }}
      className="relative"
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Full-bleed from `sm` up, but a centered 16:9 band on narrow
            portrait screens. Covering a 390x844 viewport with this 1280x720
            source means a ~2.3x upscale (visibly soft) and crops away the
            two stalls that frame the shot — letterboxing keeps the frame
            pixel-exact and keeps the composition intact. */}
        <div className="absolute inset-0 flex items-start pt-[24vh] sm:items-center sm:pt-0">
          <canvas
            ref={canvasRef}
            aria-label="A slow push down a Tokyo side street at blue hour toward Tokyo Tower, scrubbed by scroll position."
            role="img"
            className="block aspect-video w-full sm:aspect-auto sm:h-full"
          />
        </div>

        {/* Scrim: the beats sit on top of moving footage, and the film's own
            brightness swings as the tower fills more of the frame. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-film-bg/75 via-film-bg/25 to-film-bg/85"
        />

        {/* On narrow screens the film is a letterboxed band, so the beats sit
            in the space beneath it rather than on top of it — over the band
            they'd cover the whole shot. From `sm` the film is full-bleed and
            the beats centre over it. */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-6 pb-40 sm:items-center sm:pb-0">
          {beats.map((beat, index) => {
            const Line = beat.isHeading ? "h1" : "p"
            const isLast = index === beats.length - 1
            return (
              <div
                key={beat.kicker}
                ref={(node) => {
                  beatRefs.current[index] = node
                }}
                // The title card ships visible so it's correct on first paint,
                // before the scroll loop has run even once.
                style={{
                  opacity: index === 0 ? 1 : 0,
                  pointerEvents: index === 0 ? "auto" : "none",
                }}
                className="absolute max-w-3xl text-center"
              >
                {/* Both lines carry a soft shadow and the kicker is lifted off
                    `film-muted`: these sit on moving footage whose brightness
                    swings from near-black asphalt to a lit shopfront, and a
                    flat muted grey vanishes completely over the tower. */}
                <p
                  className={cn(
                    filmLabel,
                    "text-film-ink/70 [text-shadow:0_1px_18px_rgba(0,0,0,0.75)]"
                  )}
                >
                  {beat.kicker}
                </p>
                <Line
                  className={cn(
                    filmSerif,
                    "mt-5 text-4xl leading-[1.1] font-light text-balance text-film-ink [text-shadow:0_2px_30px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-7xl"
                  )}
                >
                  {beat.line}
                </Line>
                {isLast && finalAction}
              </div>
            )
          })}
        </div>

        {/* Playhead furniture — frame counter and a hairline progress rule. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-6xl items-end justify-between px-6 pb-6">
            <span
              ref={counterRef}
              className="font-mono text-[0.7rem] tracking-[0.2em] text-film-muted tabular-nums"
            >
              001 / {FRAME_COUNT}
            </span>
            <div
              ref={cueRef}
              className={cn(filmLabel, "transition-opacity")}
              style={{ opacity: 1 }}
            >
              Scroll to play
            </div>
          </div>
          <div className="h-px w-full bg-film-line">
            <div
              ref={progressRef}
              className="h-px origin-left bg-film-ink"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-film-bg">
            <div className="text-center">
              <p className={filmLabel}>Loading film</p>
              <p className="mt-3 font-mono text-2xl text-film-ink tabular-nums">
                {percent}%
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
