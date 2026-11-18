# Voyagr — engineering notes

AI travel planner SaaS, built in 13 phases (full spec came from the user at
project kickoff). Each phase must compile, pass quality gates, and be
committed before the next begins — don't skip ahead without the user's go-ahead.

## Phase status

- [x] **Phase 1 — Project foundation**
- [x] **Phase 2 — Landing page & dashboard**, plus a post-review polish pass,
  a final professional design-refinement pass, two out-of-sequence hero
  redesign passes, a feature-section redesign, and the Blue Hour
  scroll-film (this commit) — see "Phase 2 polish", "Phase 2 final polish
  pass", "Phase 2.5", "Feature section redesign", and "Blue Hour" below
- [x] **Phase 3 — Create trip wizard**, done in two milestones: 3A built the
  12-field multi-step wizard, the 10-table schema (FKs, indexes, RLS,
  generated types) and a provider-agnostic AI abstraction sitting on a mock
  itinerary generator; 3B replaced that mock's placeholder places/weather/
  currency/imagery with real providers, added the map, and fixed the
  provenance and correctness bugs the review passes found — see "Phase 3B —
  real data, the map, and honest provenance" below for the detail. Along the
  way this absorbed most of what Phases 5 and 6 originally asked for (see the
  notes on those two lines below) — flagged here rather than checked off,
  since squaring that against the original per-phase spec is a call for you
  to make, not one to default into by editing this file.
- [x] **Phase 4 — AI itinerary generation**, live via Gemini rather than
  OpenAI as titled here — the user declined to add a payment method for "just
  a mere project," and Gemini's free tier needs no card at all. `OpenAiProvider`
  was built first, fully wired and live-tested up to the account-billing wall,
  and stays in the registry unused rather than deleted, in case that changes.
  See "Phase 4 — real generation, and the enum bug that cost an afternoon"
  below for what building two providers back to back actually required.
- [ ] Phase 5 — Maps & location (Google Maps). A working map shipped in 3B,
  but as MapLibre GL + OpenFreeMap tiles + Nominatim geocoding — a free,
  keyless stack — rather than Google Maps as titled here. Functionally
  covers "maps & location"; doesn't literally match the spec's named
  provider, and nothing Google-specific (Places autocomplete, Directions)
  was attempted.
- [ ] Phase 6 — Weather + currency + restaurants. Live in 3B via Open-Meteo,
  Frankfurter and OpenTripMap respectively — see `src/integrations/`. Left
  unchecked for the same reason as Phase 5: real functionality exists, but
  confirming it satisfies this phase as originally specified is your call.
- [x] **Phase 7 — Budget tracker.** Planned-vs-actual, a live progress bar,
  and full expense add/edit/delete, landed alongside Phase 8 in an
  out-of-sequence pass the user called "Phase 3C" — see that section below.
- [x] **Phase 8 — Packing checklist.** Check/uncheck, add/edit/delete, and
  category grouping over the already-generated `packing_lists` rows — same
  pass as Phase 7, see below.
- [x] **Phase 9 — AI travel assistant (chat-based itinerary editing).** A
  slide-over chat on the trip detail page proposes add/remove/move-activity,
  add/remove-restaurant and reword-day-summary edits, reviewed and applied
  explicitly rather than written automatically — see "Phase 9 — chat-based
  itinerary editing" below. **Not live-browser-verified** — the user chose to
  skip that step this pass; only `type-check`/`lint`/`build` gates ran.
- [ ] Phase 10 — Trip management (rename/duplicate/archive/export). **Code
  complete; the `duplicate_trip` migration is applied and tested against the
  live database, but nothing has been exercised in a browser** — see "Phase 10
  — trip management" below. Left unchecked until the UI has been clicked through.
- [ ] Phase 11 — PDF export. **Built and verified in isolation, not yet
  exercised end to end with a signed-in user** — see "Phase 11 — PDF export"
  below. Left unchecked until a real trip has been downloaded from the live site.
- [ ] Phase 12 — Premium features
- [ ] Phase 13 — Production polish. **Started:** usage limits on the AI calls
  (see "Usage limits" below), error monitoring (see "Error monitoring" below) and
  search/sharing metadata (see "Search and sharing metadata" below).
  Not yet done: accessibility and performance passes, privacy/terms pages, custom
  domain, Supabase redirect URLs and Google sign-in (those two need the user).

## Infrastructure

- Supabase project: `ai-travel-planner` (ref `rwihjdriuyfqenubvplj`), org
  `Axull-Chan's Org`, region `ap-southeast-1`. The account has two other,
  unrelated Supabase projects — never point migrations at those.
- Package manager: npm (no pnpm/yarn/bun installed locally).
- Vercel project `voyagr` (id `prj_cUfuwhMnoMC825jN1zTmNMLyuigp`, team
  `axel-valentinos-projects`), linked to this GitHub repo; production = `main`,
  other branches get preview deployments. Production URL:
  `https://voyagr-taupe.vercel.app`. Env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `AI_PROVIDER=gemini` (all
  environments), plus `GEMINI_API_KEY`, `OPENTRIPMAP_API_KEY` and
  `UNSPLASH_ACCESS_KEY` as Vercel *sensitive* variables (production + preview;
  write-only, Vercel never shows them again — a sensitive variable can't target
  `development`). Added Nov 2026, and production redeployed to pick them up
  (env changes only reach *new* deployments). **Validation status:** the Gemini
  key was confirmed valid (model list returned 200, `gemini-3.6-flash`
  present); the OpenTripMap and Unsplash keys were stored **untested** because
  the build container's proxy blocks those hosts — a wrong one degrades to the
  labelled fallback rather than breaking. Google was returning 503 "high
  demand" on the newer flash models during testing (and one `generateContent`
  call on the default `gemini-3.6-flash` hung >100 s), so intermittent failed
  generations are an external capacity issue, not a key problem; `GEMINI_MODEL`
  can override the default model without a code change. **It is now set to
  `gemini-3-flash-preview` on Vercel** (all environments): an end-to-end run of
  the real pipeline showed the code's default `gemini-3.6-flash` timing out at
  the app's own 60 s limit, while `gemini-3-flash-preview` produced a complete,
  fully venue-grounded itinerary (all 10 activities backed by real venues, live
  forecast, real photo credit) — but took ~79 s including one retry. Two caveats:
  it is a *preview* model Google can change or withdraw (if generation starts
  failing with `unavailable`, check the model first), and the platform's
  function timeout could not be read with the available tools (the project/
  deployment APIs trim it, and the dashboard was inaccessible), so it is now set
  **explicitly in code**: `export const maxDuration = 150` on `/trips/new`
  (trip creation) and `/trips/[id]` (the chat). 150 s covers the worst case of two
  60 s Gemini attempts plus backoff and the data lookups. If a deploy ever fails
  with a maxDuration error, the project is not on Fluid Compute and its plan
  allows only 60 s — lower the literal to that. Vercel Authentication was on for *every*
  `.vercel.app` URL (the site wasn't public); it is now `preview`-only, so
  production is public and branch previews still require a Vercel login. Node
  is pinned by `engines.node` (22.x), not the project setting.

## Non-obvious things learned in Phase 1

- **shadcn/ui here uses Base UI (`@base-ui/react`), not Radix.** The CLI's
  `base-nova` preset was the default when this was scaffolded. Component
  internals differ from the Radix-based shadcn code most examples online
  show: polymorphism uses a `render={<Element />}` prop instead of
  `asChild` + `<Slot>`; primitives are `@base-ui/react/button`,
  `@base-ui/react/dialog`, `@base-ui/react/menu`, etc.
- **`Button` + `render={<Link .../>}` needs `nativeButton={false}`.**
  Base UI's `Button` defaults to `nativeButton: true` and logs a dev-only
  console warning if the final rendered element isn't a real `<button>`.
  For nav CTAs rendered as `<Link>` (correct semantics — it's navigation,
  not a form action), pass `nativeButton={false}` explicitly.
- **`DropdownMenuLabel` requires `<DropdownMenuGroup>`.** It maps to Base
  UI's `Menu.GroupLabel`, which throws ("MenuGroupContext is missing") if
  used as a bare child of `DropdownMenuContent`. For a plain
  non-grouped header (e.g. a user-info block above a logout item), use a
  styled `<div>` instead — see `src/components/layout/user-menu.tsx`.
- **shadcn's `add form` is a no-op in this registry/CLI version** — it
  resolves with "No files." `src/components/ui/form.tsx` was hand-written
  to match this project's actual conventions (plain `Label`, no Radix
  `Slot`, `data-slot` attributes) rather than the canonical Radix-based
  version shadcn docs show.
- **`create-next-app@latest` currently installs Next.js 16.** The spec
  pins Next 15 explicitly, so scaffolding used `create-next-app@15`
  (confirmed `next@15.5.22` in package.json). Don't upgrade this without
  the user asking.
- **Automated/scripted clicks on Base UI `Menu.Item`s can silently no-op**
  (observed while smoke-testing logout — `computer` click didn't fire the
  item's handler, but a real DOM `.click()` via `javascript_tool` did, and
  the underlying code was correct). If a browser-tool click on a dropdown
  menu item seems to do nothing, verify with a direct `.click()` before
  assuming the component is broken.
- Env var for the Supabase anon/publishable key is
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the modern `sb_publishable_...`
  format), not the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name.

## Non-obvious things learned in Phase 2

- **The `sidebar` shadcn component exists in this registry** (`@shadcn/sidebar`,
  plus a `use-mobile` hook) and is close to the classic Radix-based API
  (`SidebarProvider`, `SidebarMenuButton` with `isActive`/`tooltip` props),
  just rebuilt on Base UI's `useRender`. Polymorphic nav links use the same
  `render={<Link .../>}` pattern as Button — but `SidebarMenuButton` does
  *not* need `nativeButton`, since it's built on the generic `useRender`
  hook, not Base UI's `Button` primitive.
- **The mobile sidebar `Sheet` doesn't auto-close on navigation** — that's
  on the consuming app, not the primitive. `AppSidebar` calls
  `setOpenMobile(false)` in each nav item's `onClick` (harmless no-op on
  desktop, where that state isn't used).
- **Browser-tool screenshots can render blank at non-zero scroll positions**
  on this page (reproduces even via plain `window.scrollTo`, so it's the
  screenshot capture, not a real rendering bug) — confirmed via
  `get_page_text` and computed-style/geometry checks (opacity, bounding
  rects, `elementFromPoint`) that the actual DOM is correct. When a
  screenshot goes blank after scrolling, verify with JS before assuming
  the page is broken.
- **`computer` tool coordinates are real CSS-pixel/viewport coordinates,
  not screenshot-image-pixel coordinates** — the screenshot PNG can be
  returned at a different resolution than the viewport (e.g. an 800×500
  image for a 1280×800 viewport). Eyeballing a coordinate off a screenshot
  and passing it straight to `computer` will be wrong unless you scale by
  `viewport_size / screenshot_size`. Prefer `ref`-based targeting (from
  `read_page`/`find`) over hand-computed coordinates.
- **Base UI `Tooltip` doesn't open from a single synthetic `pointerenter`
  event** (needed for hover-testing a disabled "New trip" button) — a real
  `computer` hover at the *correct* coordinate works fine; the earlier
  failures here were the coordinate-space issue above, not a Tooltip bug.
- The viewport can end up at `0×0` after a `resize_window` + scroll
  sequence (seen mid-session; `read_page` reported `Viewport: 0x0` and
  `window.innerWidth/innerHeight` were both `0`). If screenshots or
  `read_page` suddenly report an empty/zero-size page, call
  `resize_window` with explicit dimensions before debugging further.

## Phase 2 polish (post-review fixes)

A full review of Phase 2 found real bugs and gaps against the spec. Fixes:

- **Root cause of the "pricing section stuck invisible" bug**: sections use
  Framer Motion's `whileInView` to fade in on scroll. When the browser jumps
  to a hash target *instantly* (anchor click, no `scroll-behavior: smooth`),
  the `IntersectionObserver`-based trigger can miss the transition entirely
  and the section is left at its `initial="hidden"` (invisible) state
  forever — confirmed by watching computed `opacity` stay at `0`/`0.4`
  indefinitely after an instant jump, in both dev and a production build
  (so it's not a React Strict Mode artifact). Gradual/real scrolling always
  triggered it correctly. Fix: added `scroll-behavior: smooth` globally
  (disabled again under `prefers-reduced-motion: reduce`), and switched the
  viewport trigger from a pixel `margin` to a ratio-based `amount` (more
  robust per Framer Motion's own guidance) — both live in the new shared
  `src/components/shared/reveal.tsx`.
- **`Reveal` / `RevealItem` / `RevealGroup`** (`src/components/shared/reveal.tsx`)
  replace one-off `motion.div` blocks across the app. `Reveal` takes
  `mode="scroll"` (default, `whileInView` — for below-the-fold marketing
  sections) or `mode="mount"` (`animate` — for above-the-fold app pages like
  the dashboard, where waiting on a scroll observer would mean the content
  never animates). `RevealGroup` has **no trigger of its own** — Framer
  Motion propagates variants through the tree, so nesting a `RevealGroup`
  inside a `Reveal` gets a second, independent stagger (e.g. the dashboard's
  overall page fade-in, with each stat card *within* the stat row also
  staggering) without fighting the outer trigger.
- Converted all marketing sections from `"use client"` back to Server
  Components that just import `Reveal`/`RevealItem` (which carry their own
  `"use client"`) — cut the landing page's own route bundle from ~49 kB to
  ~5 kB. Also extracted the repeated "centered heading + subtext" markup
  into `src/components/shared/section-heading.tsx`.
- `TripCard` now links to a real (if minimal) `src/app/(app)/trips/[id]/page.tsx`
  instead of 404ing — it shows the trip's actual title/destination/dates/
  status plus an honest "full itinerary coming soon" notice. Replace
  its content wholesale once itinerary display exists.
- Accessibility pass: `focus-visible` rings added to every hand-rolled
  `<Link>` that wasn't already a shadcn primitive (TripCard, dashboard quick
  actions, navbar/footer/sidebar-brand links); `aria-label` added to
  `UserMenu`'s icon-only trigger; `aria-hidden="true"` added to all
  decorative icons app-wide.

### Browser-automation caveat learned during this pass

Deep into a long browser-testing session, `document.visibilityState`
reported `"hidden"` / `document.hasFocus()` `false` for the active tab —
**despite** `tabs_context` reporting it active and screenshots still
rendering real content correctly. Chrome throttles/pauses
`requestAnimationFrame` and smooth-scroll interpolation for documents that
consider themselves backgrounded, which froze Framer Motion animations
(stuck mid-fade, not just the whileInView case above) and made even plain
`window.scrollTo`/`scrollIntoView()` no-ops — on **every** open tab,
including freshly-created ones, until the whole preview session was
stopped and restarted. This is a tooling artifact, not something a real
user's browser does (a real tab is only hidden when the user has actually
switched away, and animations correctly resume when they switch back). If
animations or scrolling stop responding mid-session despite the page
rendering fine in screenshots, check `document.visibilityState` before
assuming the app broke — restart the preview session rather than
debugging the app further.

