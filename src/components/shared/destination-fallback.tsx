import { cn } from "@/lib/utils"

/**
 * What a trip shows when it has no cover photo: a quiet gradient in the
 * theme's own ink and paper, with the place name set in Fraunces. It replaces
 * the old pin-in-an-empty-box, which read as "something failed to load" when
 * nothing had — a trip simply hasn't got a photo.
 *
 * Decorative: the destination is always also written as text beside it, so
 * this is `aria-hidden` and carries no alt text of its own.
 */

/** "Lisbon, Portugal" → "Lisbon". */
export function placeName(destination: string): string {
  const first = destination.split(",")[0]?.trim()
  return first || destination.trim()
}

export function DestinationFallback({
  destination,
  size = "md",
  className,
}: {
  destination: string
  /** `lg` hero, `md` card, `sm` 48px thumbnail (initial only). */
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const name = placeName(destination)
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full w-full items-end overflow-hidden",
        "bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),var(--background)_55%)_0%,color-mix(in_oklch,var(--primary),var(--card)_80%)_55%,var(--card)_100%)]",
        size === "sm" ? "items-center justify-center" : "p-4 sm:p-6",
        className
      )}
    >
      <span
        className={cn(
          "font-heading text-foreground/80 leading-none tracking-tight",
          size === "lg" && "line-clamp-2 text-4xl font-semibold sm:text-5xl",
          size === "md" && "line-clamp-2 text-2xl font-semibold",
          size === "sm" && "text-lg font-semibold"
        )}
      >
        {size === "sm" ? name.charAt(0).toUpperCase() : name}
      </span>
    </div>
  )
}
