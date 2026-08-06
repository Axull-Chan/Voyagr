import { Reveal, RevealItem } from "@/components/shared/reveal"
import { HeroDestinations } from "@/features/marketing/components/hero-destinations"

/**
 * The destinations rail, promoted out of the old hero into a strip of its
 * own. It was previously the last item in a long centred hero stack, where
 * it read as decoration; on its own it does a real job — the concrete "pick
 * somewhere and go" step after the film and the product demo.
 */
export function DestinationsSection() {
  return (
    <section className="px-6 pb-16 sm:pb-20">
      {/* Same max-w-5xl as the product section above so the two blocks share
          one left edge; the rail's five cards still fit without scrolling. */}
      <Reveal mode="scroll" className="mx-auto max-w-5xl">
        <RevealItem>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Start with a city
          </p>
        </RevealItem>
        <RevealItem className="mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Somewhere in mind already?
          </h2>
        </RevealItem>
        <RevealItem className="mt-8">
          <HeroDestinations />
        </RevealItem>
      </Reveal>
    </section>
  )
}
