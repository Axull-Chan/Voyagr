"use client"

import { motion } from "framer-motion"

import { slideUp } from "@/lib/motion"

/**
 * Renders as a plain (non-motion) heading so the two lines stay direct
 * participants in the ancestor Reveal's staggerChildren sequence — Framer's
 * variant propagation passes through plain elements and component
 * boundaries alike, it only stops at another motion component with its own
 * variants.
 *
 * An <h2>, not an <h1>: this section now sits below the Blue Hour film on
 * the landing page, and the film's closing beat carries the page's h1.
 */
export function HeroHeadline() {
  return (
    <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
      <motion.span variants={slideUp} className="block">
        Plan smarter trips,
      </motion.span>
      <motion.span variants={slideUp} className="block">
        not longer ones.
      </motion.span>
    </h2>
  )
}
