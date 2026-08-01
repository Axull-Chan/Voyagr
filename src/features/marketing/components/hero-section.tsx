import Link from "next/link"
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
import { Reveal, RevealItem } from "@/components/shared/reveal"

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
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
      />
      <Reveal mode="mount" className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <RevealItem className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-3.5" />
          AI-powered trip planning
        </RevealItem>
        <RevealItem>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Plan smarter trips,
            <br />
            not longer ones.
          </h1>
        </RevealItem>
        <RevealItem className="max-w-md text-base text-muted-foreground sm:text-lg">
          Voyagr turns a destination and a few preferences into a full
          day-by-day itinerary — budget, weather, and all.
        </RevealItem>
        <RevealItem className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
            Start planning free
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            nativeButton={false}
            render={<Link href="#how-it-works" />}
          >
            See how it works
          </Button>
        </RevealItem>

        <RevealItem className="mt-10 w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
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
        </RevealItem>
      </Reveal>
    </section>
  )
}
