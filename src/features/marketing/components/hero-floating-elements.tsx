"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Compass, Plane } from "lucide-react"

import {
  CloudIcon,
  FloatingFlag,
  FloatingIcon,
} from "@/components/shared/floating-badge"

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
        style={{ top: "22%", left: "9%" }}
        duration={13}
        delay={1.2}
        range={10}
        xRange={9}
        rotateRange={3}
      >
        <CloudIcon className="size-9 text-foreground/15" />
      </FloatingIcon>
      <FloatingIcon
        style={{ top: "50%", right: "9%" }}
        duration={9}
        delay={2}
        range={12}
        rotateRange={10}
      >
        <Compass className="size-6 text-primary/20" />
      </FloatingIcon>
    </div>
  )
}
