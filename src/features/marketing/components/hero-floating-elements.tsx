"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Compass, Plane } from "lucide-react"

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.5 5c2.336 0 4.304 1.825 4.48 4.154l.142 1.86 1.867-.012h.092C19.698 11.043 21 12.37 21 14c0 .748-.28 1.452-.783 2H3.28c-.156-.256-.28-.59-.28-1 0-1.074.85-1.953 1.915-1.998.06.007.118.012.178.015l2.66.124-.622-2.587C7.044 10.186 7 9.843 7 9.5 7 7.02 9.02 5 11.5 5m0-2C7.91 3 5 5.91 5 9.5c0 .524.07 1.03.186 1.52C5.123 11.015 5.064 11 5 11c-2.21 0-4 1.79-4 4 0 1.202.54 2.267 1.38 3h18.593C22.196 17.09 23 15.643 23 14c0-2.76-2.24-5-5-5l-.025.002C17.72 5.646 14.922 3 11.5 3z" />
    </svg>
  )
}

interface FloatingIconProps {
  icon: React.ComponentType<{ className?: string }>
  className?: string
  style: React.CSSProperties
  duration: number
  delay: number
  range?: number
  xRange?: number
  rotateRange?: number
}

function FloatingIcon({
  icon: Icon,
  className,
  style,
  duration,
  delay,
  range = 14,
  xRange = 0,
  rotateRange = 6,
}: FloatingIconProps) {
  return (
    <motion.div
      className="absolute"
      style={style}
      animate={{
        y: [0, -range, 0],
        x: xRange ? [0, xRange, 0] : undefined,
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    >
      <Icon className={className} />
    </motion.div>
  )
}

interface FloatingFlagProps {
  code: string
  size: string
  style: React.CSSProperties
  duration: number
  delay: number
  range?: number
  xRange?: number
  rotateRange?: number
}

/**
 * Small circular flag chips — the hero's primary ambient decoration.
 * `circle-flags` SVGs are pre-masked to a circle already; the ring+shadow
 * here is purely to read as a small floating "badge" (à la Mobbin's
 * floating-logo hero treatment), not to crop anything. Each instance gets
 * its own home position plus a distinct drift path (some purely vertical,
 * some diagonal via `xRange`) so the set doesn't read as one shape repeated
 * six times at different speeds.
 */
function FloatingFlag({
  code,
  size,
  style,
  duration,
  delay,
  range = 12,
  xRange = 0,
  rotateRange = 5,
}: FloatingFlagProps) {
  return (
    <motion.div
      className="absolute"
      style={style}
      animate={{
        y: [0, -range, 0],
        x: xRange ? [0, xRange, 0] : undefined,
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative
          SVG in an aria-hidden layer; next/image adds no value here */}
      <img
        src={`/flags/${code}.svg`}
        alt=""
        className={`${size} rounded-full opacity-70 shadow-md ring-1 ring-black/5 dark:opacity-60 dark:ring-white/10`}
      />
    </motion.div>
  )
}

/** Lucide's Plane glyph rests at roughly this heading; subtract it so the
 * computed path-tangent rotation lines the icon up with the direction of travel. */
const PLANE_ICON_HEADING = 45

function useFlightPathKeyframes(
  pathRef: React.RefObject<SVGPathElement | null>,
  samples = 24
) {
  const [keyframes, setKeyframes] = useState<{
    x: number[]
    y: number[]
    rotate: number[]
    opacity: number[]
  } | null>(null)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    const length = el.getTotalLength()
    const x: number[] = []
    const y: number[] = []
    const rotate: number[] = []
    const opacity: number[] = []

    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const point = el.getPointAtLength(t * length)
      const ahead = el.getPointAtLength(Math.min(length, t * length + 1))
      x.push(point.x)
      y.push(point.y)
      rotate.push(
        Math.atan2(ahead.y - point.y, ahead.x - point.x) * (180 / Math.PI) -
          PLANE_ICON_HEADING
      )
      opacity.push(t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1)
    }

    setKeyframes({ x, y, rotate, opacity })
  }, [pathRef, samples])

  return keyframes
}

function FlightPath() {
  const pathRef = useRef<SVGPathElement>(null)
  const keyframes = useFlightPathKeyframes(pathRef)

  return (
    <svg
      viewBox="0 0 400 160"
      className="absolute top-6 left-1/2 h-auto w-[34rem] -translate-x-1/2 text-primary/12"
      fill="none"
    >
      <path
        ref={pathRef}
        d="M10,130 C110,10 290,10 390,70"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {keyframes && (
        <motion.g
          animate={{
            x: keyframes.x,
            y: keyframes.y,
            rotate: keyframes.rotate,
            opacity: keyframes.opacity,
          }}
          transition={{
            duration: 13,
            repeat: Infinity,
            repeatDelay: 1.5,
            ease: "linear",
          }}
        >
          <Plane className="size-4 -translate-x-1/2 -translate-y-1/2 text-primary/70" />
        </motion.g>
      )}
    </svg>
  )
}

export function HeroFloatingElements() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-[5] hidden md:block"
    >
      <FlightPath />

      {/* Flags: the primary decoration, spread down both flanks so no two
          sit close enough to read as a pair. */}
      <FloatingFlag
        code="jp"
        size="size-9"
        style={{ top: "8%", left: "6%" }}
        duration={11}
        delay={0}
        xRange={8}
      />
      <FloatingFlag
        code="fr"
        size="size-8"
        style={{ top: "13%", right: "7%" }}
        duration={13}
        delay={1.8}
        xRange={-6}
      />
      <FloatingFlag
        code="ch"
        size="size-7"
        style={{ top: "34%", left: "3%" }}
        duration={9}
        delay={3.2}
      />
      <FloatingFlag
        code="sg"
        size="size-8"
        style={{ top: "30%", right: "3%" }}
        duration={12}
        delay={0.6}
        xRange={5}
      />
      <FloatingFlag
        code="ca"
        size="size-8"
        style={{ top: "64%", left: "5%" }}
        duration={14}
        delay={2.4}
      />
      <FloatingFlag
        code="kr"
        size="size-7"
        style={{ top: "68%", right: "6%" }}
        duration={10}
        delay={4}
        xRange={-7}
      />

      {/* A couple of quiet secondary travel motifs — kept subtle so the
          flags stay the dominant decoration. */}
      <FloatingIcon
        icon={CloudIcon}
        className="size-9 text-foreground/15"
        style={{ top: "22%", left: "9%" }}
        duration={13}
        delay={1.2}
        range={10}
        xRange={9}
        rotateRange={3}
      />
      <FloatingIcon
        icon={Compass}
        className="size-6 text-primary/20"
        style={{ top: "50%", right: "9%" }}
        duration={9}
        delay={2}
        range={12}
        rotateRange={10}
      />
    </div>
  )
}