## Phase 2 final polish pass (design refinement)

A third pass, framed as a senior-designer/design-lead review looking for
premium/cohesion issues rather than functional bugs. Two real layout bugs
turned up despite the earlier passes:

- **`TripCard` title/destination now truncate to one line** (`truncate` +
  `min-w-0 flex-1` on the title, plain `truncate` on the destination, plus
  a `title=` attribute for the full string on hover). Previously a long
  title wrapped to two lines and pushed that one card's destination/date
  row down, breaking row alignment across every grid that renders trip
  cards (dashboard Upcoming/Recent, `/trips`) whenever titles had different
  lengths — only visible once real data with varied title lengths was
  seeded, not with the placeholder empty states.
- **Pricing grid's 3-tier card set dropped the `sm:grid-cols-2` step
  entirely** (`grid gap-4 lg:grid-cols-3`, cards capped at `max-w-md` and
  centered via `mx-auto` below `lg`). The previous fix (highlighted tier
  `sm:col-span-2` to span both columns at tablet width) avoided pairing it
  awkwardly with just one sibling, but as a side effect left the other two
  tiers at half-width, each alone on its own row with a full half-width gap
  of empty space beside it — worse than the problem it solved. Stacking to
  a single, width-capped column between `sm` and `lg` avoids both problems.
  Verified via `getBoundingClientRect` on each tier's card (not just a
  screenshot — see tooling caveat below), since the empty half-row wasn't
  obvious at a glance in a downscaled screenshot.
- **Marketing navbar now has a mobile nav menu.** Below `md`, `Features` /
  `How it works` / `Pricing` had no way to be reached at all (they were
  simply hidden with the desktop `<nav>`). Added a hamburger trigger using
  the existing `DropdownMenu` primitives (no new dependency) with
  `aria-label="Open navigation menu"`, visible only `md:hidden`.
- **Removed internal phase numbers from user-facing copy.** The dashboard's
  disabled "New trip" tooltip said "Coming in Phase 3" and the trip detail
  placeholder said "Full itinerary coming in Phase 3" — both read as
  portfolio/build scaffolding rather than product copy to anyone actually
  using the app (a reviewer skimming the live UI, not the source). Changed
  to "Coming soon" / "Full itinerary coming soon". Internal phase language
  stays fine in this file and in commit messages — it's specifically
  *rendered UI strings* that shouldn't leak it.
- Confirmed clean at all seven checklist breakpoints (375/390/768/1024/
  1280/1440; 414 skipped as redundant with 375/390) for both the marketing
  page and the dashboard/trips/app shell, with real seeded data (not just
  empty states) so title-length and count-driven layout issues had a
  chance to show up.

### Additional tooling caveats learned during this pass

- **Repeated `resize_window` calls on one tab eventually break that tab's
  layout engine**, independent of the `document.visibilityState` issue
  above. Symptom: `getBoundingClientRect()`/`offsetWidth`/`offsetHeight`
  return `0` for every non-root element (even `<header>`, at the very top
  of the page) while `document.documentElement`/`document.body`'s own
  rect stays correct — and screenshots *keep rendering real, current
  content* throughout, so the page is not actually broken. Confirmed by
  opening a brand-new tab at the same URL: geometry queries work
  immediately there. Since a fresh tab reliably fixes it and a
  same-tab `tabs_select` refocus does not, treat this as "this specific
  tab's DevTools viewport-override state has degraded," not a page bug —
  don't debug the app for it. Practical rule adopted for the rest of the
  session: open a new tab per breakpoint when doing a resize-heavy
  responsive sweep, rather than repeatedly resizing one long-lived tab.
- **`document.body.innerText` can read back empty (`""`) while
  `visibilityState` is `"hidden"`, even though the DOM is fully populated**
  — `innerText` depends on an up-to-date layout/style pass, which appears
  to be skipped for backgrounded documents in this environment.
  `document.body.textContent` doesn't have this problem (it walks the DOM
  tree directly, no layout dependency), so prefer `textContent` over
  `innerText` for sanity-checking that a navigation actually landed content
  when the tab is in this state.
- **Don't run `npm run build` while the `next dev` preview server is
  running against the same directory.** Production build overwrites
  `.next/`, which the live dev server has open and expects to look a
  specific (dev-mode) shape — the next request after that dev server 500s
  with `ENOENT` on `.next/server/app/.../app-build-manifest.json` and
  similar. Fix is `rm -rf .next` + restart the dev server (`preview_stop`
  then `preview_start` again); the app itself was never broken. For a
  regression gate, `npx tsc --noEmit` and `npm run lint` are safe to run
  anytime, but run `npm run build` only when the dev preview is stopped,
  or accept that the preview server needs restarting afterward.

## Phase 2.5 — hero premium redesign

An out-of-sequence, user-requested pass scoped to *only* the marketing
hero (`src/features/marketing/components/hero-section.tsx` and four new
sibling components: `hero-background.tsx`, `hero-floating-elements.tsx`,
`hero-mockup-card.tsx`, `hero-destinations.tsx`) — no nav/branding/section-
order changes, no new product features. Goal: close the gap between
"solid portfolio SaaS page" and "looks like a funded startup."

- **The user's asset zip didn't match its own description** — always
  extract and inspect provided assets directly rather than trusting the
  request text's asset list. Most "hero icon" SVGs turned out to be the
  literal Lucide icon set (confirmed via `class="lucide lucide-plane-icon..."`
  in the raw file) — imported from the already-installed `lucide-react`
  package instead of adding asset files. A "postage stamp" asset was
  actually a Freepik stock bundle whose license demands visible attribution
  for free-tier use and ships only a JPG preview + EPS (not a web format) —
  **not used**, and "passport stamp" was dropped from the floating-element
  set entirely rather than substituted. Two requested files (`noise.png`,
  `gradient-blob.svg`) didn't exist in the zip at all — synthesized instead
  (inline SVG `feTurbulence` filter for grain; the existing radial-gradient
  technique extended with more `color-mix(in oklch, var(--primary), ...)`
  blobs) rather than fetching external stock assets.
- **The 6 destination JPGs had zero city metadata** (generic Unsplash
  filenames) — identified all 6 by eye (landmark recognition: Tokyo Tower,
  Eiffel Tower, N Seoul Tower, Empire State/Chrysler, Ulun Danu Beratan
  temple in Bali; the 6th was an unidentifiable cherry-blossom macro shot,
  dropped). Downscaled the 5 identified photos with macOS's built-in `sips`
  (`-Z 2000`, no new tooling) before committing — originals were 1.6–7.3 MB.
- **A "world map" SVG can be far too bold for a "3–7% opacity" background
  even at 3–7% opacity.** The provided map is solid filled continent
  silhouettes, not a fine dot-matrix — at nominal 5% opacity it still read
  as a clearly legible map competing with the headline, not atmosphere.
  Fix was blur, not just lower opacity: `blur-md` on the map layer (plus
  keeping opacity in-range at 6%) dissolves the hard continent edges into a
  soft wash. Lesson: for "barely visible background texture" treatments,
  *check the source asset's actual density/boldness before assuming a low
  opacity number alone will read as subtle* — a bold source needs blur
  (or a genuinely sparse source asset), a low opacity number on its own
  isn't sufficient. Same logic applied to the flight-path's dashed line and
  the ambient floating icons, all tuned down from their first-pass values
  after a real screenshot showed them competing with the headline.
- **Ambient/looping motion is architecturally separate from the existing
  `Reveal`/entrance-animation system** (`src/lib/motion.ts` /
  `src/components/shared/reveal.tsx`) — deliberately not touched or
  extended. Every new loop (floating icons, flight path, breathing mockup
  card) is its own literal `animate={{...}}` object nested inside the
  existing `<RevealItem>` wrapping the mockup card; Framer's variant
  propagation only affects children with no *own* `animate` prop, so this
  nests with zero special-casing.
- **Flight path**: a static dashed `<path>` plus the Lucide `Plane` icon as
  a `motion.g` *inside the same `<svg>`* (never a separately-positioned
  overlay). The plane's x/y/rotate keyframes are sampled once on mount from
  the path's own real geometry via `getTotalLength`/`getPointAtLength`
  (~24 samples) — guarantees the icon tracks the visible line exactly, zero
  per-frame cost, zero library. `ease: "linear"` is required (the samples
  are already evenly arc-spaced; Framer's default per-segment easing would
  otherwise add a subtle speed pulse at every sample). Lucide's `Plane`
  glyph doesn't rest at a 0°/rightward heading — subtracted an empirically-
  tuned `PLANE_ICON_HEADING` constant from the computed tangent angle so the
  icon visually points along its direction of travel.
- **"Breathing shadow" is a separate blurred glow element, never an
  animated `box-shadow`.** `box-shadow` is a paint-thread property — an
  infinite-loop animation on it forces a main-thread repaint every frame
  for as long as the tab is open. `hero-mockup-card.tsx` instead nests a
  `bg-primary/20 blur-2xl` glow `motion.div` *inside* the card's own
  floating `motion.div`, animating only `opacity`+`scale` (both compositor-
  only) — it inherits the card's float for free via ordinary CSS transform
  composition down the DOM tree, so it can't visually drift from the card.
