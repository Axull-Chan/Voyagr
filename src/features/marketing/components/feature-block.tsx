import { Reveal, RevealItem } from "@/components/shared/reveal"

interface FeatureBlockProps {
  icon: React.ReactNode
  title: string
  description: string
}

/**
 * One "moment" in the feature section's sequential scroll reveal. Each
 * instance is its own `Reveal`, so it triggers independently as *this*
 * block scrolls into view rather than bursting in together with the
 * others — see feature-section.tsx for why. `icon` is a pre-rendered
 * element, not a component reference: the caller (a Server Component)
 * can't pass a lucide component itself across the Client Component
 * boundary — only serializable props or already-rendered elements cross
 * that boundary. Centered, large title, tight icon->title->description
 * stagger — matches the reference (a short, centered stat line that fades
 * in, not a big alternating-sides "scene").
 */
export function FeatureBlock({ icon, title, description }: FeatureBlockProps) {
  return (
    <Reveal className="mx-auto max-w-lg text-center">
      <RevealItem>
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10">
          {icon}
        </div>
      </RevealItem>
      <RevealItem className="mt-3">
        <h3 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h3>
      </RevealItem>
      <RevealItem className="mt-2">
        <p className="text-base text-muted-foreground">{description}</p>
      </RevealItem>
    </Reveal>
  )
}
