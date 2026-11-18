import { cn } from "@/lib/utils"
import { filmSerifFont } from "@/fonts/film-serif"
import { MarketingNavbar } from "@/components/layout/marketing-navbar"
import { MarketingFooter } from "@/components/layout/marketing-footer"
import { FilmHero } from "@/features/film/components/film-hero"
import { ProductSection } from "@/features/marketing/components/product-section"
import { DestinationsSection } from "@/features/marketing/components/destinations-section"
import { FeatureSection } from "@/features/marketing/components/feature-section"
import { HowItWorksSection } from "@/features/marketing/components/how-it-works-section"
import { PricingSection } from "@/features/marketing/components/pricing-section"

export default function LandingPage() {
  return (
    <div className={cn("flex flex-1 flex-col", filmSerifFont.variable)}>
      <MarketingNavbar overHero />
      <main className="flex-1">
        <FilmHero />
        {/* The film sets the mood and carries the one CTA; these two say what
            you actually get and where you'd start. Split out of the old hero
            so neither repeats the film's pitch — see product-section.tsx. */}
        <ProductSection />
        <DestinationsSection />
        <FeatureSection />
        <HowItWorksSection />
        <PricingSection />
      </main>
      <MarketingFooter />
    </div>
  )
}
