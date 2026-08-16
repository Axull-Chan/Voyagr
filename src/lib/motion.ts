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

/**
 * Stage 2C — gesture-release physics, shared by the mobile Sheet's drag-to-
 * dismiss and `SwipeToDelete`. Shaped as `InertiaOptions`
 * (`bounceStiffness`/`bounceDamping`), not the `type`/`bounce`/`duration`
 * shape `sheetSpring`/`dialogSpring` use — confirmed against the installed
 * framer-motion types (`dragTransition?: InertiaOptions`). This governs the
 * *automatic* return-to-constraints animation `dragConstraints` triggers on
 * every drag release, a different code path from the declarative `animate`
 * transitions above. Softer than the library default (500/10) — this
 * project's existing motion is restrained (`sheetSpring`'s own bounce is
 * 0.15), and the default reads bouncier/looser than that language.
 */
export const gestureDragTransition = {
  bounceStiffness: 380,
  bounceDamping: 30,
}

/** Same role as `gestureDragTransition`, under `prefers-reduced-motion`.
 *  Not zero — snapping to the exact pixel with no transition at all reads
 *  as a glitch, not a settle, so this is fast and tightly damped rather
 *  than instant. */
export const reducedGestureDragTransition = {
  bounceStiffness: 1000,
  bounceDamping: 60,
}

/**
 * Drag-to-dismiss tuning for the bottom expense Sheet. Both fields are
 * "either" conditions in `onDragEnd` — a slow drag past `distance`, or a
 * fast flick that doesn't need the full distance, each count alone as a
 * deliberate dismissal. `velocity` is px/ms — confirmed against
 * `PanInfo.velocity`'s own doc comment ("current velocity of the pointer,
 * in px/ms"), not px/s. 0.5px/ms sits in "a real flick," not an ordinary
 * drag that happens to be a little quick.
 */
export const sheetDismiss = {
  distance: 120,
  velocity: 0.5,
}

/**
 * Swipe-to-delete tuning, shared by packing items and expense rows via
 * `SwipeToDelete`. `distance` matches its revealed-icon width (`w-20` =
 * 80px at the default root size) on purpose — releasing once the delete
 * icon is fully revealed is exactly the point it commits, so what's shown
 * lines up with what happens.
 */
export const swipeDelete = {
  distance: 80,
  velocity: 0.5,
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
