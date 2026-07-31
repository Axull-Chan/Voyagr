"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MarketingNavbar } from "@/components/layout/marketing-navbar"
import { fadeIn, slideUp, staggerContainer } from "@/lib/motion"

export default function LandingPage() {
  return (
    <>
      <MarketingNavbar />
      <main className="flex flex-1 items-center justify-center px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex max-w-2xl flex-col items-center gap-6 py-24 text-center"
        >
          <motion.div
            variants={fadeIn}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <Sparkles className="size-3.5" />
            AI-powered trip planning
          </motion.div>
          <motion.h1
            variants={slideUp}
            className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
          >
            Plan smarter trips,
            <br />
            not longer ones.
          </motion.h1>
          <motion.p
            variants={slideUp}
            className="max-w-md text-base text-muted-foreground"
          >
            Voyagr turns a destination and a few preferences into a full
            day-by-day itinerary — budget, weather, and all.
          </motion.p>
          <motion.div variants={slideUp}>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/sign-up" />}
            >
              Start planning free
              <ArrowRight />
            </Button>
          </motion.div>
        </motion.div>
      </main>
    </>
  )
}
