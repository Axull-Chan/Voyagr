import { Reveal, RevealItem } from "@/components/shared/reveal"
import { HeroBackground } from "@/features/marketing/components/hero-background"
import { HeroMockupCard } from "@/features/marketing/components/hero-mockup-card"
import { ProductHeadline } from "@/features/marketing/components/product-headline"

/**
 * The product introduction, directly beneath the Blue Hour film.
 *
 * This was the page's hero until the film took that job, and it deliberately
 * no longer behaves like one: no eyebrow badge, no CTA pair, not centred.
 * The film already states the promise and carries the only "Start planning
 * free" button on the screen — repeating both here made the page introduce
 * itself twice in a row. Its job now is the pace change from atmosphere to
 * concrete product, which is why the itinerary card sits beside the copy at
 * full size instead of under a stack of pitch.
 *
 * No floating flags here on purpose: the motif reads as a deliberate accent
 * exactly because it only happens once on the page (see FeatureFloatingElements,
 * further down) — repeating it at every section would make it wallpaper.
 * `HeroBackground`'s ambient wash isn't the same thing and stays.
 */
export function ProductSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
      />
      <HeroBackground />
      {/* `mode="scroll"`, not `"mount"`: this is below the fold now, so a
          mount-triggered entrance would play through while the reader is
          still up in the film and be over before they arrive. */}
      <Reveal
        mode="scroll"
        // max-w-5xl, not -6xl: the narrower column is what leaves an outer
        // margin wide enough for the floating flags to live in without
        // landing on the copy.
        className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16"
      >
        <div>
          <RevealItem>
            <p className="text-eyebrow text-muted-foreground">What you get</p>
          </RevealItem>
          <div className="mt-4">
            <ProductHeadline />
          </div>
          <RevealItem className="text-supporting mt-5 max-w-md text-muted-foreground">
            A destination and a few preferences is all it takes. Voyagr fills
            in the mornings, the meals and the money — then keeps the whole
            thing in step when plans move.
          </RevealItem>
        </div>

        <RevealItem className="flex justify-center lg:justify-end">
          <HeroMockupCard />
        </RevealItem>
      </Reveal>
    </section>
  )
}
