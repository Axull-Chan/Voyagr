"use client"

import { motion } from "framer-motion"

import { slideUp, staggerContainer } from "@/lib/motion"

const steps = [
  {
    number: "01",
    title: "Tell us about your trip",
    description:
      "Destination, dates, budget, travel style — a short wizard, not a form to dread.",
  },
  {
    number: "02",
    title: "AI builds your itinerary",
    description:
      "A full day-by-day plan generated in seconds, with food, activities, and transport already worked out.",
  },
  {
    number: "03",
    title: "Refine by chatting",
    description:
      "\"Move this to day 2\", \"add hidden gems\", \"we're travelling with kids\" — the AI adjusts instantly.",
  },
  {
    number: "04",
    title: "Travel with confidence",
    description:
      "Maps, weather, budget, and packing lists all in one place, right up until you leave.",
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y border-border bg-muted/30 px-6 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From idea to itinerary in minutes
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            No blank pages. No spreadsheets. Just a plan you can actually
            follow.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          {steps.map((step) => (
            <motion.div key={step.number} variants={slideUp}>
              <span className="text-sm font-semibold text-primary">
                {step.number}
              </span>
              <h3 className="mt-2 text-sm font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
