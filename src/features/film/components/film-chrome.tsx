import Link from "next/link"

import { cn } from "@/lib/utils"
import { filmLabel, filmSerif } from "@/features/film/film-typography"

/**
 * The campaign page runs its own minimal chrome instead of the shared
 * `MarketingNavbar`: that navbar's links are all in-page hashes belonging to
 * the landing page (#features, #pricing), which would land nowhere here.
 */
export function FilmHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <Link
          href="/"
          className={cn(
            filmSerif,
            "rounded-sm text-xl text-film-ink transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:outline-none"
          )}
        >
          Voyagr
        </Link>
        <p className={cn(filmLabel, "hidden sm:block")}>Blue Hour — Vol. I</p>
        <Link
          href="/"
          className={cn(
            filmLabel,
            "rounded-sm transition-colors hover:text-film-ink focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:outline-none"
          )}
        >
          Back to site
        </Link>
      </div>
    </header>
  )
}

export function FilmFooter() {
  return (
    <footer className="border-t border-film-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={cn(filmSerif, "text-2xl text-film-ink")}>Voyagr</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-film-muted">
            AI trip planning — the itinerary, the budget and the maps, in one
            place.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: "The series", href: "#series" },
            { label: "Enquiries", href: "#inquire" },
            { label: "Main site", href: "/" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                filmLabel,
                "rounded-sm transition-colors hover:text-film-ink focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:outline-none"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-6xl border-t border-film-line px-6 py-8">
        <p className={filmLabel}>A fictional showcase</p>
      </div>
    </footer>
  )
}