- **z-index correctness**: every decorative layer uses *negative* z-index
  specifically. `z-0`/positioned-without-z does **not** reliably mean
  "behind" — unpositioned in-flow content (like the hero's own headline)
  already paints in front of any `z-0` positioned sibling per normal CSS
  stacking rules, negative z-index is the only value that's unambiguously
  behind static content regardless of the content's own positioning.
- **Destination cards are real `<Link href="/sign-up">`s**, not decorative
  dead ends — reinforces the page's one conversion goal and avoids
  repeating this project's own earlier TripCard-404 mistake. Wrapped in a
  real `<ul>`/`<li>` with an `sr-only` "Popular destinations" heading
  (removed a *visible* duplicate heading during implementation once the
  sr-only one already covered the accessibility need — didn't need both).
  Images use `next/image` with `fill` + a fixed `aspect-4/3` wrapper (CLS-
  safe by construction) rather than hand-tracked per-photo dimensions,
  since `public/`-referenced images aren't dimension-inferred by Next the
  way statically-imported ones are.
- Kept the destination showcase as an always-horizontal snap-scroll rail
  (not a grid at any breakpoint) specifically to sidestep the "orphan grid
  row" bug class fixed in the previous polish pass (5 is not evenly
  divisible by 2, 3, or 4) — a fixed-count set like this should either fit
  its grid exactly or not be a grid at all.
- Floating icons + flight path: `hidden md:block` (absent below `md`
  entirely, not just repositioned) plus `aria-hidden="true"` +
  `pointer-events-none` on the whole layer — structural, not just
  "positioned to avoid the CTA," since hand-picked positions drift
  relative to reflowed text at different breakpoints.

### Phase 2.5 round 2 — flags, staggered text, parallax

A follow-up pass on the same hero, adding floating country flags as the
primary decoration, per-line headline stagger, and mouse-parallax on the
mockup card. Also did real design research this time (previous pass's
"Mobbin blocks bots" note stood, but Land-book, Linear, and Raycast all
loaded fine) — Raycast's actual hero is close to *zero* decoration, just
huge type on empty space; worth keeping as a calibration point against
over-decorating, even though a travel product justifies more atmosphere
than a keyboard launcher does.

- **Sourced flag SVGs via a temporary npm install, not by scraping the
  website the user named.** `circle-flags` (the exact npm package for
  HatScripts/circle-flags, MIT, zero deps) was installed with `--no-save`,
  the ~10 needed `{iso-code}.svg` files were copied straight out of
  `node_modules` into `public/flags/`, then the package was uninstalled —
  final `package.json` has zero new dependencies, but the assets are
  real, properly-licensed, pre-optimized (Japan's flag is 273 bytes) SVGs
  rather than hand-traced or fetched-by-scraping. This is the general
  pattern worth reusing whenever a "find an icon/asset" task has a
  well-known npm package behind it: install `--no-save`, extract, uninstall.
- **Both "boarding pass" SVGs in the original asset zip looked the same by
  filename but weren't.** `boarding-pass-svgrepo-com.svg` turned out to be
  full-color clip art (pastel blue panels, a red heart stamp) with
  hardcoded per-path fills — would've ignored `currentColor` theming
  entirely and clashed with the app's indigo/neutral palette.
  `boarding-pass-flight-journey-svgrepo-com.svg` was genuinely monochrome
  (`fill="#000000"` on the root, no per-path overrides) and is the one
  actually used. Lesson: open and check the *actual* fill structure of
  each candidate SVG before picking one — filename similarity says nothing
  about whether an icon will take color theming.
- **Headline lines stagger independently by keeping the `<h1>` itself
  plain** (no `motion`/`RevealItem` wrapper) **and putting two
  `motion.span variants={slideUp}` directly inside it**
  (`hero-headline.tsx`). Framer's variant propagation passes through plain
  DOM elements and component-function boundaries alike — it only stops at
  another motion component with its own competing `variants`/`animate` — so
  the two spans slot into the ancestor `Reveal`'s `staggerChildren`
  sequence as two ordinary sequential steps, no nested stagger container
  needed. (A `RevealItem` here would have put a `<div>` inside the `<h1>`,
  which is invalid HTML — that's *why* this needed a dedicated component
  instead of reusing `RevealItem`.)
- **A real Framer Motion bug found via debugging, not assumption: mixing an
  `animate` prop with a separately-driven `style={{ rotateX, rotateY }}`
  motion value on the *same* `motion.div` silently drops the style-driven
  transform.** `mouseX`/`mouseY`/`rotateX`/`rotateY` all updated correctly
  (confirmed via `.get()`), but the element's rendered `transform` never
  included any `rotateX`/`rotateY` term — only the `animate`-driven `y`/
  `rotate`. Fix: split into two nested `motion.div`s — outer owns `animate`
  (the ambient float loop) *and* the mouse event handlers, inner owns only
  `style={{ rotateX, rotateY }}` with no `animate` prop of its own. Once
  separated, the exact same motion values applied correctly
  (`rotateX(4.5deg) rotateY(-4.5deg)`, confirmed in devtools). If a
  motion value passed via `style` seems to have no effect despite the
  value itself updating, suspect a competing `animate` prop on that same
  component before suspecting the motion value or the event wiring.
- **New variant of the known tab-staleness issue: React event handlers can
  silently stop firing on a long-lived tab, even though the DOM node is
  live and a plain `addEventListener` on that exact node still works.**
  Spent real time debugging what looked like a broken `onMouseMove` handler
  — `useMotionValue`/`useSpring` math was correct, a native listener added
  in the same breath received the dispatched event fine, but React's
  synthetic handler never ran. Moving to a brand-new tab fixed it
  immediately with the identical test. Combined with the earlier-documented
  "stale JS chunk survives a full dev-server restart + `.next` wipe"
  variant (a `ReferenceError` for a function already deleted from source
  kept throwing from the identical chunk hash after a server restart, and
  only cleared on a new tab), the practical rule is now broader than just
  "resize-heavy sessions": *any* tab that's been through many navigations/
  edits/HMR cycles in one session is suspect the moment behavior doesn't
  match the current source — reach for a fresh tab before doubting the code.
  `computer`'s `hover` action, in this same environment, also did not
  reliably trigger a React `onMouseMove` handler at all (on any tab) —
  a manually constructed `new MouseEvent('mousemove', { bubbles: true,
  cancelable: true, view: window, clientX, clientY })` dispatched directly
  on the target element did.
- **Movement path, not just timing, needs to vary.** First pass gave every
  floating flag/icon the same pure vertical bob (only duration/delay/range
  differed) — technically satisfies "never synchronize" but not "different
  movement path." Added an optional `xRange` to `FloatingIcon`/
  `FloatingFlag` and gave about half the instances a diagonal drift instead
  of leaving all of them moving on the same vertical axis.

## Feature section redesign — sequential scroll reveal + floating flags

The static 3-column feature grid was replaced with a vertical stack of six
larger "moments," each its own independently-triggered scroll reveal, plus
a floating-flags background spanning the section (Mobbin's homepage stats
block was the reference — "1,428 apps" fades in, scroll further and
"621,500+ screens" fades in too, both stay visible — read from a screenshot
since Mobbin still 403s automated browsers; the giveaway that it's an
*accumulating* reveal and not a pinned-swap carousel is that the screenshot
shows all three stats on screen at once, which a swap-carousel could never
produce in a single frame).

### Correction after the user sent a screen recording

The first implementation (alternating left/right blocks, generous gaps
between each) still wasn't what the user meant, and this time I could
actually check — they sent a screen recording of the real Mobbin page.
Mobbin itself 403s automated browsers, and so does the Wayback Machine's
cached copy in this environment (per-action approval required, which isn't
practical for a browsing session) — the recording was the only way to
actually see the target. `ffmpeg` (installed fresh via `brew install
ffmpeg`, not present before) extracted frames at 2fps via `ffmpeg -i in.mp4
-vf "fps=2,scale=900:-1" frame-%03d.png`; the frames could then be read
directly as images. Two things the video showed that the single static
screenshot couldn't:

- The three stats are **centered**, not split across alternating sides —
  there's no zigzag at all, just one centered column.
- They sit **close together** (small, consistent line-spacing, more like
  adjacent lines of a paragraph than separate spread-out sections) and
  render in **much larger/bolder type** than a typical section — closer to
  a big stat callout than a feature-card title.

Rebuilt `feature-block.tsx` accordingly: dropped the `align` prop and the
`slideInFromLeft`/`slideInFromRight` variants entirely (removed from
`src/lib/motion.ts` too, now unused), centered every block
(`mx-auto max-w-lg text-center`), bumped the title to
`text-3xl sm:text-4xl font-bold`, and tightened `feature-section.tsx`'s
inter-block gap from `gap-28 sm:gap-32` to `gap-12 sm:gap-16`. Lesson
worth keeping in mind generally: a single static screenshot of a reference
site can tell you *that* something reveals progressively, but not *how*
(layout shape, spacing density, scale) — when a text description of a
screenshot-derived interpretation gets "that's not it" feedback, ask for
motion (a recording) before guessing again from statics.

### Nav-fade-mask, found from the same recording

A second round of "look again" feedback on the same recording pointed at
something I'd missed entirely the first time: scrolled content doesn't get
hard-clipped by the sticky nav, it fades out via a gradient as it passes
underneath. Confirmed frame-by-frame at a higher extraction rate
(`ffmpeg -ss <t> -t 3 -vf "fps=10,scale=1000:-1"` on the same recording,
rather than the original 2fps pass — the effect happens over a small
enough scroll distance that 2fps skipped past it) — text visibly dims to
near-transparent right at the nav's lower edge, then fully opaque a
consistent distance below it, for *any* content scrolling through that
zone, not just once at page load.

The mechanism has to be pinned to the viewport, not to the scrolling
content: a `mask-image`/gradient authored on the tall scrolling section
itself would only fade its own literal top/bottom edge once, not every
element passing under the nav as the user scrolls. The actual fix is a
`pointer-events-none` gradient div *inside* `marketing-navbar.tsx`'s
`<header>`, positioned `absolute inset-x-0 top-full h-20` (hanging below
the header's own box, in the containing block the header's own `sticky`
already establishes) with `bg-gradient-to-b from-background to-transparent`
— opaque page-background color right at the nav's edge, fading to fully
transparent ~80px down. Since it moves with the sticky header as one unit,
anything scrolling up underneath is progressively erased by the opaque end
and revealed by the transparent end, for every scroll position, automatically.
Living inside the shared navbar (not scoped to one section) means it
applies site-wide on the marketing page for free — checked that this
doesn't clip/dim anything at the top of the hero at rest (scroll position
0): the hero's own top padding already clears the ~80px zone, so there's
no visible effect until something actually scrolls into it.

Also notable purely as a session-environment observation: real
`window.scrollTo()` worked on a couple of fresh tabs during this specific
check, after being reliably broken (per every earlier note in this file)
for the entire rest of the session — inconsistent even tab-to-tab in the
same few minutes, not tied to any code change here. Didn't chase why;
the recording-frame approach and the sticky/gradient CSS reasoning didn't
depend on scroll actually working in this environment to get right, and
when it did work here it just confirmed what the CSS should already do.

- **A real React Server Components bug, not a stale-tab artifact this
  time**: `feature-section.tsx` and `feature-floating-elements.tsx` are
  Server Components; passing a Lucide icon *component reference*
  (`icon={Sparkles}`, `icon={Compass}`) as a prop into a Client Component
  throws `Only plain objects can be passed to Client Components from
  Server Components` — a component reference isn't serializable across
  that boundary, only plain data or already-rendered elements are. Fix:
  render the icon in the Server Component and pass the resulting element
  down (`icon={<feature.icon className="..." />}`, prop typed
  `React.ReactNode`, not `LucideIcon`) instead of passing the component
  itself. `FloatingIcon` (`src/components/shared/floating-badge.tsx`) took
  the same fix — it now takes `children`, not an `icon` prop — which also
  quietly improved its API (no more juggling a separate `className` prop
  alongside the icon type). The *symptom* looked identical to this
  session's recurring stale-compiled-chunk issue (same error, kept
  reappearing after edits) — the tell that it was a real bug this time,
  not the environment, was that it reproduced immediately on a **brand
  new** tab that had never loaded the broken code before; the stale-chunk
  variant only ever reproduces on a tab that already had the old code
  loaded.
- **Only `Reveal` carries a scroll trigger; `RevealItem`/`RevealGroup` don't.**
  To get six independently-triggered "moments" instead of one shared burst,
  each feature is its own `<Reveal mode="scroll">` (`feature-block.tsx`),
  not six `RevealItem`s inside one shared `Reveal`. Confirmed by reading
  `reveal.tsx` before touching it — `RevealItem`/`RevealGroup` only receive
  "visible" via Framer's variant propagation from an ancestor, they have no
  trigger of their own. Not extending `RevealItem` with a self-trigger mode
  instead, since 4 other sections depend on its current "no trigger of its
  own" contract for their existing burst behavior.
- **Alternating left/right entrance needed a variant Reveal/RevealItem
  don't have — solved without touching either.** `slideInFromLeft`/
  `slideInFromRight` were added to `src/lib/motion.ts` (entrance variants
  belong there), and `feature-block.tsx` applies one directly to a bare
  `motion.div` that sits as a direct child of `Reveal` — it inherits
  "visible" through the same propagation mechanism `RevealItem` uses, just
  with a different variant, so `RevealItem`'s own contract (and its 4 other
  consumers) stays completely untouched.
- **Alternating alignment needs to collapse on mobile, not just shrink.**
  The zigzag only reads as intentional when the block is actually offset to
  one side (`ml-auto`/`mr-auto` against a `max-w-md` cap) — below `sm`,
  `max-w-md` (448px) exceeds the available width anyway, so the block fills
  100% width regardless of margin, leaving only *right-aligned paragraph
  text* with no offset to justify it — worse for scanability, not a design
  choice. Fixed by making `text-left` (and no offset) the unconditional
  mobile default, with `sm:ml-auto sm:text-right` etc. only applying once
  there's actual room for the offset to register. Left the transient
  slide-in *direction* alternating even on mobile (a brief animation, not a
  standing readability concern) — only the static resting layout needed
  the breakpoint guard.
- **A pre-existing reduced-motion gap, fixed once at the shared-primitive
  level while already touching this code**: neither `Reveal`/`RevealItem`
  nor the hero's ambient float/breathing loops checked
  `useReducedMotion()` at all before this pass. Fixed in `RevealItem`
  (swaps to the already-existing `fadeIn` variant instead of `slideUp` when
  reduced motion is preferred — no new variant needed) and in
  `floating-badge.tsx`/`hero-mockup-card.tsx` (loops pass `animate={undefined}`
  instead of the keyframe object). Fixing it in the shared files means all
  five `Reveal`-consuming sections and both floating-badge consumers (hero
  + features) got the fix at once, not just the new section — see
  `hero-mockup-card.tsx`'s ambient loops and `floating-badge.tsx` for the
  same pattern.
