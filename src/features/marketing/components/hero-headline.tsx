"use client"

import { motion } from "framer-motion"

import { slideUp } from "@/lib/motion"

/**
 * Renders as a plain (non-motion) <h1> so the two lines stay direct
 * participants in the ancestor Reveal's staggerChildren sequence — Framer's
 * variant propagation passes through plain elements and component
 * boundaries alike, it only stops at another motion component with its own
 * variants.
 */
export function HeroHeadline() {
  return (
    <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
      <motion.span variants={slideUp} className="block">
        Plan smarter trips,
      </motion.span>
      <motion.span variants={slideUp} className="block">
        not longer ones.
      </motion.span>
    </h1>
  )
}
