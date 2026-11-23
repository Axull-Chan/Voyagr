import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // 44px (h-11) at every pointer type: the WCAG 2.2 AAA target size,
        // which DESIGN.md adopts for default controls. Border is
        // `border-interactive`, the 3:1 control boundary, never the divider.
        // Full body-md text size at every breakpoint.
        // DESIGN.md specifies inputs at `body-md` rather than a smaller UI
        // size — these are filled in while looking at a map or a calendar,
        // not while sitting still — so the previous `md:text-sm` step-down
        // to 14px on desktop is gone.
        "h-11 w-full min-w-0 rounded-lg border border-border-interactive bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
