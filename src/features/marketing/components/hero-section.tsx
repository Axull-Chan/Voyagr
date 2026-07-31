"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Landmark,
  Sparkles,
  Sunrise,
  TreePine,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fadeIn, slideUp, staggerContainer } from "@/lib/motion"

const itineraryRows = [
  {
    time: "Morning",
    title: "Fushimi Inari Shrine",
    icon: Sunrise,
  },
  {
    time: "Afternoon",
    title: "Arashiyama Bamboo Grove",
    icon: TreePine,
  },
  {
    time: "Evening",
    title: "Pontocho food crawl",
    icon: UtensilsCrossed,
  },
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
      />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
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
          className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
        >
          Plan smarter trips,
          <br />
          not longer ones.
        </motion.h1>
        <motion.p
          variants={slideUp}
          className="max-w-md text-base text-muted-foreground sm:text-lg"
        >
          Voyagr turns a destination and a few preferences into a full
          day-by-day itinerary — budget, weather, and all.
        </motion.p>
        <motion.div
          variants={slideUp}
          className="flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
            Start planning free
            <ArrowRight />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            nativeButton={false}
            render={<Link href="#how-it-works" />}
          >
            See how it works
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        className="mx-auto mt-16 w-full max-w-sm"
      >
        <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Day 2 · Kyoto
            </span>
            <Badge variant="secondary">
              <Landmark />
              ¥18,400 today
            </Badge>
          </div>
          <div className="space-y-4">
            {itineraryRows.map((row) => (
              <div key={row.title} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <row.icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{row.time}</p>
                  <p className="text-sm font-medium text-foreground">
                    {row.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
