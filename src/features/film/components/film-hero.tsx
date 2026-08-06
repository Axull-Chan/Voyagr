import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { landingBeats } from "@/features/film/film-beats"
import { filmLabel } from "@/features/film/film-typography"
import { ScrollFilm } from "@/features/film/components/scroll-film"

/**
 * The landing page's opening: the same scroll-scrubbed film the campaign
 * page runs, but on the `landingBeats` narrative, which closes on the
 * product line and hands off to a real CTA instead of a title card.
 *
 * `id` is what `MarketingNavbar`'s overlay mode measures against to decide
 * when to stop being transparent — see marketing-navbar.tsx.
 */
export function FilmHero() {
  return (
    // -mt-16 pulls the film up under the sticky navbar's 64px of flow space
    // so the footage runs edge-to-edge behind a transparent bar, instead of
    // starting below it with a solid strip across the top of the page.
    <div id="film-hero" className="film-surface -mt-16 bg-film-bg text-film-ink">
      <ScrollFilm
        beats={landingBeats}
        // Shorter than the campaign page's 400svh: this one sits in front of
        // an entire product page, so the film shouldn't cost three full
        // viewports of scrolling before anything else is reachable.
        scrollLength="300svh"
        finalAction={
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-up"
              className="group/cta inline-flex items-center gap-2 rounded-full bg-film-ink px-8 py-4 text-sm font-medium text-film-bg transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:ring-offset-2 focus-visible:ring-offset-film-bg focus-visible:outline-none"
            >
              Start planning free
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover/cta:translate-x-0.5"
              />
            </Link>
            <Link
              href="#how-it-works"
              className={cn(
                filmLabel,
                // Same shadow the beat copy carries — this one lands over a
                // lit shopfront in the closing frames and washes out without it.
                "rounded-full px-6 py-4 text-film-ink/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.85)] transition-colors hover:text-film-ink focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:outline-none"
              )}
            >
              See how it works
            </Link>
          </div>
        }
      />
    </div>
  )
}
