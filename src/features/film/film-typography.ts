/**
 * Shared type treatments for the Blue Hour campaign page.
 *
 * The display serif is loaded per-route (see `src/fonts/film-serif.ts`)
 * and exposed as `--font-film-serif`, so these classes only resolve inside
 * that page's wrapper — deliberately not promoted to a global theme token,
 * since nothing else in the app uses a serif.
 */
export const filmSerif = "font-[family-name:var(--font-film-serif)]"

/** Wide-tracked uppercase micro-label — the quiet-luxury workhorse. */
export const filmLabel =
  "font-sans text-[0.68rem] uppercase tracking-[0.32em] text-film-muted"
