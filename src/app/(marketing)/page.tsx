import { MarketingNavbar } from "@/components/layout/marketing-navbar"
import { MarketingFooter } from "@/components/layout/marketing-footer"
import { HeroSection } from "@/features/marketing/components/hero-section"
import { FeatureSection } from "@/features/marketing/components/feature-section"
import { HowItWorksSection } from "@/features/marketing/components/how-it-works-section"
import { TestimonialsSection } from "@/features/marketing/components/testimonials-section"
import { PricingSection } from "@/features/marketing/components/pricing-section"

export default function LandingPage() {
  return (
    <>
      <MarketingNavbar />
      <main className="flex-1">
        <HeroSection />
        <FeatureSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
      </main>
      <MarketingFooter />
    </>
  )
}