- **A transient false alarm while checking for horizontal overflow at
  768px**: `document.documentElement.scrollWidth` briefly read 4px over
  `clientWidth`. Root cause: the QA visibility override only forces
  `opacity`, never `transform` — and the new alternating blocks animate in
  via `x: ±28 → 0`. With this session's standing `document.visibilityState:
  "hidden"` issue freezing animations mid-flight, a block's entrance can
  get caught a few pixels short of settling, which reads as a real overflow
  if you only check `scrollWidth` without also neutralizing transforms.
  Confirmed by re-checking with `*[style*="transform"] { transform: none
  !important }` added to the override — `scrollWidth` dropped to exactly
  `clientWidth`. Lesson: when checking for overflow specifically (as
  opposed to just checking that content is visible), force `transform:
  none` in the same override, not just `opacity: 1` — a mid-flight
  translateX is exactly the kind of thing that produces a narrow,
  plausible-looking, entirely fake overflow reading.
- Reused the temporary-`npm install circle-flags` → copy → uninstall
  technique from the hero pass to extract 4 more flags (`it`, `de`, `nl`,
  `se`, 10 total) rather than either repeating the hero's 6 visibly down a
  much longer scroll or diluting the flag motif with more generic icons.

## Blue Hour — scroll-scrubbed film (landing hero + campaign page)

An out-of-sequence, user-requested pass. A 6s AI-generated Tokyo clip was
turned into a scroll-scrubbed canvas "film" that now opens the landing page
(`src/features/film/`), plus a standalone campaign page at `/blue-hour`
(film + stats + gallery + inquiry form). The original Phase 2.5 hero was
kept and moved directly below the film as the product introduction.

- **The scrub is a `<canvas>` painting pre-extracted JPEGs, never a
  `<video>`.** A video element has its own playback clock, and seeking
  `currentTime` once per scroll frame stutters badly because browsers snap
  seeks to keyframes. 71 frames were extracted with
  `ffmpeg -i in.mp4 -vf "fps=12,scale=1280:-2" -q:v 9 frame-%03d.jpg`
  (4.4 MB total, ~63 kB/frame) into `public/film/frames/`.
  **This ffmpeg build has no webp encoder** (`Default encoder for format
  image2 (codec webp) is probably disabled`) — JPEG is the right call
  anyway, since decode speed matters more than a few hundred kB when the
  reader can outrun the decoder by scrolling fast. All frames are preloaded
  before the scrub arms; loading on demand shows holes exactly when the
  reader is scrolling fastest.
- **Everything per-frame is written imperatively inside one rAF callback**
  (canvas paint, beat opacity, progress bar, frame counter), never through
  React state — a state-driven rerender of the overlay tree at ~60/sec
  janks the scrub for no benefit.
- **A beat with a zero-width fade-in needs `<` not `<=` in the opacity
  ramp.** The opening title card is meant to be legible at rest, but
  `if (progress <= in0) return 0` makes it invisible at progress 0 — the
  page's very first paint had no text on it at all. Fixed by guarding with
  `progress < in0` and giving that beat `in0 === in1 === 0`; the beat also
  ships with `opacity: 1` inline so it's correct before the loop first runs.
- **Full-bleed `cover` is wrong for a 16:9 film on a portrait phone.**
  Covering 390×844 from a 1280×720 source is a ~2.3× upscale (visibly soft)
  *and* crops out the two stalls framing the shot. Below `sm` the film is a
  centered letterboxed band instead (0.61× — downsampling, pixel-sharp,
  whole composition intact), with the beats moved into the space beneath it
  rather than over it. Verify this by computing
  `canvasCSSWidth * devicePixelRatio / sourceWidth`, not by eye.
- **A transparent navbar over a full-bleed hero needs the hero pulled up
  under it.** `MarketingNavbar` is `sticky`, which still occupies 64px of
  normal flow, so the film started *below* it with a solid strip across the
  top. `FilmHero` carries `-mt-16` to slide under it. The navbar's
  `overHero` mode measures `#film-hero`'s real `getBoundingClientRect()
  .bottom` rather than a hardcoded pixel threshold, so it stays correct
  whatever height the section resolves to.
- **Paired grid items sharing one aspect ratio don't share a height.** In
  the gallery's 7/5 and 5/7 rows, `aspect-video` on different column spans
  produced different heights, so each pair's captions sat on visibly
  different baselines. Fixed with an explicit per-row height from `lg` up
  (`lg:aspect-auto lg:h-[26rem]`). Confirmed by comparing each figcaption's
  `getBoundingClientRect().top` — 376/376 and 881/881 — not by eye.
- **This project has `noUncheckedIndexedAccess` on**, so `someArray[0]` is
  `T | undefined` and can't be spread into a `T`. Shared beat data is built
  from named consts (`titleCard`, `middleBeats`) rather than by indexing.
- **The film's dark palette is scoped via a `.film-surface` class**, not the
  app's theme tokens: `@theme inline` maps `--color-film-*` to `--film-*`
  vars that only resolve inside that class, so the utilities are inert
  everywhere else and the film looks identical in light and dark mode.
- **One `<h1>` per page, chosen by data.** `FilmBeat.isHeading` marks which
  beat renders as the `h1`: the campaign page uses its opening title card,
  the landing hero uses its *closing* beat (the only line that states what
  Voyagr is). `HeroHeadline` was demoted `h1` → `h2` accordingly.
- The showcase inquiry form deliberately has no action and no endpoint —
  submit is `preventDefault()` + local state, and the page says so in plain
  text above the button. Verified via `read_network_requests` that no
  request follows a submit.

### Higgsfield asset generation (free plan)

- `higgsfield generate cost <model> ...` before submitting — costs vary by
  two orders of magnitude. Images ran 0.15–7 credits; **video is the
  expensive side**: Seedance 2.0 quoted 12–54 credits for a single clip,
  vs ~6 for Minimax Hailuo (`--variant minimax-2.3` for text-to-video, or
  it demands a start/end image).
- **Model availability is plan-gated independently of credits.** Soul
  Location — the model the catalog recommends for no-people environment
  shots — fails with `job_minimum_basic_plan_required` on the free plan
  regardless of balance. `z_image` (0.15 credits) and `nano_banana_2` work.
- `--wait` on a video job exceeds the 120s foreground Bash timeout; it
  moves to the background and completes fine.

### Browser-tooling notes specific to the scrub

- **The scrub cannot be verified while the Browser pane is hidden.** A
  backgrounded document freezes `requestAnimationFrame` *and* stops
  delivering `scroll` events (measured: `rafFired: 0`, `scrollFired: 0`),
  so the film simply never advances even though `window.scrollY` changes
  and the progress math computes correctly. Check
  `document.visibilityState` and a one-shot `requestAnimationFrame` counter
  *first* — a fresh tab is sometimes `"visible"` and sometimes not, so keep
  opening tabs until one reports `visible`, rather than debugging the code.
- **The rendered frame counter makes each screenshot self-validating.**
  Screenshots in this environment can lag or capture a stale scroll state;
  since `NNN / 71` is painted on screen, a capture whose counter doesn't
  match the expected frame can be discarded and retaken instead of trusted.
- `history.scrollRestoration = 'manual'` plus setting
  `document.documentElement.style.scrollBehavior = 'auto'` is required for
  deterministic positioning — otherwise the page drifts between setting a
  scroll position and capturing it (observed drifting 2380 → 5768).
- Screenshot capture degrades after a reload or a `colorScheme` change on
  an already-resized tab (renders the page into a small corner, or blank at
  non-zero scroll). Fresh tab, navigate, resize once, then capture.

## Field Journal — design system (DESIGN.md + foundation implementation)

An out-of-sequence, user-requested pass: a Stage 3A read-only visual audit
(diagnosing the app as generic-AI-dashboard-feeling — indigo-violet primary,
`rounded-xl` on 37+ elements, cards wrapping everything) fed into the
[`design-md-planner`](https://github.com/ailabs-393/design-md-planner) skill,
which produced `DESIGN.md` at the project root — a Google-format design
token file, lint-clean (`npx @google/design.md lint`), covering colors,
typography, layout, elevation, shapes, and 33 components for both light and
dark themes. The direction is **Field Journal**: paper-and-ink light theme
(Pine Blue primary, from the user's own coolors.co palette), leather-and-
lamplight dark theme (a from-scratch second derivation, not an inversion —
see DESIGN.md's own "Dark mode" note under Colors). This section covers the
*implementation* half — what changed in the codebase, and what it cost to
get right. Read `DESIGN.md` itself for the token values and design rationale;
this is the engineering-gotchas record, in the same spirit as every other
section in this file.

- **`@theme inline` aliases don't emit a real runtime custom property —
  only Tailwind's own generated utility class gets the resolved value.**
  `globals.css` had `--font-heading: var(--font-sans)` inside `@theme
  inline`, and three files (`card.tsx`, `dialog.tsx`, `sheet.tsx`) already
  consumed it via the Tailwind-generated `font-heading` *class*. Repointing
  it to `var(--font-fraunces)` correctly changed those three files' titles —
  confirmed by creating a probe element with `className = "font-heading"`
  and reading its computed `font-family`. But the hand-written
  `@utility text-display { font-family: var(--font-heading); ... }` blocks
  (and siblings `text-headline`/`text-destination`/`text-day-heading`) kept
  rendering Geist, silently. Diagnosis: `getComputedStyle(document.
  documentElement).getPropertyValue('--font-heading')` returned an empty
  string — the alias only exists at Tailwind's compile time, when it's
  generating `.font-heading`'s own rule; it is never emitted as an
  independently-referenceable `--font-heading` declaration on `:root` the
  way a normal custom property would be. `var()` referencing a genuinely
  undefined property with no fallback resolves to the *inherited* value for
  an inherited property like `font-family` — which is exactly why this
  failed silently (inheriting Geist from `<body>`) instead of throwing or
  rendering a visible fallback font. Fix: the hand-written `@utility` blocks
  reference `var(--font-fraunces)` directly, bypassing the alias entirely.
  Lesson: a theme alias defined in `@theme inline` is only safe to consume
  via the Tailwind-generated utility class it produces (`font-heading` the
  class); hand-written CSS that wants the same font needs the underlying
  variable (`--font-fraunces`, set by next/font's `.variable` class on
  `<body>`), not the alias. Caught by direct `getComputedStyle` probing on a
  live page, not by reading the CSS — this class of bug is invisible from
  source alone since both spellings look equally valid.
- **Dialog and Sheet's corner radius is not independent CSS — it's driven
  by the same `--radius-xl` custom property everything else's `rounded-xl`
  resolves through**, confirmed via `grep` before touching anything
  (`dialog.tsx`: `rounded-xl`/`rounded-b-xl`; `sheet.tsx`:
  `rounded-t-xl`). DESIGN.md's Shapes section calls for a real reduction
  (0–4px hierarchy, down from today's 14px-dominant `rounded-xl`), but
  Dialog/Sheet are explicitly protected infrastructure from Stage 2B/2C
  (drag-to-dismiss physics, entrance/exit springs) — shrinking the shared
  `--radius-*` ramp to implement Shapes would silently reshape their
  corners as a side effect of a token change nobody asked to make there.
  **Resolved** in the follow-up commit, but not the way this note first
  guessed. Adding narrow per-component properties to buttons/inputs/TripCard
  would have left the *shared* ramp at its 14px-dominant values, so the next
  component written with `rounded-2xl` would silently reintroduce exactly
  the shape DESIGN.md exists to remove. The scale is the enforcement
  mechanism, so the scale is what had to change. What made that safe was
  noticing the existing class vocabulary already sorts itself into two
  bands — `sm`/`md`/`lg` land on controls (button base is `rounded-lg`,
  plus inputs, menu items, tooltips, skeleton) and `xl`/`2xl` land on
  containers (Card, TripHero, image wrappers) — verified by grepping every
  usage of each, not assumed. So `sm`–`lg` → 2px and `xl`+ → 4px re-scales
  ~100 existing class names correctly without editing any of them, and
  `2xl`/`3xl`/`4xl` collapse onto 4px rather than continuing to grow, so
  there is no large radius left in the system to reach for. Dialog/Sheet
  then get one dedicated `--radius-overlay` instead, which the scale can't
  reach. **That property must live in `:root` and be read as an arbitrary
  value (`rounded-[var(--radius-overlay)]`), not declared in `@theme
  inline`** — per the bug directly above, an `@theme inline` entry exists
  only at Tailwind's compile time and would resolve to nothing here.
  Confirmed live: `--radius-lg` reads back as an empty string from
  `getComputedStyle` while `--radius-overlay` correctly reads `0.875rem`,
  which is the same distinction the font bug turned on.
- **`tertiary` (Old Gold) is deliberately scarce — one job, the countdown
  badge — which meant it couldn't also cover the map's other three marker
  kinds.** `trip-map.tsx`'s `MARKER_STYLES` needs four *distinguishable*
  colors (destination/hotel/restaurant/activity); DESIGN.md's first pass
  only defined one (`map-marker`, using base `primary`). Reusing `tertiary`
  for a second marker would have broken the one-job rule written into the
  file's own Do's and Don'ts one section earlier. Fixed by extending
  DESIGN.md with three new, purpose-derived tokens — Marker Hotel
  (`#A6567E`, sealing-wax rose), Marker Restaurant (`#BF6F33`, ochre),
  Marker Activity (`#3D865A`, trail green) — spaced around the hue wheel
  and deliberately kept out of the 260–330° indigo-violet band, rather than
  either misusing `tertiary` or reaching for another stock palette. All
  four marker colors (including `primary` for destination) are fixed hex
  in both themes, not `var(--primary)` etc. — a map pin has to stay legible
  against whatever a tile provider paints under it, which has nothing to do
  with the page's light/dark mode.
- **Dark-mode chroma needs to be checked, not just asserted.**
  `primary-strong-dark`'s first candidate (`oklch(0.750 0.075 205)`,
  `#72BCC5`) technically passed every contrast pair, but its chroma (0.075)
  was *higher* than light mode's `primary-strong` (0.048) — the opposite of
  the "reduced chroma in dark mode" principle stated in DESIGN.md's own
  prose. A saturated accent gets louder against a dark ground, not calmer,
  so the value was recomputed at `C=0.055` (`#85B9BF`) and every dependent
  contrast pair re-verified before it went in the file. Worth remembering:
  writing the right principle in prose doesn't guarantee the numbers next
  to it actually follow it — check the derived value against its own stated
  rule, not just against WCAG.
- **Implemented this pass**: `globals.css` color tokens (light + dark, all
  of `:root`/`.dark`/sidebar-*), Fraunces loaded in `layout.tsx` and wired
  through `--font-heading`, the four `text-*` `@utility` display/headline
  levels, `trip-map.tsx` marker colors, and a `countdown`/`countdown-urgent`
  Badge variant pair (`badge.tsx` + `trip-hero.tsx`) — quiet gold for "In N
  days," bold gold for "Tomorrow"/"Today," plain `secondary` for a past
  trip (gold reads as *imminent*; a past trip is the opposite of that, so
  it deliberately does not get the countdown treatment at all). `--notice`
  and `--chart-*` were deliberately left untouched — outside DESIGN.md's
  token scope, and `--chart-*` has zero live consumers in the codebase
  (`grep` confirmed), so retinting it would be ungrounded guessing.
- **`card`→`row` conversions**, done in a third commit. `budget-section.tsx`
  and `packing-section.tsx` each dropped their outer
  `rounded-xl border border-border bg-card p-5` wrapper for a plain
  `border-t border-border pt-5` — a rule that divides rather than a box that
  encloses. The favorites page went further: its grid of bordered boxes
  became a single `<ul>` of divided rows, since a saved place carries only a
  name and a type and was producing three columns of mostly-empty boxes.
  Two things worth keeping from that one:
  - **`RevealItem`/`RevealGroup` have no `render`/`as` prop** — they
    hardcode `motion.div` and accept only `children` and `className`.
    Reaching for Base UI's `render={<li />}` idiom there is a mistake; that
    pattern belongs to the `useRender`-based primitives, not these. The fix
    is a plain `<ul>`/`<li>` around a `RevealItem`, which works because
    Framer propagates variants through React *context*, not the DOM tree —
    so the intervening list elements are transparent to the stagger and the
    shared primitive needs no new prop (its four other consumers stay
    untouched).
  - **`trips/[id]/loading.tsx` had to change in the same commit**, exactly
    as the Phase 3C note below warns: two of its four skeleton blocks mirror
    the budget and packing sections specifically, so leaving them as
    enclosed boxes would have reintroduced the settle-shift the skeleton
    exists to prevent. The other two blocks (day timeline, aside panels)
    mirror content this pass didn't touch and were correctly left alone.
