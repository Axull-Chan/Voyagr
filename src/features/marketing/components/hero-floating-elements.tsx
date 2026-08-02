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

function BoardingPassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
      <path d="M148.996,284.914c-0.195-0.415,0.05-0.879,0.493-1c0.358-0.099,0.698-0.294,0.979-0.596l0.931-1c0.805-0.865,0.988-2.14,0.459-3.196c-0.911-1.818-3.385-2.112-4.696-0.559l-0.499,0.591c-0.091,0.107-0.151,0.23-0.218,0.351l-6.769-14.345c-0.112-0.238-0.085-0.52,0.071-0.731l1.333-1.81c0,0,11.54-16.777,5.223-20.346c-6.091-3.441-15.656,10.966-15.656,10.966l-3.366,4.681c-0.151,0.209-0.403,0.322-0.66,0.294l-16.615-1.827c0.013-0.016,0.031-0.028,0.044-0.045l0.647-0.879c1.09-1.478,0.192-3.582-1.628-3.818l-0.717-0.093c-0.886-0.115-1.762,0.27-2.277,0.999l-1.118,1.586c-0.203,0.287-0.301,0.604-0.311,0.917c-0.013,0.405-0.383,0.702-0.786,0.658l-15.599-1.715c-0.232-0.025-0.462,0.063-0.616,0.239l-4.247,4.818c-0.341,0.385-0.176,0.993,0.313,1.154l11.949,3.954l6.929,2.293v-0.001l14.986,4.959l-11.764,16.357c-0.111,0.154-0.28,0.259-0.469,0.289l-25.171,4.041c-0.348,0.055-0.604,0.355-0.604,0.708l0.002,3.648c0,0.351,0.253,0.649,0.599,0.707l11.65,1.954l11.464,1.923c0.243,0.041,0.448,0.204,0.543,0.432l8.687,20.855c0.111,0.268,0.373,0.442,0.663,0.441l3.28-0.001c0.412-0.001,0.74-0.348,0.716-0.76l-1.435-24.701c-0.01-0.17,0.042-0.337,0.145-0.473l14.239-18.862l21.612,28.378c0.312,0.409,0.94,0.367,1.194-0.08l3.175-5.584c0.115-0.203,0.125-0.449,0.025-0.66L148.996,284.914z" />
      <path d="M182.118,238.638l125.157-22.947c3.667-0.673,6.094-4.189,5.422-7.856c-0.674-3.668-4.189-6.096-7.855-5.422l-125.158,22.947c-3.667,0.672-6.094,4.189-5.422,7.855c0.598,3.257,3.436,5.535,6.631,5.535C181.297,238.75,181.706,238.713,182.118,238.638z" />
      <path d="M187.454,278.314l125.839-23.072c3.668-0.672,6.095-4.189,5.423-7.855c-0.673-3.668-4.186-6.094-7.856-5.423l-125.839,23.073c-3.667,0.672-6.095,4.189-5.422,7.855c0.597,3.257,3.436,5.535,6.631,5.535C186.633,278.428,187.043,278.391,187.454,278.314z" />
      <path d="M319.066,281.4l-127.772,23.427c-3.668,0.673-6.095,4.19-5.423,7.856c0.598,3.256,3.436,5.534,6.632,5.534c0.403,0,0.813-0.037,1.225-0.112L321.5,294.679c3.668-0.673,6.095-4.19,5.423-7.856C326.25,283.154,322.732,280.73,319.066,281.4z" />
      <path d="M485.432,283.566L461.874,155.08c-3.204-17.47-20.023-29.087-37.496-25.877l-85.105,15.604c0,0,0,0-0.001,0c0,0,0,0-0.001,0l-286.825,52.59c-17.473,3.203-29.08,20.024-25.877,37.495L50.126,363.38c2.846,15.517,16.429,26.409,31.673,26.407c1.919,0,3.869-0.172,5.823-0.531l286.825-52.589c0.001,0,0.002,0,0.002,0s0.001,0,0.002,0l85.104-15.604C477.027,317.859,488.635,301.038,485.432,283.566z M370.92,317.43c-3.434,0.629-5.744,3.758-5.477,7.164L85.188,375.979c-10.146,1.862-19.922-4.883-21.784-15.033L39.847,232.459c-0.901-4.918,0.167-9.893,3.005-14.006c2.84-4.114,7.111-6.876,12.027-7.777l280.188-51.372l0.243,1.327c0.598,3.256,3.436,5.534,6.632,5.534c0.403,0,0.813-0.037,1.225-0.112h0.001l2.435,13.278l0,0c-3.668,0.673-6.096,4.19-5.423,7.856l1.461,7.969c0.597,3.256,3.436,5.533,6.631,5.533c0.403,0,0.813-0.036,1.225-0.111c0.001,0,0.001,0,0.002,0l2.435,13.278c-3.668,0.673-6.095,4.19-5.422,7.856l1.46,7.967c0.598,3.256,3.437,5.534,6.632,5.534c0.403,0,0.813-0.037,1.225-0.112c0,0,0,0,0.001,0l2.435,13.279l0,0c-3.668,0.672-6.096,4.189-5.423,7.855l1.461,7.969c0.597,3.256,3.436,5.534,6.631,5.534c0.403,0,0.813-0.037,1.225-0.112c0.001,0,0.001,0,0.002,0l2.435,13.279c-3.668,0.672-6.095,4.189-5.423,7.855l1.462,7.967c0.597,3.256,3.436,5.535,6.631,5.535c0.403,0,0.813-0.037,1.225-0.113c0,0,0,0,0.001,0l2.435,13.279C370.921,317.43,370.921,317.43,370.92,317.43z M380.195,196.34l-2.794-15.236c-0.526-2.871,1.375-5.627,4.247-6.154l35.631-6.532c2.873-0.526,5.628,1.375,6.154,4.247l2.794,15.235c0.526,2.873-1.375,5.628-4.247,6.155l-35.631,6.532C383.477,201.113,380.722,199.212,380.195,196.34z M388.708,242.771l-2.793-15.235c-0.526-2.872,1.374-5.628,4.247-6.155l35.631-6.532c2.872-0.526,5.628,1.375,6.154,4.247l2.794,15.235c0.526,2.872-1.376,5.628-4.247,6.155l-35.632,6.532C391.99,247.545,389.234,245.644,388.708,242.771z M439.007,286.918l-35.631,6.532c-2.872,0.526-5.628-1.375-6.154-4.247l-2.794-15.236c-0.526-2.871,1.375-5.627,4.247-6.153l35.632-6.534c2.872-0.525,5.627,1.376,6.154,4.248l2.793,15.236C443.781,283.635,441.879,286.391,439.007,286.918z" />
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
  rotateRange?: number
}

function FloatingIcon({
  icon: Icon,
  className,
  style,
  duration,
  delay,
  range = 14,
  rotateRange = 6,
}: FloatingIconProps) {
  return (
    <motion.div
      className="absolute"
      style={style}
      animate={{
        y: [0, -range, 0],
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
      <FloatingIcon
        icon={CloudIcon}
        className="size-10 text-foreground/20"
        style={{ top: "10%", left: "6%" }}
        duration={13}
        delay={0}
        range={10}
        rotateRange={3}
      />
      <FloatingIcon
        icon={CloudIcon}
        className="size-7 text-foreground/15"
        style={{ top: "16%", right: "9%" }}
        duration={10}
        delay={2.2}
        range={8}
        rotateRange={3}
      />
      <FloatingIcon
        icon={Compass}
        className="size-6 text-primary/25"
        style={{ top: "58%", right: "5%" }}
        duration={9}
        delay={1}
        range={12}
        rotateRange={10}
      />
      <FloatingIcon
        icon={BoardingPassIcon}
        className="size-8 text-primary/20"
        style={{ top: "62%", left: "5%" }}
        duration={14}
        delay={3.5}
        range={14}
        rotateRange={5}
      />
    </div>
  )
}
