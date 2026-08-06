import { Cormorant_Garamond } from "next/font/google"

import { cn } from "@/lib/utils"
import { MarketingNavbar } from "@/components/layout/marketing-navbar"
import { MarketingFooter } from "@/components/layout/marketing-footer"
import { FilmHero } from "@/features/film/components/film-hero"
import { HeroSection } from "@/features/marketing/components/hero-section"
import { FeatureSection } from "@/features/marketing/components/feature-section"
import { HowItWorksSection } from "@/features/marketing/components/how-it-works-section"
import { TestimonialsSection } from "@/features/marketing/components/testimonials-section"
import { PricingSection } from "@/features/marketing/components/pricing-section"

/** Only the film hero uses the serif — see the campaign page for the rationale. */
const filmSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-film-serif",
})

export default function LandingPage() {
  return (
    <div className={cn("flex flex-1 flex-col", filmSerif.variable)}>
      <MarketingNavbar overHero />
      <main className="flex-1">
        <FilmHero />
        {/* The original hero, kept as the product introduction directly under
            the film: the film sets the mood and states the promise, this
            says what you actually get and shows the interface. */}
        <HeroSection />
        <FeatureSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
      </main>
      <MarketingFooter />
    </div>
  )
}
