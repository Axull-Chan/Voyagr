import type { LucideIcon } from "lucide-react"
import {
  CloudSun,
  Coins,
  MapPinned,
  MessageCircle,
  Sparkles,
  Wallet,
} from "lucide-react"

import { SectionHeading } from "@/components/shared/section-heading"
import { FeatureBlock } from "@/features/marketing/components/feature-block"
import { FeatureFloatingElements } from "@/features/marketing/components/feature-floating-elements"

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
        <SectionHeading
          title="Everything you need, nothing you have to build"
          description="One place for the itinerary, the budget, the maps, and the back-and-forth it takes to get a trip right."
        />

        <div className="relative mt-24 flex flex-col gap-28 sm:gap-32">
          <FeatureFloatingElements />
          {features.map((feature, index) => (
            <FeatureBlock
              key={feature.title}
              icon={
                <feature.icon
                  aria-hidden="true"
                  className="size-6 text-primary"
                />
              }
              title={feature.title}
              description={feature.description}
              align={index % 2 === 0 ? "left" : "right"}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
