"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import {
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
  type Transition,
  type Variants,
} from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  gestureDragTransition,
  omitNativeMotionConflicts,
  reducedGestureDragTransition,
  sheetDismiss,
  sheetSpring,
} from "@/lib/motion"
import { XIcon } from "lucide-react"

type SheetSide = "top" | "right" | "bottom" | "left"

/**
 * Same mechanism as Dialog (see that file's comment) — a separate context
 * rather than a shared one, since Sheet and Dialog are conceptually
 * independent primitives that happen to share an underlying Base UI
 * component. Applies to *every* side, not just "bottom": once `Root` stops
 * Base UI's own auto-unmount, every `SheetContent` — whichever side it
 * renders — has to be the one to call `unmount()` when its own exit
 * finishes, or a non-bottom sheet (the mobile sidebar's `side="left"`,
 * today) would stay mounted forever after closing.
 */
const SheetActionsContext = React.createContext<React.RefObject<SheetPrimitive.Root.Actions | null> | null>(
  null
)

function Sheet({ onOpenChange, ...props }: SheetPrimitive.Root.Props) {
  const actionsRef = React.useRef<SheetPrimitive.Root.Actions>(null)
  return (
    <SheetActionsContext.Provider value={actionsRef}>
      <SheetPrimitive.Root
        data-slot="sheet"
        {...props}
        actionsRef={actionsRef}
        onOpenChange={(open, eventDetails) => {
          if (!open) eventDetails.preventUnmountOnClose()
          onOpenChange?.(open, eventDetails)
        }}
      />
    </SheetActionsContext.Provider>
  )
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

/**
 * `bottom` gets the new heavier, spring-driven slide (Stage 2B's actual
 * target — "enter from below, settle naturally, feel heavier than a
 * tooltip"). The other three sides keep the pre-existing feel — a short
 * 2.5rem offset plus a fade — just replayed through Framer Motion instead
 * of the old CSS `data-starting-style`/`data-ending-style` classes, so they
 * can go through the same actionsRef-driven unmount as bottom. Not a spring:
 * these were never asked for spring physics, and a tween matching the old
 * `duration-200 ease-in-out` is the closest thing to "unchanged" for the
 * one side (`left`) an existing consumer actually uses.
 */
function sheetVariants(side: SheetSide): { variants: Variants; transition: Transition } {
  if (side === "bottom") {
    return {
      variants: { hidden: { y: "100%" }, visible: { y: 0 } },
      transition: sheetSpring,
    }
  }
  const offset: Record<Exclude<SheetSide, "bottom">, { x?: string; y?: string }> = {
    top: { y: "-2.5rem" },
    left: { x: "-2.5rem" },
    right: { x: "2.5rem" },
  }
  return {
    variants: {
      hidden: { ...offset[side], opacity: 0 },
      visible: { x: 0, y: 0, opacity: 1 },
    },
    transition: { type: "tween", duration: 0.2, ease: "easeInOut" },
  }
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: SheetSide
  showCloseButton?: boolean
}) {
  const actionsRef = React.useContext(SheetActionsContext)
  const { variants, transition } = sheetVariants(side)
  const isBottomSheet = side === "bottom"
  const dragControls = useDragControls()
  const prefersReducedMotion = useReducedMotion()

  // Only the bottom sheet (the mobile Add/Edit Expense form) gets real
  // drag-to-dismiss — the sidebar's `side="left"` and the other two sides
  // keep Stage 2B's plain enter/exit untouched.
  const handleDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const dismissed = info.offset.y > sheetDismiss.distance || info.velocity.y > sheetDismiss.velocity
    if (dismissed) {
      // Same logical close Escape/outside-press/the close button already
      // use (Base UI's own `actions.close`, confirmed in
      // `useDialogRoot.js` to route through the identical `onOpenChange`
      // pipeline) — Stage 2B's exit animation and `unmount()` timing take
      // over from here unchanged, continuing from wherever the drag left
      // the sheet rather than snapping back first.
      actionsRef?.current?.close()
    }
    // Not dismissed: `dragConstraints={{ top: 0, bottom: 0 }}` below makes
    // Framer's own post-release animation return the sheet to 0 on its
    // own — nothing further to do here.
  }

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[85dvh] data-[side=bottom]:overflow-y-auto data-[side=bottom]:overscroll-contain data-[side=bottom]:rounded-t-[var(--radius-overlay)] data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        render={(rawPopupProps, state) => (
          <motion.div
            {...omitNativeMotionConflicts(rawPopupProps)}
            initial="hidden"
            animate={state.open ? "visible" : "hidden"}
            variants={variants}
            transition={transition}
            drag={isBottomSheet ? "y" : false}
            dragListener={false}
            dragControls={isBottomSheet ? dragControls : undefined}
            // A point constraint, not a range: there's nowhere "valid" to
            // rest except 0, so any release Framer doesn't hand to
            // `close()` above animates straight back there on its own.
            dragConstraints={isBottomSheet ? { top: 0, bottom: 0 } : undefined}
            // top: real but light resistance — the sheet shouldn't drift
            // upward indefinitely, but a hard 0 reads as a dead stop, not
            // a physical surface. bottom: unresisted — dragging down is
            // the sheet's one legitimate gesture, and 1:1 tracking is the
            // whole point (a delayed/damped dismiss reads as laggy, not
            // "resisted on purpose").
            dragElastic={isBottomSheet ? { top: 0.2, bottom: 1 } : undefined}
            dragTransition={
              isBottomSheet
                ? prefersReducedMotion
                  ? reducedGestureDragTransition
                  : gestureDragTransition
                : undefined
            }
            onDragEnd={isBottomSheet ? handleDragEnd : undefined}
            onAnimationComplete={(definition) => {
              if (definition === "hidden") actionsRef?.current?.unmount()
            }}
          />
        )}
        {...props}
      >
        {side === "bottom" && (
          <div
            aria-hidden="true"
            data-slot="sheet-handle"
            // The drag surface itself — dragControls.start() here is what
            // arms the gesture on the *parent* motion.div (dragListener is
            // off there specifically so nothing else in the sheet, form
            // fields included, can accidentally start one). aria-hidden
            // stays: dragging has no meaningful screen-reader equivalent,
            // Escape/the close button remain the accessible dismiss path.
            // touch-action: none is scoped to this one handle, not the
            // sheet at large, so the form beneath it keeps native scroll.
            onPointerDown={(event) => dragControls.start(event)}
            style={{ touchAction: "none" }}
            className="mx-auto mt-2 h-1 w-9 shrink-0 cursor-grab rounded-full bg-muted-foreground/25 active:cursor-grabbing"
          />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
