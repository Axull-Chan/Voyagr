import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * This project's typography levels are hand-written `@utility` blocks in
 * `globals.css` (see DESIGN.md § Typography), so they are named `text-*` but
 * are font-size-and-family utilities rather than colours.
 *
 * tailwind-merge cannot know that. Left unconfigured it files an unrecognised
 * `text-<word>` under the *text-colour* group, so combining one with a real
 * colour — `cn("text-eyebrow", "text-primary-foreground")` — silently drops
 * the typography half and keeps only the colour. That is exactly how Button
 * lost its `label-caps` styling: the class never reached the element, while
 * the utility itself was perfectly correct, so nothing looked broken in the
 * CSS and only a computed-style check revealed it.
 *
 * Registering them as font-size classes puts them in the right conflict group:
 * they now override each other (correct — two type levels on one element is a
 * mistake) and coexist with any `text-<colour>` (also correct).
 */
const TYPOGRAPHY_UTILITIES = [
  "display",
  "headline",
  "destination",
  "day-heading",
  "price",
  "eyebrow",
  "supporting",
  "body-lead",
  "label-md",
  "caption",
  "data-lg",
  "data-md",
  "data-sm",
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": TYPOGRAPHY_UTILITIES.map((name) => `text-${name}`),
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
