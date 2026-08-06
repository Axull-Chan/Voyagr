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
