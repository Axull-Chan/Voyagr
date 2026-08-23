import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * "Nothing here yet", carried by type and space.
 *
 * Previously this was icon-in-a-circle inside a dashed box — the layout unit
 * DESIGN.md names as the most recognizable AI-generated pattern there is. The
 * box is gone entirely: an empty state is not an object, it is the absence of
 * one, so it sits on the page ground with generous vertical room and lets the
 * heading do the work.
 *
 * The icon is kept because callers pass a genuinely meaningful one (a plane
 * for trips, a heart for favourites), but it is now small, quiet and optically
 * aligned above the text rather than enshrined in a tinted disc.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-20 text-center",
        className
      )}
    >
      {Icon && (
        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
      )}
      <div className="space-y-1.5">
        <h3 className="text-day-heading text-foreground">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
