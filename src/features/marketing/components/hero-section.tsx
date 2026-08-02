import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { HeroBackground } from "@/features/marketing/components/hero-background"
import { HeroDestinations } from "@/features/marketing/components/hero-destinations"
import { HeroFloatingElements } from "@/features/marketing/components/hero-floating-elements"
import { HeroHeadline } from "@/features/marketing/components/hero-headline"
import { HeroMockupCard } from "@/features/marketing/components/hero-mockup-card"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
      />
      <HeroBackground />
      <HeroFloatingElements />
      <Reveal mode="mount" className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <RevealItem className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-3.5" />
          AI-powered trip planning
        </RevealItem>
        <HeroHeadline />
        <RevealItem className="max-w-md text-base text-muted-foreground sm:text-lg">
          Voyagr turns a destination and a few preferences into a full
          day-by-day itinerary — budget, weather, and all.
        </RevealItem>
        <RevealItem className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
            Start planning free
            <ArrowRight
              aria-hidden="true"
              className="transition-transform group-hover/button:translate-x-0.5"
            />
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
          <HeroMockupCard />
        </RevealItem>

        <RevealItem className="mt-14 flex w-full justify-center">
          <HeroDestinations />
        </RevealItem>
      </Reveal>
    </section>
  )
}
