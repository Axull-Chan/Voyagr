"use client"

import { Landmark, Sunrise, TreePine, UtensilsCrossed } from "lucide-react"
import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"

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

export function HeroMockupCard() {
  return (
    <motion.div
      className="relative w-full max-w-sm"
      animate={{ y: [0, -8, 0], rotate: [-0.6, 0.6, -0.6] }}
      transition={{
        duration: 7,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-4 -z-10 rounded-full bg-primary/20 blur-2xl"
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Day 2 · Kyoto
          </span>
          <Badge variant="secondary">
            <Landmark aria-hidden="true" />
            ¥18,400 today
          </Badge>
        </div>
        <div className="space-y-4">
          {itineraryRows.map((row) => (
            <div key={row.title} className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <row.icon aria-hidden="true" className="size-4 text-primary" />
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
  )
}
