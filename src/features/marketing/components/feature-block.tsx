"use client"

import { motion, useReducedMotion } from "framer-motion"

import { Reveal, RevealItem } from "@/components/shared/reveal"
import { fadeIn, slideInFromLeft, slideInFromRight } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface FeatureBlockProps {
  icon: React.ReactNode
  title: string
  description: string
  align: "left" | "right"
}

/**
 * One "moment" in the feature section's sequential scroll reveal. Each
 * instance is its own `Reveal`, so it triggers independently as *this*
 * block scrolls into view rather than bursting in together with the
 * others — see feature-section.tsx for why. `icon` is a pre-rendered
 * element, not a component reference: the caller (a Server Component)
 * can't pass a lucide component itself across the Client Component
 * boundary — only serializable props or already-rendered elements cross
 * that boundary. The icon slides in from the block's own side
 * (left-aligned blocks from the left, right-aligned from the right) via a
 * raw `motion.div` sharing this `Reveal`'s propagated "visible" state, same
 * mechanism `RevealItem` uses, just a different variant; title/description
 * stay on the standard `RevealItem` (`slideUp`), staggered after the icon
 * by `Reveal`'s own `staggerContainer`.
 */
export function FeatureBlock({
  icon,
  title,
  description,
  align,
}: FeatureBlockProps) {
  const prefersReducedMotion = useReducedMotion()
  const isRight = align === "right"

  return (
    <Reveal
      className={cn(
        "max-w-md text-left",
        isRight ? "sm:ml-auto sm:text-right" : "sm:mr-auto"
      )}
    >
      <motion.div
        variants={
          prefersReducedMotion
            ? fadeIn
            : isRight
              ? slideInFromRight
              : slideInFromLeft
        }
      >
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-xl bg-primary/10",
            isRight && "sm:ml-auto"
          )}
        >
          {icon}
        </div>
      </motion.div>
      <RevealItem className="mt-4">
        <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
      </RevealItem>
      <RevealItem className="mt-2">
        <p className="text-base text-muted-foreground">{description}</p>
      </RevealItem>
    </Reveal>
  )
}