- Verified live in the browser rather than from source: light and dark
  mode on `/sign-up` (elevation inversion visible — the card panel is
  lighter than the page in dark mode, darker in light mode, exactly as
  DESIGN.md specifies), the marketing page's `text-display`/`text-headline`
  elements post-fix, both new `bg-tertiary`/`bg-tertiary-subtle` Tailwind
  utilities via computed-style probes (same `@theme inline` risk class as
  the font-heading bug, checked for the same reason), and every band of the
  new shape scale by reading computed `borderRadius` off probe elements —
  buttons/inputs 2px, cards/hero 4px, Dialog/Sheet 14px, countdown pill.
- **Not pixel-verified, and worth saying plainly**: everything behind the
  auth wall — the countdown badge, the map markers, and the three
  `card`→`row` conversions (`/favorites`, and budget/packing on
  `/trips/[id]`). These are type-checked, lint-clean, structurally
  reviewed, and their styling was confirmed via computed-style probes on
  the login page, but no authenticated session existed in this pass to
  render them with real data. Not claimed as visually confirmed.

## Phase 3B — real data, the map, and honest provenance

### MapLibre's worker cannot be bundled — this is why the basemap was blank

The map rendered its canvas, its controls and all 23 markers, but the tiles
themselves never appeared. Everything upstream checked out: the TileJSON
resolved, and a direct fetch of the exact Lisbon tile returned **200, 111 kB,
`application/vnd.mapbox-vector-tile`, `access-control-allow-origin: *`**. So
the provider was fine and the fault was client-side.

The cause was a single console error that was easy to dismiss as this
session's recurring stale-chunk artifact: *"Failed to load module script: The
server responded with a non-JavaScript MIME type of text/html."* The tell that
it was real is that it reproduced **once per page load, including on brand-new
tabs** — the stale-chunk variant only ever recurs on a tab that already had the
bad code.

MapLibre v6 locates its tile-decoding worker at runtime with
`new URL('./maplibre-gl-worker.mjs', import.meta.url)`. That specifier is
built from a variable, so **no bundler can see it**. Turbopack rewrites the
maplibre chunk to `/_next/static/chunks/…`, the worker is looked for beside
*that* file, Next answers with its HTML 404 page, and the browser refuses it
for a module script. Vector tiles are decoded in the worker, so the basemap
stays permanently blank while markers — main-thread DOM — keep working. That
split is the diagnostic signature: **markers fine + tiles blank means the
worker, not the tile source.**

The fix is the library's own escape hatch, `setWorkerUrl`:

- `scripts/copy-maplibre-worker.mjs` copies `maplibre-gl-worker.mjs` **and
  `maplibre-gl-shared.mjs`** into `public/maplibre/`. Both are required and
  must land in the same directory — the worker imports the shared chunk by
  relative path. They are two halves of one minified build whose symbol names
  only line up within a single release, so the script runs from `predev` and
  `prebuild` rather than being committed; `public/maplibre/` is gitignored and
  excluded from ESLint (otherwise it contributes ~1,000 lint warnings).
- `trip-map.tsx` calls `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` at
  module scope. That is early enough: the worker pool is built lazily when the
  first map is constructed.

### Provenance: a real name with invented details is worse than a fake name

`buildHotel` picked a name from a hardcoded per-city catalogue and paired it
with `jitterCoord()` — a *random* offset from the city centre. For Lisbon that
published **"Memmo Alfama", a real hotel, ~4 km from where it actually is**, in
a neighbourhood it isn't in (Belém), beside a 4.7★ rating nobody gave it — while
the real OpenTripMap accommodation data the app already fetched went unused.
Activities and restaurants had venue-backed builders; hotels never got one.

Found by noticing a lone marker far from the others on the map and checking the
distance in SQL, then diffing against what OpenTripMap actually returns for
that name. Worth repeating as a technique: **compute distance-from-centre over
the stored rows rather than eyeballing pins** — one outlier among 23 markers is
invisible at a glance but obvious as a number.

- `buildHotelFromVenue` now takes the name and point from the same real record.
  Everything it cannot know is left **null rather than filled in**: `address`
  (listing data has a point, not a postal address), `rating` (OpenTripMap's
  `rate` is a popularity index, not a guest score — rendering it as stars
  publishes a review nobody wrote) and `amenities`. The DB columns were already
  nullable and `StaysPanel` already tolerated nulls.
- The nightly rate stays modelled, since budgeting needs a number, but it is
  labelled `est.` in the UI for real and example stays alike.
- `hotels.source` mirrors `weather.source`. The creation-time warning list is
  **never persisted**, so without a stored flag a revisited trip had no way to
  say its hotel was an example. The migration's `default 'mock'` backfills
  existing rows correctly — everything written before the column existed
  genuinely was catalogue-generated.
- The fallback no longer names real businesses at all. `hotelNames` is gone
  from all 11 profiles; an example is now `Example ${kind} in ${city}`. The
  provenance label fixes the panel, but **the name itself travels** — into the
  map popup, and into a future PDF export — so it has to carry its own honesty.

### A venue's categories can belong to two families at once

`frameVenue` turns a venue's OSM categories into a verb and a note. Porto's
**Cinema da Trindade is a church converted into a cinema**, listed as
`religion,churches,cultural,cinemas,theatres_and_entertainments,…`, which
produced *"Visit Cinema da Trindade — Dress modestly; some areas may be closed
during services."*

Reordering doesn't fix this: our declaration order is arbitrary, and the
provider's own order puts `religion` **first** for that cinema, so keying off
`kinds[0]` is no better. The distinction that matters is that the *verb*
("Visit", "See") asserts nothing falsifiable while the *note* gives a
behavioural instruction. So the specific note is used only when exactly one
family matches, and an ambiguous venue keeps the verb with the neutral note.
Measured on a regenerated Porto trip: 10 of 12 activities kept their specific
note, and the only two that fell back — the church-cinema, and a market also
listed under architecture — are genuinely ambiguous.

Worth generalising: when derived copy makes a **claim about the real world**,
a first-match-wins lookup over multi-valued source data will eventually assert
something false, and it will look completely normal in the code.

### The Unsplash credit was built but never persisted

`src/integrations/unsplash/images.ts` captures `attribution`
(photographerName / photographerUrl / photoUrl), its header documents that a
credit is required, and `TripHero`'s own doc comment claimed the photo was
"credited inline" — but `trip.actions.ts` persisted only `cover_image_url`, so
the credit was discarded at the write and **no attribution appeared anywhere on
the page**. The `trackDownload` ping was wired up correctly, which made the
integration look finished.

Worth remembering as a review technique: a layer being *correct in isolation*
says nothing about whether its output survives to the screen. Checking the
rendered page for the word "Unsplash" found in seconds what reading
`images.ts` would never have shown. Now stored on `trips` as three columns and
rendered top-right over the hero, with `UNSPLASH_REFERRAL_URL` exported so the
"on Unsplash" half carries the same referral parameters.

### maplibre-gl.css sets a popup background but no text colour

Popups render white with the text colour inherited from the page, which in dark
mode is a near-white foreground: an opened marker popup was an unreadable blank
white box. Fixed by passing `className: "trip-map-popup"` and theming it from
the app's own `--popover` tokens. The tip is a CSS triangle where only the edge
facing the popup is painted, and which edge that is depends on the anchor —
colouring all four fills the square into a block, so each
`.maplibregl-popup-anchor-*` variant is targeted separately.

## Phase 4 — real generation, and the enum bug that cost an afternoon

### OpenAI first, Gemini for real — a mid-build pivot, not a redesign

`OpenAiProvider` was built first, exactly to the phase title. Live-tested with
a raw smoke script before touching the app: the key authenticated fine (it
could list models), and a real Structured-Outputs request reached the API
with the correct shape — but every generation call came back `429 You
exceeded your current quota`. OpenAI's API is metered pay-per-use with no
meaningful free tier for new accounts as of mid-2025, separate from any
ChatGPT subscription, so this needed a card on the account before anything
past this point could be tested live. Asked the user; they declined —
reasonably, for a portfolio project.

That ruled out the *provider*, not the *design*. `AI_PROVIDER_IDS` already
listed `gemini`/`groq`/`openrouter`/`deepseek` alongside `openai`, so the
provider abstraction from 3A had already anticipated exactly this — this
was always meant to be a one-file, one-registry-line swap. Verified Gemini's
free tier first rather than assume it'd be friction-free too: no card, no
expiry, 1,500 req/day on Flash models, and — the part that actually
mattered — real schema-constrained JSON output, not just "valid JSON, any
shape." `OpenAiProvider` was kept rather than deleted: it's fully built,
live-tested up to the billing wall, and costs nothing sitting unused in the
registry if the account ever gets funded.

Building the second provider immediately surfaced what should have been
shared from the start: `openai-provider.ts`'s ~250 lines of venue
resolution, weather/budget/packing mapping and prompt-building had nothing
OpenAI-specific in them — only the schema dialect and the transport call
differed. Split into `venue-grounded.ts` (shared) plus a thin
`buildSchema` + transport call per provider. Two schema dialects, confirmed
by hitting a live 400 rather than trusting docs:
- **Nullability.** OpenAI (JSON Schema) wants `type: [x, "null"]`. Gemini
  (an OpenAPI 3.0 subset) wants a separate `nullable: true` flag on a
  scalar `type` — copying one schema into the other silently mistypes every
  optional field.
- **`additionalProperties`.** Present in OpenAI's schema, present in every
  doc summary fetched for Gemini too — and rejected outright by the live
  API: `Unknown name "additionalProperties" ... Cannot find field`. Gemini's
  subset doesn't have it. Dropped for Gemini; harmless, since `required`
  plus an exhaustive `properties` list is what actually constrains valid
  data, and the mapping code only ever reads named fields.

### The real bug: two real ids in one enum, and Gemini says no

First live trip through the actual wizard (not the isolated smoke test —
that used six hand-picked venues) failed with `400 Request contains an
invalid argument`, no further detail in the error body. The isolated test
had passed cleanly; the only structural difference was scale — the real
places-service pool (here: 18 attractions, 16 restaurants, 10 hotels) is
much larger than six hand-picked venues.

Scale wasn't it, though — a same-size slice of the *real* data (6/3/1) failed
identically, and the exact same nested-schema shape with *fake* ids at
4-day depth had already succeeded. Bisected by literally swapping values in
and out of a captured request body and re-`curl`ing it:

- One real xid anywhere in an enum: fine.
- Two real xids in the *same* enum: `400`, every time, regardless of which
  two, regardless of digit length. A single real value in the (non-nested)
  hotel field: fine, at any count — the failure only ever reproduced inside
  the array-nested `venueId` enums.

No further detail was available from Gemini's own error body to explain
*why* — this is an implementation quirk on their side, not a documented
limit, and not something to keep chasing once it's this precisely
characterised. **Fix: don't send OpenTripMap's real xids as enum values at
all.** `venue-grounded.ts` now assigns short synthetic tokens (`a1`, `a2`,
`r1`, `h1`, …) per venue and resolves them back to the real `SourcedVenue`
server-side — the enum-constraint safety guarantee is unchanged (still a
closed set of tokens, still resolved against real data, still dropped with
a warning if unresolvable), only the token shape sent to the model differs.
Applied to *both* providers, not just Gemini: OpenAI's own request never
got a live full-schema test (blocked on billing before this point), so
there's no evidence it's immune to the same class of issue, and a short
token costs nothing either provider cares about.

Worth keeping as a debugging pattern: when a live API rejection gives no
useful detail and a docs-summary contradicts what the API just said (as it
did for `additionalProperties`), bisect the actual request body directly —
capture it once, then re-`curl` restricted variants — rather than keep
re-reading documentation that has already been shown to be wrong once.

### Never let the model be the source of truth for a fact

Same rule 3B established for hotels, applied from the start here rather
than found as a bug after the fact: the model chooses *which* offered venue
to feature and writes the prose, but never supplies a name, coordinate,
category, or number that a real source already provides.

- **Weather** is populated from `sourced.weatherByDate[date]` only, never
  asked of the model — even the numbers visible in the prompt (given so the
  model can write weather-aware summaries — see Day 3's Lisbon run, which
  correctly rescheduled itself indoors for a forecast of drizzle) are for
  *reading*, not reproducing. A day past the forecast horizon gets
  `source: "unavailable"` and nulls throughout, not an invented estimate —
  this provider has no per-destination climate catalogue to fall back on
  the way the mock does, and building one just to fill this gap wasn't
  worth it.
