import { Reveal, RevealItem } from "@/components/shared/reveal"
import { SectionHeading } from "@/components/shared/section-heading"

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
      className="scroll-mt-16 border-y border-border bg-muted/30 px-6 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="From idea to itinerary in minutes"
          description="No blank pages. No spreadsheets. Just a plan you can actually follow."
        />

        <Reveal className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <RevealItem key={step.number}>
              <span className="text-sm font-semibold text-primary">
                {step.number}
              </span>
              <h3 className="mt-2 text-sm font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.description}
              </p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
