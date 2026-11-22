import Link from "next/link"
import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { SectionHeading } from "@/components/shared/section-heading"
import { cn } from "@/lib/utils"
import { pricingPlans } from "@/lib/billing/plans"

/**
 * Plans come from lib/billing/plans: Free shows the limits the app actually
 * enforces, and paid tiers say "Coming soon" with no price or feature list,
 * since nothing can be bought yet.
 */
export function PricingSection() {
  const tiers = pricingPlans()
  return (
    <section id="pricing" className="scroll-mt-16 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Simple pricing, no surprises"
          description="Voyagr is free today. Paid plans with higher limits are on the way."
        />

        <Reveal className="mt-14 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <RevealItem
              key={tier.id}
              className={cn(
                "relative mx-auto flex w-full max-w-md flex-col rounded-2xl border p-6 lg:max-w-none",
                tier.highlighted
                  ? "border-primary bg-card shadow-lg"
                  : "border-border bg-card"
              )}
            >
              {tier.status === "coming-soon" ? (
                <Badge variant="secondary" className="absolute -top-3 left-6">
                  Coming soon
                </Badge>
              ) : null}
              <h3 className="text-sm font-medium text-foreground">
                {tier.name}
              </h3>
              {tier.price ? (
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.cadence}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-3xl font-semibold text-muted-foreground">Soon</p>
              )}
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
              {tier.note ? (
                <p className="mt-4 text-xs text-muted-foreground">{tier.note}</p>
              ) : null}
              {tier.status === "available" ? (
                <Button
                  className="mt-6 w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  nativeButton={false}
                  render={<Link href="/sign-up" />}
                >
                  Get started
                </Button>
              ) : (
                // Not a dead end disguised as a checkout: nothing to buy yet.
                <Button className="mt-6 w-full" variant="outline" disabled>
                  Coming soon
                </Button>
              )}
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