- **Travel time and walking distance** have no real source either (no
  routing/directions provider is wired up — see Phase 5's notes), but
  *can* be grounded rather than guessed: both are now derived via haversine
  distance between the real coordinates of the real, resolved venues in
  scheduled order. Still an estimate, but one connected to the actual
  places chosen, unlike the mock's `jitterCoord`-adjacent random numbers.
- **Budget** is computed from the real totals once the rest of the
  itinerary is resolved (hotel + transport + summed activity costs), not
  asked of the model as its own line items — a model-produced breakdown has
  no guarantee of summing to the total it was also asked for.

### A pre-existing fabrication found while building this, fixed alongside it

`buildRestaurantsFromVenues` (and its no-real-data sibling
`buildRestaurants`) invented a plausible-looking star rating
(`round(3.8 + rng() * 1.1, 1)`) for every restaurant — including ones
backed by a real, named venue. Exact same bug class as the hotel-rating fix
in 3B (OpenTripMap's `rate` is a popularity index, not a guest score), just
never caught, because nothing in the UI renders a restaurant rating yet —
so a plausible 4.2★ sat in the database with no visible symptom. Found
while deciding what the new Gemini/OpenAI restaurant builder should put in
that field; fixed in both places at once rather than left inconsistent
between mock and real. `GeneratedRestaurant.rating` is now `number | null`,
same treatment as the hotel.

## Phase 3C — budget tracker, packing checklist, polish, QA

An out-of-sequence pass (the user's own name for it), closing Phases 7 and 8
and doing a polish/QA sweep — briefed explicitly as "reuse existing
architecture, don't redesign."

### Why actual spend needed a new table, not a bigger `budget_breakdown`

`budget_breakdown` is one row per category holding a single `planned_amount`
and `actual_amount` — there is no field for a date or a description, and no
room for more than one entry per category. "Log an expense" needs all three,
so stretching that table wasn't an option; a new `expenses` table holds
itemized spend instead, and `budget_breakdown` stays exactly what it was.
"Spent per category" is computed by summing `expenses` at render time —
`budget_breakdown.actual_amount` is still never written to, same as before
this phase, just now for a documented reason instead of by omission.

`packing_lists`, by contrast, needed *zero* schema changes — `is_checked`,
`category`, `item` and `sort_order` were already exactly the right shape.
Auditing before writing a single line of schema (as briefed) is what caught
this: one table needed new structure, the other didn't need any.

### Expense currency is independent of the trip's currency

An expense can be logged in any of the app's supported currencies, not just
the trip's own — someone planning in EUR may have paid a specific bill in
USD. Every expense converts back to the trip's currency for the totals using
the same Frankfurter-backed `currency-service.ts` already built in Phase 6,
via `convert()`'s existing null-on-no-rate behaviour: an expense in a
currency with no quote contributes 0 to the total rather than a silently
wrong number.

The rates fetch itself started by requesting all 8 app-supported currencies
unconditionally against the trip's currency, "so any expense currency would
resolve." Live testing surfaced a real, external Frankfurter slowdown at the
time (a *single*-quote request took 30+ seconds; see the raw `curl` timings
this was diagnosed with) — the page still rendered correctly throughout,
which is the `attempt()`/`ServiceResult` fallback working exactly as
designed, not a bug. The quote list was still narrowed to just the
traveller's home currency plus whatever currencies are actually on the
expenses already loaded, typically 0–2 quotes instead of 7: strictly less
external surface regardless of how fast Frankfurter is on a given day.

### A duplicate-panel mistake, avoided this time

The old sidebar `BudgetPanel` (planned amounts only) and the new full Budget
section would have shown overlapping information in two different places on
the same page — the exact "why are there two panels for one thing" mistake
flagged earlier in this project (see the feature-section de-duplication
note). `BudgetPanel` was removed outright rather than left stale alongside
the new section; nothing else imported it, confirmed by grep before deleting.

### One real responsive bug, found by the sweep

At 375px, the packing "add an item" row (item input, category input, add
button) squeezed onto a single `flex-wrap` line instead of actually
wrapping, truncating the item input's placeholder text illegibly. `flex-wrap`
technically permits wrapping but doesn't *prefer* it over shrinking — the
fix is `flex-col sm:flex-row`, an unconditional stack below the `sm`
breakpoint rather than a wrap that only triggers under overflow. Caught by
the same "screenshot at each breakpoint, don't just check for zero
horizontal scroll" discipline established in Phase 2's polish passes:
`horizontalOverflow: 0` was true even on the broken layout, since a
tight-but-not-overflowing row is still a bug a scroll-width check alone
can't see.

### The loading skeleton needed the same edit as the page

`trips/[id]/loading.tsx` mirrors the real layout's shape so nothing shifts
when content arrives — adding the two new sections to the page without
updating its skeleton would have left the loading state silently
out-of-sync, reintroducing the shift the skeleton exists to prevent. Fixed
alongside the page change itself. Worth remembering as a general rule: a
route with a `loading.tsx` needs that file touched in the same commit as any
layout change to the route it mirrors, not as a follow-up.

### Verification

Every add/edit/delete for both expenses and packing items was exercised live
against the real database (not just type-checked) — confirmed via direct
DOM inspection after each action, not just a screenshot: total/planned/
spent/remaining and the per-category bars recompute correctly, the packing
progress count and percentage update immediately, and deleted rows are
actually gone from Postgres afterward, checked directly by SQL rather than
trusted from the UI alone. Every new form field's `<label for>` was
confirmed programmatically to resolve to its real control, not just
visually adjacent to it. Data-integrity guarantees from Phases 3B/4 (no
fabricated ratings, correct hotel provenance) were re-confirmed unchanged,
since nothing in this phase touches generation.

## Auth flow

- Email/password + Google OAuth via `@supabase/ssr`. Server actions live in
  `src/features/auth/actions/auth.actions.ts`.
- Google OAuth code path is wired up, but two manual, one-time steps still
  need the user's own accounts: (1) create an OAuth client in Google Cloud
  Console, (2) paste the client ID/secret into the Supabase dashboard under
  Authentication → Providers → Google. Until then, the button will hit a
  "provider not enabled" error — expected.
- `/reset-password` is intentionally **not** in `middleware.ts`'s
  `AUTH_ROUTES` redirect-away-if-logged-in list, since it needs to work both
  for a freshly-authenticated password-recovery session and for an
  already-logged-in user changing their password.
- New signups require email confirmation (Supabase default). There's no
  MCP tool to toggle this off; to test login locally without a real inbox,
  confirm via SQL: `update auth.users set email_confirmed_at = now() where
email = '...'`.

## Design system

The visual language is **Field Journal**, defined in `DESIGN.md` (token values,
rationale, components) and implemented in `src/app/globals.css` — see the
"Field Journal — design system" section above for the engineering gotchas. The
shadcn `base-nova` preset is only the component scaffolding underneath.

- Colour: paper-and-ink light theme, leather-and-lamplight dark theme, Pine
  Blue primary. Not the indigo/violet accent this app started with.
- Fonts (`src/app/layout.tsx`, self-hosted from `src/fonts/` — see "Build reliability"): Geist Sans (`--font-sans`) for UI, Geist Mono
  (`--font-mono`) for data, Fraunces (`--font-fraunces`) for headings.
- Motion: shared variants in `src/lib/motion.ts`, `prefers-reduced-motion`
  handled globally via `<MotionConfig reducedMotion="user">` in
  `src/components/motion-provider.tsx`.

## Phase 9 — chat-based itinerary editing

Every phase up to this one only ever *generated* an itinerary once, at trip
creation — there was no way to change a day's plan afterward short of
regenerating the whole trip. This adds a slide-over chat
(`src/features/trips/components/detail/trip-chat.tsx`, a floating trigger +
`Sheet`) where a message proposes a small, reviewable edit — add/remove/move
an activity, add/remove a restaurant, reword a day's summary — which the
user explicitly applies or discards. Planned via a dedicated Plan-agent pass
before any code was written, given how many architectural forks a "chat that
edits data" feature opens; the plan is in the session history, not
duplicated here.

- **One schema-constrained response per turn, not an agentic tool loop.**
  This app's Gemini/OpenAI integrations (`integrations/gemini/generate.ts`,
  `integrations/openai/responses.ts`) have only ever made one-shot structured-
  output calls; a chat-editing feature could easily have reached for
  multi-step tool-calling instead, but that would have been new
  infrastructure this project doesn't need for v1. A turn sends the current
  itinerary snapshot + recent history (folded into the prompt as plain text,
  not a real multi-turn API request) and gets back `{reply, operations[]}` in
  one call — same shape discipline as generation's `{title, summary, days,
  ...}`. `AiProvider` gained one method, `proposeItineraryEdit`, implemented
  by all three providers (gemini live, mock deterministic, openai unused-but-
  parallel, same as generateItinerary's three-provider pattern).
- **The Phase 4 enum bug, applied pre-emptively to a second id type.**
  `venue-grounded.ts`'s `selectCandidates` exists because Gemini reliably
  400s once a JSON-schema enum contains two or more real, opaque ids
  together (see "Phase 4" below) — fixed there by assigning short synthetic
  tokens instead of sending real OpenTripMap xids. A remove/move operation
  needs the model to reference an *existing* activity or restaurant by id,
  and those are real Postgres UUIDs — the same shape of bug waiting to
  happen, just never tested against Gemini directly. Rather than discover
  that the hard way, `chat-edit-shared.ts`'s `assignItemRefIds` applies the
  identical fix pre-emptively: existing items get short tokens (`act1`,
  `res1`, …) for the model to reference, resolved back to real ids
  server-side, exactly like venue refs already are.
- **Everything the model can't know is still resolved from real data, not
  asked of the model** — the same non-negotiable rule Phase 3B/4 established,
  just applied to a smaller surface. `add_activity`/`add_restaurant`
  operations only let the model pick *which* offered venue (by ref id) and
  write the title/description prose; name, coordinates, category and cuisine
  are all filled in from the real `SourcedVenue` afterward, in
  `resolveChatOperations` — never sent back through the schema as a field the
  model fills in itself.
- **The mock provider declines rather than inventing, diverging from its own
  `generateItinerary`.** `buildHotel`/`buildActivities` in `mock-provider.ts`
  fall back to catalogue-invented content when no real venues exist, because
  generation has to produce a complete trip either way. A chat turn has no
  such pressure — declining one add-request ("I don't have any real places
  nearby to suggest for that") costs nothing, and this feature's whole
  premise (never state a fact about a venue the model wasn't given) has no
  carve-out for the mock path either. `proposeMockEdit` is plain keyword
  matching (day-number/weekday detection, remove/add/move intent, word-
  overlap scoring against real venues/existing items) — a deterministic
  dev/offline stand-in, not a substitute for actually understanding the
  message, so it declines honestly whenever nothing scores rather than
  guessing.
- **Persistence: every turn is saved immediately; "discard" is client-only.**
  New table `trip_chat_messages` (migration
  `20260905120000_add_trip_chat_messages.sql`) logs both sides of the
  conversation the moment they happen, including a not-yet-applied
  assistant proposal — writing the chat log is not the same as mutating the
  itinerary, so the confirm-before-apply rule doesn't block it. A discarded
  proposal is just a row whose `applied_at` stays null forever; the DB has
  no delete path for it at all, matching the same "one policy per CRUD verb,
  but not every verb needs a caller" shape as `trip_notes`.
- **Applying an edit re-reads `proposed_operations` from the message row
  itself, never trusts a client-resent payload.** `applyChatOperationsAction`
  takes only `{tripId, messageId}` — the server is the one source of truth
  for what was actually proposed, re-validated against the current DB state
  (a day or item that no longer exists is *skipped with a reason*, not a
  hard failure — the array is capped at 6 operations and applied
  sequentially, same no-transaction limitation `itinerary-writer.ts` already
  documents for the Supabase client).
- **Restaurant "cheaper"/"better" requests can only ever be answered
  honestly as "a different option."** `rating`/`priceLevel` are null for
  every provider by design since Phase 4 — nothing in this app has ever
  sourced real restaurant pricing. The system prompt says this outright
  rather than letting a chat reply quietly imply a comparison nobody can back.
- Not touched: `sheet.tsx`/`dialog.tsx` internals, the Stage 3D trip detail
  composition (the chat panel mounts as an additive sibling, outside
  `Reveal`/`RevealItem` since it's persistent chrome, not scroll content),
  `venue-grounded.ts`'s existing exports/callers, and `mock-provider.ts`'s
  existing `generateItinerary` behaviour.
- **Not live-browser-verified.** `type-check`, `lint`, and `build` all pass
  clean, and the migration's RLS was checked with `get_advisors` (no new
  findings — the standing "unused index" INFO notices fire identically for
  every existing trip-scoped index, not just the new one). But the actual
  end-to-end flow — sending a message against live Gemini, applying a
  proposal, confirming it renders in `DayTimeline` and survives a reload —
  was never exercised in a browser this pass: the session's Browser pane
  never picked up an authenticated cookie (checked on a brand-new tab too),
  and the user chose to skip live testing rather than debug that further.
  Worth doing before trusting this beyond "it compiles."

## Phase 10 — trip management

Rename, duplicate, archive/restore and export, from a "…" menu on the trip
page (`trip-actions-menu.tsx`) plus an Archived section on `/trips`.

- **Verification status, stated plainly.** `tsc`, `lint` and `npm run build`
  pass. `20260917090000_add_duplicate_trip.sql` was applied to the live project
  (the Supabase MCP had timed out on every call earlier in the session and
  recovered later — the cause was never found; the user guessed a dormant
  account). Tested with rollback-only `DO` blocks that end in a deliberate
  `raise exception`, so nothing persisted (confirmed: no stray copies, original
  trip unchanged): duplicating a real Lisbon trip as its owner gave identical
  counts on days/activities/restaurants/weather/hotels/transportation/budget/
  packing, an identical activity cost sum, packing checked 1 -> 0, favourite
  false, spent 0. Failure paths all raise the intended code: no user 28000,
  another user's trip P0002 (indistinguishable from missing), `generating`
  55000, and `anon` gets 42501 (execute revoked). `get_advisors` shows nothing
  new. **Not verified:** the menu, rename dialog, archive/restore round trip,
  Archived section, dashboard filtering and the export download have never been
  run in a browser, and `renameTripAction`/`setTripArchivedAction` never against
  the database. `database.types.ts` was hand-edited to add `duplicate_trip`;
  regenerate it when convenient.
- **Duplicate is a Postgres function, not client calls.** A trip spans nine
  tables and the Supabase client has no transactions, so a mid-way failure
  would leave a half-copied trip. `duplicate_trip(uuid)` is `SECURITY INVOKER`,
  so RLS still decides what the caller can read and insert. It copies the plan;
  it deliberately does **not** copy expenses, chat history, packing checked
  state, the favourite flag or actual budget amounts.
- **`status` does two jobs** (lifecycle and `archived`), so archiving overwrites
  what the trip was. Restore recomputes it (has days -> `ready`, none ->
  `draft`) rather than remembering. `generating` trips can't be archived or
  duplicated, and archive/restore is a compare-and-set on the status it read,
  so it can't clobber a generation that starts in between.
- **Export is JSON only** (`/trips/[id]/export`), a versioned portable shape
  with internal ids and `user_id` stripped. Weather/hotel `source` is kept so a
  file can't launder an example into a fact. PDF is Phase 11. The download
  filename is a whitelist slug of the title (checked against `../`, quotes and
  CRLF input).
- **Not built:** delete, editing a trip's dates/destination, and importing an
  exported file back. None were in the phase's one-line spec.

## Dependency refresh (Nov 2026)

Brought the project current after a long gap. `npm audit --omit=dev` went from
24 findings (3 critical) to 3.

- `next` and `eslint-config-next` pinned at **15.5.29** (the last 15.x). The
  22 -> 29 range closed the Image Optimization RCEs (SVG/AVIF), the Server
  Actions DoS and the ISR cache-poisoning advisories. Next 16 is available but
  deliberately not adopted — see Phase 1's "don't upgrade without the user
  asking".
- `maplibre-gl` floor raised to `^6.19.0` (critical XSS sanitizer bypass fixed
  after 6.4.0). `scripts/copy-maplibre-worker.mjs` still worked unchanged: it
  fails the build if the worker file names move, which is the safety net here.
- `shadcn` moved to **devDependencies**. Nothing at runtime imports it; the only
  use is `@import "shadcn/tailwind.css"` in `globals.css`, resolved at build
  time (Vercel installs devDependencies, so builds are unaffected). It had been
  dragging hono, the MCP SDK, ts-morph and ~70 transitive packages into the
  production install.
- `engines.node` set to `22.x` plus `.nvmrc` — Vercel had defaulted to Node 26
  while local was 22. Nothing pinned it before.
- Everything else moved within its existing semver range (`npm update`),
  including `@base-ui/react` 1.6 -> 1.9, `lucide-react` 1.28 -> 1.74 and
  `@supabase/*`. `tsc`, lint and build pass; a production-server smoke test of
  `/`, `/login`, `/sign-up` and `/blue-hour` showed no console errors, and the
  MapLibre worker is served as `application/javascript`.
- **Left on purpose:** `zod` 3 -> 4 (breaking; touches every schema) and the
  `postcss` copy bundled inside Next (build-time CSS only). **Not verified:**
  the trip-page map itself and anything behind login — those need an
  authenticated session this pass didn't have.

## Testing and CI

- `npm test` runs Vitest (`vitest.config.mts`; `@` aliased to `src/`). Tests
  sit beside the code as `*.test.ts` and cover only pure logic — date and money
  maths (`trip-domain`), currency conversion, the validation schemas, the export
  shape and filename sanitiser (`trip-export`), the PDF's text sanitiser and
  content model, a render smoke test of the PDF document, and `resolveChatOperations`/`assignItemRefIds` in
  the AI layer, which is where "the model may pick but never state a fact" is
  actually enforced. No network, no database, no env vars needed.
- Added in the Nov 2026 refresh (79 tests), grown to 222 with the PDF work, the usage limits, error monitoring and the site-metadata helpers, ~3s.
  The three most load-bearing rules were mutation-checked (each deliberately
  broken once, each caught by the intended test, then reverted). It does **not**
  cover server actions, anything needing Supabase, or any component — those
  still rely on manual verification, which is exactly why Phase 9's and Phase
  10's UI notes say "not verified in a browser".
- `.github/workflows/ci.yml` runs lint, type-check, tests and build on pushes to
  `main` and on every pull request, using the Node major from `.nvmrc`. It needs
  no secrets: the production build succeeds with no environment variables.
- `@types/node` is on 22 to match `engines.node`; Vitest 5 refuses the older
  `@types/node` 20 this project started with.
- Not in CI on purpose: `npm audit` (new advisories would turn unrelated PRs
  red), `format:check` (the codebase isn't Prettier-clean and it was never
  enforced).

## Phase 11 — PDF export

"Download PDF" in the trip's "..." menu (`trip-actions-menu.tsx`) hits
`/trips/[id]/export/pdf` (`route.tsx`), which builds the document on request.
Code is in `src/features/trips/pdf/`: `trip-pdf-model.ts` (pure: decides every
word printed), `trip-pdf-document.tsx` (layout only), `pdf-text.ts` (character
safety), plus tests and a fixture.

- **Why `@react-pdf/renderer`.** A headless Chromium (puppeteer + a packaged
  Chromium) is heavy on Vercel and slow to cold-start; a print stylesheet needs
  no dependency but is not a file the app produces and its quality depends on the
  reader's browser. react-pdf is pure JS, ~5 MB, supports React 19, and — checked
  by a production build, not assumed — bundles and runs inside a Next 15 route
  handler with **no** `serverExternalPackages` or other config. `npm audit`
  was unchanged by adding it.
- **Built-in fonts draw only Windows-1252, and everything else prints as the
  WRONG glyphs, not boxes.** A probe of Hungarian, Polish, Greek, Cyrillic and
  Japanese text came out as `Q B©[/q¬`. So every string goes through `toPdfText`
  (keep what the fonts can draw, fold accents/typographic look-alikes, otherwise
  one `?` per run) — applied once over the whole model tree, so a field added later
  is covered. Today all 130 stored names are Latin-script, but OpenTripMap returns
  a place's local name when it has no English one, so a Japanese venue will arrive
  eventually and print as `?`. Bundling a CJK font is the fix and is a deliberate
  later decision (several MB per script). Headings use Times (echoing the app's
  Fraunces), body Helvetica, white page for printing.
- **Honesty rules carry over to paper, in the model** (and are unit-tested): modelled
  numbers say "est."; a placeholder hotel prints "An example stay for budgeting -
  not a real listing"; weather says "forecast at time of planning" or "typical
  weather, not a forecast", and a day with no forecast prints only its condition;
  **no rating is ever printed** (the fixtures carry ratings specifically so the test
  can prove they are dropped); spend that could not be converted is **counted and
  named** in a warning, never silently left out of the total. A standing "planned
  with AI, check before you travel" notice is on page 1. No cover photo: embedding
  Unsplash bytes in a PDF is derivative use of a licence that requires hotlinking
  plus a credit, so it was left out rather than guessed at.
- **A real bug found along the way, fixed separately:** `convert()` returned `null`
  for any conversion INTO the rate table's base currency, and the trip page builds
  its table with the trip's currency as the base — so **every foreign-currency
  expense counted as zero spend** on the budget page. Quotes are "units per 1 base"
  and the table never lists its own base, so going into the base is a division;
  that branch was missing. Fixed in its own commit with regression tests (the two
  that cover it fail without the fix). Nothing had caught it because the original
  budget verification only used same-currency expenses.
- **Tooling trap: typed unicode escapes (backslash then u then four hex digits)
  are converted to the LITERAL character before the file is written**, in this
  environment's write path (a quoted heredoc does not prevent it). Zero-width
  characters became invisible in source, and a literal line separator (U+2028)
  inside a regex literal is a parse error that stopped the whole test run. Fix: build
  special characters from numeric code points (`String.fromCodePoint`), and use
  `\p{M}` style property escapes instead of ranges. A scan for literal control /
  format / combining characters in the new files is cheap and found the same
  problem hiding in Phase 10's filename slug, now fixed. Ordinary `\n`, `\r`,
  `\t` escapes were unaffected.
- **Vitest needs `oxc: { jsx: { runtime: "automatic" } }`** (Vite 8 transforms with
  Oxc, and tsconfig's `jsx: "preserve"` otherwise makes `.tsx` tests fail to parse).
  `vitest.config.mts` also now includes `.tsx` tests.
- **Layout lesson:** `minPresenceAhead` on a day heading did not stop it being
  stranded at the foot of a page, because the short summary alone satisfied the
  distance. The reliable fix is structural: the heading, weather, summary and first
  activity are one `wrap={false}` block. Found by rendering to PNG with `pdftoppm`
  and looking — poppler is installed in the build container, so this is repeatable.
- **Verified:** rendered a demanding 6-day fixture (page breaks, example hotel,
  all three weather cases, a Japanese name, a USD expense that converts, a JPY
  expense with no rate) and inspected every page; checked the figures by hand
  (USD 21.60 at 1.08 = EUR 20.00, Spent 52.50, Remaining 1,947.50); mutation-checked
  three rules (example label, conversion warning, sanitizer); rendered through
  a real production Next build via a temporary probe route (since deleted) —
  200, `application/pdf`, valid 5-page A4; confirmed the real route 307-redirects
  to login when signed out, same as the JSON export.
- **Not verified:** the route with a real signed-in trip and real data; the menu
  item in a browser; that `notFound()` inside a route handler returns a clean 404
  for someone else's trip (the JSON export relies on the same behaviour, also
  untested); Vercel's runtime for the route. Not built: cover photo, map, CJK
  fonts, custom fonts, choosing what to include.

## Usage limits (first slice of Phase 13)

The site is public and every trip generation / chat message spends a shared,
free-tier model quota (~1,500 requests a day), and there was **no per-user or
global limit anywhere** — anyone with an account could use it all up. Only two
places call a model (`createTripAction` -> `generateItinerary`,
`sendChatMessageAction` -> `proposeItineraryEdit`), and both now reserve a slot
first. Code: `src/lib/ai/usage-limits.ts` (pure: defaults, env overrides, wording),
`src/features/trips/services/ai-quota.ts` (reserve/confirm), migration
`20260917120000_add_ai_usage_limits.sql` (table + two functions).

- **Enforced in Postgres, not in the app.** A counter in a serverless function's
  memory resets on every cold start and differs between instances, so it limits
  nothing. `consume_ai_quota` counts over a rolling 24 h, serialises concurrent
  requests per kind with an advisory lock, and is `SECURITY DEFINER` only so the
  *global* limit can count other users' rows; it uses `auth.uid()` and takes no
  user id, so it cannot be pointed at someone else.
- **Reserve then confirm — and deliberately NO refund.** A signed-in user can call
  any function exposed to them directly with their own login, so a "refund
  my slot" function would let them hand themselves unlimited free generations.
  Instead a reservation counts for 3 minutes (longer than the 150 s the pages may
  run, so in-flight requests are counted) and only becomes a full 24-hour use when
  `confirm_ai_quota` is called **after the model succeeded**. A failed or timed-out
  call is never confirmed, so its reservation lapses and a provider outage (Google
  was returning 503s while this was built) does not burn anyone's allowance.
  Nothing exposed can *reduce* a user's usage, only raise it. The table has no
  insert/update/delete policy; clients can read only their own rows.
- **Fails open when the limiter is broken** (function missing, database
  unreachable), logging the error, and never fails open on a real "limit reached".
  A broken safety mechanism must not take the product down with it — and it means
  deploy order does not matter: this code is harmless before the migration is
  applied (it simply isn't limiting yet).
- **Not applied to the mock provider** (nothing to protect), and an unusable env
  value falls back to the restrictive default, never to "no limit".
- **Defaults and why:** 5 trips and 30 chat messages per traveller, 250 and 500
  globally per 24 h. Each model call can be retried once (two requests), and
  (250 + 500) x 2 = 1,500 — exactly the free-tier cap in the worst case, far under
  it in practice. Override with `AI_LIMIT_TRIPS_PER_USER`, `AI_LIMIT_TRIPS_GLOBAL`,
  `AI_LIMIT_CHAT_PER_USER`, `AI_LIMIT_CHAT_GLOBAL` (whole numbers, 1-100000).
- **A traveller over a limit** gets a plain message with when to retry (rounded
  *up*), in the wizard's error line or as a chat toast — no new UI. A global
  refusal says it isn't their fault and shows no number.
- **Verified:** the SQL, in rolled-back transactions (nothing was written): reserve
  and confirm, confirm-twice is a no-op, the per-user limit with in-flight counted,
  a lapsed reservation freeing its slot, confirmed use expiring after 24 h, the
  global limit across two real users, kinds counting independently, one user unable
  to confirm another's row, signed-out / bad kind / non-positive limit errors,
  direct insert/update/delete refused (42501), own-rows-only reads, anon denied,
  and old-row cleanup. The TypeScript with 33 tests, mutation-checked on three
  rules (honouring a refusal, skipping the mock provider, a typo not disabling a
  limit). The first attempt at the independence scenario was itself wrong (it
  passed the wrong limit) and was redone properly.
- **Applied to the live project** as migration `20261117145151_add_ai_usage_limits`
  (Nov 2026). Afterwards: confirmed from the catalog that RLS is on, the only
  policy is select-own, anon has no table or function access, and signed-in users
  can read but not write the table and can run both functions; re-ran a rolled-back
  check against the *applied* functions (all as expected, table left at 0 rows).
- **Supabase advisors after applying:** two new WARNs, "Signed-In Users Can Execute
  SECURITY DEFINER Function" (`consume_ai_quota`, `confirm_ai_quota`) — **expected
  and intentional**: the app calls them with the user's own login, and they must
  be SECURITY DEFINER (the global limit counts other users' rows; the table has no
  write policy). They take no user id and use `auth.uid()` only. Revoking them
  would break the limiter; the lint's other remedy (a non-exposed schema) would
  make them uncallable from supabase-js, and a service-role key is not set up.
  Plus two INFO "unused index" notices for the new table's indexes (it is new).
  The pre-existing leaked-password-protection WARN is unrelated.
- **Not verified:** a real signed-in trip generation or chat message actually
  hitting the limit on the live site. Not built: showing "N left today" in the UI,
  per-IP limits, and limiting signups (an attacker with many email addresses is bounded only by
  the global ceiling, which is its purpose).

## Error monitoring (second slice of Phase 13)

Before this, an error left almost no trace: the only boundary (`error.tsx`) logged to
the *visitor's own browser console*, nothing recorded which route or action failed
on the server, root-layout errors were uncaught, and **Vercel keeps runtime logs for
only 1 hour on the Hobby plan** — so an error at 3am was gone by breakfast. The
build also deliberately has no third-party service: Sentry-style tools need an account
and a secret from the user, so this is zero-dependency, with `reportServerError` /
`reportClientError` as the single seam where one could be added later.

Code: `src/lib/monitoring/` (`error-model.ts` pure and fully tested; `report-server.ts`;
`report-client.ts`), `src/instrumentation.ts` (Next's `onRequestError`),
`src/app/global-error.tsx` (new — root-layout errors), `src/app/error.tsx` (now reports
and shows a "Reference" code), `src/components/monitoring/error-reporter.tsx` (mounted in
the root layout), migration `20260917140000_add_error_events.sql`. All ~11 scattered
`console.error` calls now go through `reportServerError`.

- **Two sinks that fail independently.** Always one JSON line in the server log
  (`"event":"app_error"`; searchable for the hour Vercel keeps it). Durably, when
  `NEXT_PUBLIC_ERROR_REPORTING=on`, in `error_events` via the `report_error` function.
- **Reporting is OFF unless that variable is `on`, and is set `on` only for the
  Production environment.** Local dev and Vercel previews talk to the *same database
  as production*, so without the gate a developer's own mistakes and automated test
  runs would fill the real record. It is inlined at build time (change = redeploy).
- **One row per distinct problem, not per occurrence.** A repeat bumps `occurrences`
  and `last_seen_at`; ids and numbers in the message and route are blanked before
  fingerprinting, so "trip <uuid> failed after 31 ms" is one error, not thousands. A
  *resolved* error that recurs is **reopened** — that is how a regression shows up.
- **`report_error` is callable by `anon`** (an error can happen before sign-in), so it is
  built to survive being called directly by anyone with the public key: every field is
  truncated; repeats only touch a counter; new kinds are capped at **60 per hour** and
  **5,000 in total** (a hard storage ceiling) and past the cap it silently does nothing —
  reporting an error must never itself raise one. The residual risk, stated plainly: an
  attacker can use up the hourly allowance of *new kinds* and so hide a genuinely new
  error for up to an hour (the server log line still exists). The table has RLS on with
  **no policy** and every privilege revoked: no client can read or write it. Rows older than
  30 days are purged when a new kind arrives. `last_user_id` is taken from `auth.uid()`
  inside the function (unspoofable) and is null for server-side reports, which use the
  public key with no session — an error report is a poor place to put a person's id.
  Messages can still contain personal data if the code that threw them put it there.
- **Never makes things worse:** reporting never throws, and the database call is abandoned
  after 2.5 s. The browser reporter is throttled (each distinct problem once, at most ten
  per page load) and drops noise that says nothing about our code (extension frames,
  cross-origin "Script error.", ResizeObserver, AbortError); a dropped connection is kept
  as a *warning*. `redirect()` / `notFound()` (thrown by design) are ignored.
- **An error with a Next `digest` is NOT re-reported from the browser.** In production
  Next hides a server error's message from the browser and sends only a generic
  placeholder plus the digest; `onRequestError` has already recorded it with the real
  message and stack. The first version reported both, which the production-build test
  exposed — a second, useless row, spending the hourly budget. The digest is what ties a
  visitor's "Reference: 2198323246" to the server row.
- **Two traps found while building it.** (1) `report_error` declares no defaults, and
  PostgREST finds a function by the NAMES of the arguments sent; `undefined` is dropped
  when the body becomes JSON, so a missing argument makes it look for a function that does
  not exist — the report 404s. Every argument is sent, as an explicit `null` when empty
  (`toRpcArgs`; a test pins it). (2) `service-result.ts` is reachable from a *client*
  component (the budget section imports `convert` from `currency-service`), so it loads
  the server reporter with a lazy `import()` inside its catch rather than a top-level
  import that could pull server code into the browser bundle.
- **Reading it** (SQL editor, or ask Claude — it can query through the Supabase tool):
  `select severity, source, context, occurrences, last_seen_at, left(message,100) as message,
  route, app_release from error_events where resolved_at is null order by last_seen_at desc;`
  and `update error_events set resolved_at = now() where id = ...;` to close one. A degraded
  external service shows up as `severity = 'warning'`, `context = 'service:<name>'` — e.g.
  a wrong OpenTripMap key would appear there as a steady pattern.
- **Verified:** the SQL in rolled-back transactions (grouping with differing ids/numbers,
  truncation, reopen on recurrence, source separating server from client, bad input,
  anon/signed-in cannot select/insert/delete, `last_user_id` set only from a real session,
  the hourly cap with an existing error still counting past it, 30-day purge); 52 unit tests,
  five rules mutation-checked (null arguments, ignoring control flow, the throttle, off-by-
  default, never throwing); and a real **production build** with temporary failing pages
  (since deleted): Next called `onRequestError` for a route handler (`route`) and a server
  component (`render`) with the right path and digest, and in a real browser the error page
  showed the matching reference, and a click-handler error and an unawaited promise rejection
  were each caught and sent with the right page, browser and all 10 arguments (the request
  was intercepted, so nothing reached the database).
- **Applied to the live project** as migration `20261117151840_add_error_events` (Nov 2026),
  and `NEXT_PUBLIC_ERROR_REPORTING=on` set on Vercel for the **Production target only**. From
  the catalog: RLS on, **no policy**, 0 rows, no privileges for `anon`/`authenticated` on the
  table; `report_error` is `SECURITY DEFINER`, executable by both, and its argument names are
  exactly the ten `toRpcArgs` sends (that name match is what PostgREST resolves on).
- **Verified end to end against the live database** (needed one extra host, the project's own
  Supabase address, added to this session's `voyagr` environment's network allowlist): the app's
  own `reportServerError` and a browser-style RPC sent real reports through PostgREST with the
  public key. Two server reports whose messages differed only by a digit became **one row with 2
  occurrences**; the browser-style one landed as a separate `warning` row with its release and
  user-agent; neither carried a user id. The test rows were deleted afterwards (table back to 0).
- **Supabase advisors after applying:** three new findings, all **expected and intentional**:
  INFO "RLS enabled, no policy" on `error_events` (the point: no client may touch it) and the
  WARNs "Public/Signed-in users can execute SECURITY DEFINER function" for `report_error`
  (it must be callable before sign-in; the abuse limits in the function are the mitigation).
  The two older ones for the AI-limit functions remain, also intentional.
- **Not verified:** a real visitor's error on the live site appearing in the table (the
  production deploy had not happened when this was written), and Vercel previews/local staying
  quiet (they do not get the variable, and a unit test pins "off by default"). Not built:
  alerts (nothing *tells* anyone an error happened — it has to be looked at), an in-app dashboard,
  source maps (client stack traces are minified), sampling, and release tracking beyond the
  7-character commit id.

## Search and sharing metadata (third slice of Phase 13)

What a search engine or a link preview (Slack, X, iMessage) sees. Code: `src/lib/site.ts` (pure,
tested in `site.test.ts`), `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`,
`src/app/opengraph-image.tsx` + `twitter-image.tsx` (both render `src/lib/og/brand-image.tsx`).

- **Site origin:** `https://voyagr-taupe.vercel.app`, overridable with `NEXT_PUBLIC_SITE_URL` (inlined at
  build time, so changing it needs a redeploy; set it when the custom domain lands). An unusable value
  (not an absolute http(s) URL) falls back to the default rather than throwing, because
  `metadataBase: new URL(bad)` in the root layout would fail the render of every page.
- **Per-page canonical and Open Graph come from `pageMetadata()`, not the root layout.** Next merges
  metadata one top-level key at a time: a page that sets its own `openGraph` or `twitter` replaces the
  layout's whole object, including the image Next attaches from the `opengraph-image` file convention
  (first build: `/blue-hour`, `/login` and `/sign-up` had no `og:image` at all; only pages that did
  *not* set `openGraph` had one). So `pageMetadata` names the images explicitly (`/opengraph-image`,
  `/twitter-image`) and sets `og:url`. The root layout deliberately sets **no canonical** — it would be
  inherited by every route and point them all at `/`. The home page uses `title: { absolute }` so it is
  not "Voyagr — ... · Voyagr".
- **Indexing:** the `(app)` layout and the `(auth)` layout export `robots: { index: false, follow: false }`.
  `/login` and `/sign-up` opt back in (they are in the sitemap, and listing a `noindex` URL in a sitemap is
  a contradictory signal); `/forgot-password` and `/reset-password` stay noindex. `robots.txt` disallows
  `/dashboard /trips /favorites /api /auth` and deliberately **not** the auth pages: a crawler that may not
  fetch a page never sees its `noindex`. A unit test pins that the sitemap never lists a path robots.txt
  blocks.
- **Sitemap** lists `/`, `/blue-hour`, `/login`, `/sign-up`, `/privacy`, `/terms` with no `lastModified`
  (nothing tracks real edit dates; "now" would claim every page changes daily). `/privacy` and `/terms` are
  being added separately — until they exist the sitemap lists two 404s, so check they landed.
- **The share image** is 1200x630, Fraunces on the light-theme paper/ink/Pine Blue tokens from DESIGN.md
  (hex values copied in; an image has no CSS variables). It is statically prerendered at build. Satori
  (`next/og`) reads TTF/OTF/**WOFF but not WOFF2**, so it uses two static Fraunces woff files
  (`src/fonts/og/`, from `@fontsource/fraunces@5.3.0`), not the variable woff2 the site serves. The
  files are read with `readFile(join(process.cwd(), "<literal>"))` — the form Next documents and Vercel's
  tracer follows. **`fetch(new URL("./x.woff", import.meta.url))` fails the build here** ("Failed to parse
  URL from /_next/static/media/..."): in this Next version it resolves to a bare path at prerender time,
  with or without being inlined.
- **Middleware matcher** now skips `robots.txt`, `sitemap.xml`, `opengraph-image` and `twitter-image`:
  crawlers have no session, and these must stay up even when auth is unhealthy.
- **Verified:** against a production build (`next start`, with dummy Supabase env since the middleware needs
  one at runtime): the rendered `<title>`, description, robots, canonical, `og:*` and `twitter:*` tags on
  `/`, `/blue-hour`, `/login`, `/sign-up` and `/forgot-password` (the last is `noindex, nofollow` with the
  layout's image); `/robots.txt` (200 `text/plain`), `/sitemap.xml` (200 `application/xml`),
  `/opengraph-image` and `/twitter-image` (200 `image/png`, 1200x630); and the card itself by eye.
- **Not verified:** the `noindex` on the signed-in `(app)` pages (they redirect signed-out visitors, and no
  authenticated session was available — it is the same one-line export as `(auth)`, which was verified);
  a real link unfurl on Slack/X/LinkedIn, or Google's Rich Results / Search Console checks (the sandbox
  cannot reach them); the live site (nothing was deployed). Not built: per-page share images, structured
  data (JSON-LD), a web app manifest, and favicon/icon variants.

## Build reliability — Google Fonts could fail a build at random (FIXED: fonts are self-hosted)

**Fixed by self-hosting** (see the last bullet). The history below is kept because the failure
is not obvious from its symptom. Found while verifying the error-monitoring work: `npm run build` failed three times in
a row (after passing minutes earlier on identical code) with `TypeError: Cannot read
properties of null (reading '1')` inside `next/dist/compiled/@next/font/dist/google/
loader.js:122`. **Cause:** Google Fonts intermittently answers the same CSS request with a
newer *extensionless* font URL (`https://fonts.gstatic.com/l/font?kit=...&skey=...&v=...`)
instead of `.../name.woff2`, and Next 15.5.29's loader assumes every URL ends in a file
extension (`/\.(woff|woff2|eot|ttf|otf)$/.exec(url)[1]`). Measured by calling Next's own
fetcher 25 times for the exact `Cormorant Garamond` request: **2 of 25 (~8%) returned
a bad URL**. The app asks for five font families per build (Geist, Geist Mono, Fraunces in
the root layout, Cormorant Garamond in two marketing pages), so roughly **one build in three
can fail** — on Vercel and in CI as well, not just locally. It had not bitten before by luck.

- **Not related to any app code.** Identical code builds fine on a retry; the CSS and every
  font file download fine when run standalone, which is what ruled out the network rules
  and rate limiting (both were suspected first and wrong).
- **Short-term (no longer needed):** retry the build. A failed Vercel deployment from this
  error is safe to redeploy; production keeps serving the previous version.
- **Fix: all four families now come from committed files via `next/font/local`.**
  `src/fonts/app-fonts.ts` (Geist, Geist Mono, Fraunces; root layout) and
  `src/fonts/film-serif.ts` (Cormorant Garamond 300/400; only the landing page and
  `/blue-hour` import it, so product screens still do not load it). The CSS variable names
  are unchanged (`--font-sans`, `--font-mono`, `--font-fraunces`, `--font-film-serif`), so no
  component or stylesheet changed. `grep -rn "next/font/google" src` is empty.
  - **Where the files came from** (installed `--no-save` in a scratch directory outside the
    project, copied out, nothing added to `package.json`; table in `src/fonts/README.md`):
    Geist and Geist Mono from the `geist` package (the full variable woff2s, wght 100-900, ~70 kB
    each — no subsetting tool was available, so they are not latin-only); Fraunces from
    `@fontsource-variable/fraunces` (`latin-full-normal`: wght + opsz + SOFT + WONK axes, latin,
    121 kB — the same axes the Google version requested); Cormorant Garamond from
    `@fontsource/cormorant-garamond` (latin 300 and 400, normal, ~22 kB each). **Licences:** all
    four are SIL Open Font License 1.1; the texts are in `src/fonts/licenses/`.
  - **Verified:** `npm run build` passes with the proxy variables pointed at a dead address
    (`HTTPS_PROXY=http://127.0.0.1:1`), so the build cannot have used the network for fonts; no
    `fonts.googleapis.com`/`fonts.gstatic.com` string appears anywhere in `.next`; the built home
    page preloads five woff2 files from `/_next/static/media/`; and in headless Chromium the
    home page made **zero** requests to Google font hosts, all four families reported `loaded`
    in `document.fonts`, and the computed `font-family` was Geist on `body`, Fraunces on an
    `h2` and Cormorant on the film `h1`.
  - **Gotcha:** `next/font/local` derives the CSS family name from the exported *variable
    name* (`geistSans`, `fraunces`, `filmSerifFont`), not from the font's own name. Nothing
    references families by literal name (everything goes through the `--font-*` variables), but
    a devtools `font-family` now reads `geistSans, "geistSans Fallback"`. The film font export
    is `filmSerifFont` rather than `filmSerif` to avoid clashing with the `filmSerif` class
    string in `film-typography.ts`.
  - **Not done:** a side-by-side visual diff of every page against the old Google-served fonts
    (the files are the same typefaces and axes, and the home page was checked by eye).
