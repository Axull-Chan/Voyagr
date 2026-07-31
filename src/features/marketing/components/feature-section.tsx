"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import {
  CloudSun,
  Coins,
  MapPinned,
  MessageCircle,
  Sparkles,
  Wallet,
} from "lucide-react"

import { slideUp, staggerContainer } from "@/lib/motion"

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Sparkles,
    title: "AI itinerary generation",
    description:
      "Tell us where you're headed and AI builds a full day-by-day plan in seconds — mornings, afternoons, and evenings included.",
  },
  {
    icon: Wallet,
    title: "Smart budget tracking",
    description:
      "See exactly where your money goes, with automatic breakdowns across hotels, food, activities, and transport.",
  },
  {
    icon: MapPinned,
    title: "Live maps & routes",
    description:
      "Every hotel, restaurant, and attraction pinned on a map, with travel times and routes between them.",
  },
  {
    icon: CloudSun,
    title: "Weather-aware packing",
    description:
      "Packing lists that adapt to the forecast, season, and what you've actually got planned.",
  },
  {
    icon: Coins,
    title: "Real-time currency",
    description:
      "Live conversion for your whole trip and each day, so you always know what you're really spending.",
  },
  {
    icon: MessageCircle,
    title: "AI travel assistant",
    description:
      "Keep chatting with AI to tweak your itinerary any time — \"move this to day 2\", \"add hidden gems\", done.",
  },
]

export function FeatureSection() {
  return (
    <section id="features" className="scroll-mt-16 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need, nothing you have to build
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            One place for the itinerary, the budget, the maps, and the
            back-and-forth it takes to get a trip right.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={slideUp}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
