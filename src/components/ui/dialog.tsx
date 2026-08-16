"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { motion, type Variants } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { dialogSpring, omitNativeMotionConflicts } from "@/lib/motion"
import type { DialogOrigin } from "@/hooks/use-dialog-trigger-origin"
import { XIcon } from "lucide-react"

/**
 * Base UI's own exit-CSS-detection is bypassed in favour of Framer Motion
 * controlling exactly when the popup actually leaves the DOM: `Dialog` hands
 * `actionsRef` to `DialogPrimitive.Root` and calls `preventUnmountOnClose()`
 * on close, then `DialogContent`'s own motion layer calls
 * `actionsRef.current.unmount()` once its exit animation genuinely finishes
 * (see `onAnimationComplete` below). This is Base UI's documented mechanism
 * for external animation libraries (`DialogRootProps.actionsRef`,
 * `ChangeEventDetails.preventUnmountOnClose`) — not a workaround.
 */
const DialogActionsContext = React.createContext<React.RefObject<DialogPrimitive.Root.Actions | null> | null>(
  null
)

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const actionsRef = React.useRef<DialogPrimitive.Root.Actions>(null)
  return (
    <DialogActionsContext.Provider value={actionsRef}>
      <DialogPrimitive.Root
        data-slot="dialog"
        {...props}
        actionsRef={actionsRef}
        onOpenChange={(open, eventDetails) => {
          if (!open) eventDetails.preventUnmountOnClose()
          onOpenChange?.(open, eventDetails)
        }}
      />
    </DialogActionsContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        // duration-200, not the old 100 — roughly matches how long the new
        // spring-driven popup takes to settle, so the backdrop doesn't
        // finish fading well before the dialog itself does.
        "fixed inset-0 isolate z-50 bg-black/10 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  origin,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** From `useDialogTriggerOrigin` — biases the entrance's scale origin
   *  toward whichever control opened it. Omit for a centred origin. */
  origin?: DialogOrigin
}) {
  const actionsRef = React.useContext(DialogActionsContext)

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // No more -translate-x/y-1/2 here — Framer Motion owns `transform`
          // on this element now (see the `x`/`y` in `style` below), and a
          // static Tailwind transform class would just get clobbered by it.
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
          className
        )}
        render={(rawPopupProps, state) => (
          <motion.div
            // Base UI's `render` prop hands back generic HTML props typed
            // with the *native* onDrag/onAnimation* signatures; Framer
            // Motion redefines those same names for its own gesture/
            // animation callbacks. Popup doesn't use native drag-and-drop or
            // CSS animations, so dropping the native ones here is safe —
            // this is a type-level conflict between two APIs sharing prop
            // names, not a runtime behaviour to preserve.
            {...omitNativeMotionConflicts(rawPopupProps)}
            initial="hidden"
            animate={state.open ? "visible" : "hidden"}
            variants={dialogVariants}
            transition={dialogSpring}
            style={{
              x: "-50%",
              y: "-50%",
              transformOrigin: origin ? `${origin.x} ${origin.y}` : "50% 50%",
            }}
            onAnimationComplete={(definition) => {
              if (definition === "hidden") actionsRef?.current?.unmount()
            }}
          />
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
