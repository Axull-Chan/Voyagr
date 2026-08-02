"use client"

import { motion, useReducedMotion } from "framer-motion"

export function CloudIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.5 5c2.336 0 4.304 1.825 4.48 4.154l.142 1.86 1.867-.012h.092C19.698 11.043 21 12.37 21 14c0 .748-.28 1.452-.783 2H3.28c-.156-.256-.28-.59-.28-1 0-1.074.85-1.953 1.915-1.998.06.007.118.012.178.015l2.66.124-.622-2.587C7.044 10.186 7 9.843 7 9.5 7 7.02 9.02 5 11.5 5m0-2C7.91 3 5 5.91 5 9.5c0 .524.07 1.03.186 1.52C5.123 11.015 5.064 11 5 11c-2.21 0-4 1.79-4 4 0 1.202.54 2.267 1.38 3h18.593C22.196 17.09 23 15.643 23 14c0-2.76-2.24-5-5-5l-.025.002C17.72 5.646 14.922 3 11.5 3z" />
    </svg>
  )
}

interface FloatingIconProps {
  children: React.ReactNode
  style: React.CSSProperties
  duration: number
  delay: number
  range?: number
  xRange?: number
  rotateRange?: number
}

/**
 * Takes a pre-rendered icon element as `children`, not a component
 * reference — callers that are Server Components (e.g.
 * `feature-floating-elements.tsx`) need to render their icon themselves
 * and pass the resulting element down; passing the component reference
 * itself across a Server->Client boundary isn't serializable and throws.
 */
export function FloatingIcon({
  children,
  style,
  duration,
  delay,
  range = 14,
  xRange = 0,
  rotateRange = 6,
}: FloatingIconProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className="absolute"
      style={style}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              y: [0, -range, 0],
              x: xRange ? [0, xRange, 0] : undefined,
              rotate: [-rotateRange, rotateRange, -rotateRange],
            }
      }
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    >
      {children}
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
 * Small circular flag chips — a hero/marketing-page ambient decoration.
 * `circle-flags` SVGs are pre-masked to a circle already; the ring+shadow
 * here is purely to read as a small floating "badge" (à la Mobbin's
 * floating-logo treatment), not to crop anything. Each instance should get
 * its own home position plus a distinct drift path (some purely vertical,
 * some diagonal via `xRange`) so a set of these doesn't read as one shape
 * repeated at different speeds.
 */
export function FloatingFlag({
  code,
  size,
  style,
  duration,
  delay,
  range = 12,
  xRange = 0,
  rotateRange = 5,
}: FloatingFlagProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className="absolute"
      style={style}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              y: [0, -range, 0],
              x: xRange ? [0, xRange, 0] : undefined,
              rotate: [-rotateRange, rotateRange, -rotateRange],
            }
      }
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
