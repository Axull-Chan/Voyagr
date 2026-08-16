"use client"

import { motion, useReducedMotion, type PanInfo } from "framer-motion"
import { Trash2 } from "lucide-react"

import { gestureDragTransition, reducedGestureDragTransition, swipeDelete } from "@/lib/motion"

interface SwipeToDeleteProps {
  children: React.ReactNode
  onDelete: () => void
  disabled?: boolean
}

/**
 * Wraps a list row with a horizontal swipe-to-delete gesture. Purely an
 * enhancement: `children` renders completely unchanged, including whatever
 * accessible delete control it already has — this only adds a drag layer on
 * top. Shared by packing items and expense rows so the gesture, its
 * thresholds, and its physics live in exactly one place, not duplicated per
 * consumer.
 *
 * Deletion itself is fire-and-forget, the same as the existing delete
 * buttons: `onDelete` is called once on threshold-cross, and the row
 * disappears once the parent re-renders without it (after the real mutation
 * resolves) — there's no local "is this gone" state to invent or get stuck
 * in. If the mutation fails, the row is still in the list, so it simply
 * drags back to rest via the same drag-constraint-return that handles every
 * other release; nothing extra is needed to recover from that case.
 *
 * Renders a `<div>` — use inside an existing `<li>` (wrapping the row's
 * content, not the `<li>` itself), not in place of one, so list semantics
 * and any `divide-y`/`space-y` sibling spacing on the `<ul>` stay intact.
 */
export function SwipeToDelete({ children, onDelete, disabled }: SwipeToDeleteProps) {
  const prefersReducedMotion = useReducedMotion()

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const committed = info.offset.x < -swipeDelete.distance || info.velocity.x < -swipeDelete.velocity
    if (committed) onDelete()
  }

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-destructive text-destructive-foreground"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </div>
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        // left: unresisted — swiping toward delete is the one gesture this
        // component exists for. right: light resistance, purely so an
        // accidental rightward nudge doesn't feel like it's doing nothing.
        dragElastic={{ left: 1, right: 0.2 }}
        dragTransition={prefersReducedMotion ? reducedGestureDragTransition : gestureDragTransition}
        onDragEnd={disabled ? undefined : handleDragEnd}
        // Horizontal drag surface, but vertical page/list scrolling must
        // keep working over it without a gesture conflict.
        style={{ touchAction: "pan-y" }}
        className="relative bg-card"
      >
        {children}
      </motion.div>
    </div>
  )
}
