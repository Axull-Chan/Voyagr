"use client"

import { motion, useReducedMotion } from "framer-motion"

import { fadeIn, slideUp, staggerContainer } from "@/lib/motion"

interface RevealProps {
  children: React.ReactNode
  className?: string
  /**
   * "scroll" (default) animates in the first time the element enters the
   * viewport — for below-the-fold marketing sections. "mount" animates
   * immediately when the component mounts — for above-the-fold content
   * like the dashboard, where waiting on a scroll observer would mean the
   * content never animates at all.
   */
  mode?: "mount" | "scroll"
}

export function Reveal({ children, className, mode = "scroll" }: RevealProps) {
  const trigger =
    mode === "mount"
      ? { animate: "visible" as const }
      : {
          whileInView: "visible" as const,
          viewport: { once: true, amount: 0.2 },
        }

  return (
    <motion.div
      initial="hidden"
      variants={staggerContainer}
      className={className}
      {...trigger}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      variants={prefersReducedMotion ? fadeIn : slideUp}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * A nested stagger group with no trigger of its own — it inherits the
 * "visible" state from the nearest ancestor `Reveal` (Framer Motion
 * propagates variants through the tree), so a group of `RevealItem`s inside
 * a `RevealGroup` staggers independently within a larger `Reveal` section.
 */
export function RevealGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div variants={staggerContainer} className={className}>
      {children}
    </motion.div>
  )
}
