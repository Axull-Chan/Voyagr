import { Compass, Globe } from "lucide-react"

import { FloatingFlag, FloatingIcon } from "@/components/shared/floating-badge"

/**
 * Background decoration for the feature section's tall sequential-reveal
 * layout. Positions are percentages of this layer's own height, so they
 * scale automatically with however tall the six-block stack ends up being.
 * Each pair sits on the opposite side from that region's block text
 * (see feature-section.tsx's alternating alignment) so a flag's drift range
 * can never reach into a line of copy. No "use client" here — this is a
 * static composition of already-client `FloatingFlag`/`FloatingIcon`
 * instances with literal props, so the boundary is pushed down to them.
 */
export function FeatureFloatingElements() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-[5] hidden md:block"
    >
      <FloatingFlag
        code="jp"
        size="size-8"
        style={{ top: "4%", right: "6%" }}
        duration={11}
        delay={0}
        xRange={7}
      />
      <FloatingFlag
        code="fr"
        size="size-7"
        style={{ top: "11%", right: "3%" }}
        duration={13}
        delay={1.6}
      />
      <FloatingFlag
        code="ch"
        size="size-7"
        style={{ top: "20%", left: "4%" }}
        duration={9}
        delay={2.4}
        xRange={-6}
      />
      <FloatingFlag
        code="sg"
        size="size-8"
        style={{ top: "27%", left: "7%" }}
        duration={12}
        delay={0.8}
      />
      <FloatingFlag
        code="ca"
        size="size-8"
        style={{ top: "36%", right: "5%" }}
        duration={10}
        delay={3.4}
        xRange={6}
      />
      <FloatingFlag
        code="kr"
        size="size-7"
        style={{ top: "44%", right: "8%" }}
        duration={14}
        delay={1.2}
      />
      <FloatingFlag
        code="it"
        size="size-8"
        style={{ top: "54%", left: "5%" }}
        duration={11}
        delay={2.8}
        xRange={-8}
      />
      <FloatingFlag
        code="de"
        size="size-7"
        style={{ top: "61%", left: "8%" }}
        duration={13}
        delay={0.4}
      />
      <FloatingFlag
        code="nl"
        size="size-8"
        style={{ top: "70%", right: "4%" }}
        duration={9}
        delay={3.8}
      />
      <FloatingFlag
        code="se"
        size="size-7"
        style={{ top: "77%", right: "7%" }}
        duration={12}
        delay={2}
        xRange={-5}
      />
      <FloatingIcon
        style={{ top: "87%", left: "6%" }}
        duration={10}
        delay={1.4}
        rotateRange={10}
      >
        <Compass aria-hidden="true" className="size-6 text-primary/20" />
      </FloatingIcon>
      <FloatingIcon
        style={{ top: "94%", left: "9%" }}
        duration={14}
        delay={3}
        xRange={6}
      >
        <Globe aria-hidden="true" className="size-7 text-foreground/15" />
      </FloatingIcon>
    </div>
  )
}
