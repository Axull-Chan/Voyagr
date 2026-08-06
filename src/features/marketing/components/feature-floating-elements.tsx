import { Compass } from "lucide-react"

import { FloatingFlag, FloatingIcon } from "@/components/shared/floating-badge"

/**
 * Background decoration for the feature section.
 *
 * Sized for the grid layout, not the tall single column this section used to
 * be: twelve flags spread over ~1500px of stacked "moments" became twelve
 * flags crowded into ~700px once the features became a grid, so the set is
 * down to six. Positions are percentages of the *section*, which is
 * full-bleed — the layer deliberately sits outside the max-w-5xl content
 * wrapper, because inside it the flags land on the cards themselves.
 *
 * `xl` gate for the same reason as the product section's: these live in the
 * margin beside the content column, and that margin only exists once the
 * viewport is wider than the column.
 *
 * No "use client" here — this is a static composition of already-client
 * `FloatingFlag`/`FloatingIcon` instances with literal props, so the
 * boundary is pushed down to them.
 */
export function FeatureFloatingElements() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-[5] hidden xl:block"
    >
      <FloatingFlag
        code="jp"
        size="size-8"
        style={{ top: "12%", left: "3%" }}
        duration={11}
        delay={0}
        xRange={7}
      />
      <FloatingFlag
        code="fr"
        size="size-7"
        style={{ top: "20%", right: "4%" }}
        duration={13}
        delay={1.6}
      />
      <FloatingFlag
        code="ch"
        size="size-7"
        style={{ top: "44%", right: "2%" }}
        duration={9}
        delay={2.4}
        xRange={-6}
      />
      <FloatingFlag
        code="ca"
        size="size-8"
        style={{ top: "58%", left: "4%" }}
        duration={10}
        delay={3.4}
        xRange={6}
      />
      <FloatingFlag
        code="kr"
        size="size-7"
        style={{ top: "78%", right: "5%" }}
        duration={14}
        delay={1.2}
      />
      <FloatingIcon
        style={{ top: "84%", left: "2%" }}
        duration={10}
        delay={1.4}
        rotateRange={10}
      >
        <Compass aria-hidden="true" className="size-6 text-primary/20" />
      </FloatingIcon>
    </div>
  )
}
