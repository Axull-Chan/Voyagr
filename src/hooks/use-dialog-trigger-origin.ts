"use client"

import { useCallback, useState } from "react"

export interface DialogOrigin {
  x: string
  y: string
}

const CENTER: DialogOrigin = { x: "50%", y: "50%" }

// A modest range, not the full 0–100%, so the bias always reads as "grew
// from roughly here" rather than anchoring hard to a screen edge/corner.
const MIN_PERCENT = 35
const MAX_PERCENT = 65

function biasedPercent(fraction: number): string {
  const clamped = Math.min(1, Math.max(0, fraction))
  return `${Math.round(MIN_PERCENT + clamped * (MAX_PERCENT - MIN_PERCENT))}%`
}

/**
 * Gives a Dialog/Sheet a sense of where it was opened from, without a full
 * FLIP-style position animation (that needs the popup's own rendered size
 * before it exists, and reads as a much more dramatic effect than "slight
 * positional continuity" calls for). Captures the trigger's centre at the
 * moment it's clicked, and derives a `transform-origin` bias from its
 * position in the viewport — not a mathematically precise anchor, just
 * enough that a dialog opened from the top-right doesn't scale up from
 * dead centre like one opened from the bottom-left.
 *
 * Reusable by any Dialog/Sheet trigger, not just the budget page: call
 * `captureOrigin` in the trigger's own `onClick`, pass `origin` through to
 * `DialogContent`/`SheetContent`. Never called → stays centred, the
 * graceful fallback for triggers that can't be measured.
 */
export function useDialogTriggerOrigin() {
  const [origin, setOrigin] = useState<DialogOrigin>(CENTER)

  const captureOrigin = useCallback((event: React.SyntheticEvent<Element>) => {
    if (typeof window === "undefined") return
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    setOrigin({
      x: biasedPercent(centerX / window.innerWidth),
      y: biasedPercent(centerY / window.innerHeight),
    })
  }, [])

  return { origin, captureOrigin }
}
