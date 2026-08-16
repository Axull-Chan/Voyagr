import type { Transition, Variants } from "framer-motion"

/**
 * Stage 2B shared spring vocabulary — see the Apple Design skill's damping/
 * response model, translated to Motion's bounce/duration API (the skill's
 * own recommended mapping). Two entries because Voyagr only has two kinds of
 * physical surface: a dialog (opened by a click, no momentum to honour, so
 * critically damped — bounce 0) and a sheet (reads as a heavier, physical
 * panel, so a restrained hint of settle — bounce 0.15, not the "flick"-level
 * bounce the skill reserves for gesture-released motion, since Stage 2B has
 * no gesture yet). Tuned by eye against the actual app, not copied verbatim
 * from the skill's own numbers.
 */
export const dialogSpring: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.35,
}

export const sheetSpring: Transition = {
  type: "spring",
  bounce: 0.15,
  duration: 0.3,
}

type NativeMotionConflictKey =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"

/**
 * Base UI's polymorphic `render` function prop hands back plain HTML
 * element props, typed with the *native* DOM event signatures for the drag
 * and animation-lifecycle handlers. Framer Motion redefines those exact
 * prop names for its own gesture/animation callbacks, so spreading the raw
 * props straight onto a `motion.*` component is a type conflict even when
 * (as in Dialog/Sheet) the native handlers are never actually set. Strips
 * them rather than widening the whole spread to `any`.
 */
const NATIVE_MOTION_CONFLICT_KEYS: NativeMotionConflictKey[] = [
  "onDrag",
  "onDragStart",
  "onDragEnd",
  "onAnimationStart",
  "onAnimationEnd",
  "onAnimationIteration",
]

export function omitNativeMotionConflicts<
  T extends Partial<Record<NativeMotionConflictKey, unknown>>,
>(props: T): Omit<T, NativeMotionConflictKey> {
  const rest = { ...props }
  for (const key of NATIVE_MOTION_CONFLICT_KEYS) {
    delete rest[key]
  }
  return rest
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
}
