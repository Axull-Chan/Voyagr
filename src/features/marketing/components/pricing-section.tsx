import Link from "next/link"
import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { SectionHeading } from "@/components/shared/section-heading"
import { cn } from "@/lib/utils"

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For the occasional trip.",
    features: [
      "3 AI itineraries per month",
      "Basic budget tracking",
      "Packing checklist",
    ],
    highlighted: false,
  },
  {
    name: "Explorer",
    price: "$9",
    cadence: "/ month",
    description: "For people who travel often.",
    features: [
      "Unlimited AI itineraries",
      "Full budget & currency tools",
      "Maps, weather & packing",
      "Priority AI travel assistant",
    ],
    highlighted: true,
  },
  {
    name: "Team",
    price: "$24",
    cadence: "/ month",
    description: "For planning with others.",
    features: [
      "Everything in Explorer",
      "Shared trips & collaboration",
      "PDF export",
      "Priority support",
    ],
    highlighted: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-16 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Simple pricing, no surprises"
          description="Start free. Upgrade whenever you're planning more than a couple of trips a year."
        />

        <Reveal className="mt-14 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <RevealItem
              key={tier.name}
              className={cn(
                "relative mx-auto flex w-full max-w-md flex-col rounded-2xl border p-6 lg:max-w-none",
                tier.highlighted
                  ? "border-primary bg-card shadow-lg"
                  : "border-border bg-card"
              )}
            >
              {tier.highlighted && (
                <Badge className="absolute -top-3 left-6">
                  Most popular
                </Badge>
              )}
              <h3 className="text-sm font-medium text-foreground">
                {tier.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-foreground">
                  {tier.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {tier.cadence}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {tier.description}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={tier.highlighted ? "default" : "outline"}
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                Get started
              </Button>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
