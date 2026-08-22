import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A styled native `<select>` rather than a listbox built from divs.
 *
 * For a short, flat set of options this is the better engineering call: it
 * ships no JavaScript, is keyboard- and screen-reader-correct for free, and
 * on mobile it opens the platform picker, which beats any custom menu. Reach
 * for a composite widget only when the options need search, grouping, or
 * multi-select — none of which apply here.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-3 text-base transition-colors outline-none pointer-coarse:min-h-11 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { Select }
