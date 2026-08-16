import { Reveal, RevealItem } from "@/components/shared/reveal"

interface FeatureBlockProps {
  icon: React.ReactNode
  title: string
  description: string
}

/**
 * One card in the feature grid. Each instance is its own `Reveal`, so it
 * triggers independently as *this* card scrolls into view rather than
 * bursting in together with the others — that accumulating behaviour is
 * worth keeping even though the layout is no longer one tall column.
 *
 * The type is sized for a grid cell, not a full-width "moment": display-size
 * headings made sense when each feature owned an entire screen, but at a
 * third of the width they would wrap to three or four lines each.
 *
 * Deliberately off the shared type scale (globals.css), not an oversight:
 * `text-destination`/`text-day-heading` are close in *size* to this h3's
 * 18px, but both are named and reserved for a specific kind of content
 * (destination names, itinerary day headings) this isn't — borrowing one
 * for a generic feature title would blur what the token means everywhere
 * else it's read. `text-headline` is the right *role* but starts at 1.5rem,
 * which is exactly the wrap-to-three-lines problem above. And the
 * description's role matches `text-supporting` conceptually ("supporting
 * paragraph under a heading"), but that token was sized to pair with
 * `text-headline`/`text-display` (1.5rem+), not this card's 18px h3 — used
 * here it would shrink the heading/body size gap from ~4px to ~1px and
 * flatten the hierarchy it's meant to support. Both stay hand-set.
 *
 * `icon` is a pre-rendered element, not a component reference — the caller
 * is a Server Component, and a lucide component itself can't cross that
 * boundary; only serializable props or already-rendered elements can.
 */
export function FeatureBlock({ icon, title, description }: FeatureBlockProps) {
  return (
    <Reveal className="text-center">
      <RevealItem>
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10">
          {icon}
        </div>
      </RevealItem>
      <RevealItem className="mt-4">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
      </RevealItem>
      <RevealItem className="mt-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </RevealItem>
    </Reveal>
  )
}
