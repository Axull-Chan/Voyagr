"use client"

import { motion } from "framer-motion"

import { slideUp } from "@/lib/motion"

/**
 * Renders as a plain (non-motion) heading so the two lines stay direct
 * participants in the ancestor Reveal's staggerChildren sequence — Framer's
 * variant propagation passes through plain elements and component
 * boundaries alike, it only stops at another motion component with its own
 * variants. (A `RevealItem` here would put a <div> inside the heading, which
 * is invalid HTML — that's why this needs its own component.)
 *
 * An <h2>, not an <h1>: this section sits below the Blue Hour film, whose
 * closing beat carries the page's h1.
 */
export function ProductHeadline() {
  return (
    <h2 className="text-display text-balance text-foreground">
      <motion.span variants={slideUp} className="block">
        Day two,
      </motion.span>
      <motion.span variants={slideUp} className="block">
        already handled.
      </motion.span>
    </h2>
  )
}
