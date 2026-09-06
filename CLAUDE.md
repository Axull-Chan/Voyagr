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
- [ ] Phase 10 — Trip management (rename/duplicate/archive/export)
- [ ] Phase 11 — PDF export
- [ ] Phase 12 — Premium features
- [ ] Phase 13 — Production polish

## Infrastructure

- Supabase project: `ai-travel-planner` (ref `rwihjdriuyfqenubvplj`), org
  `Axull-Chan's Org`, region `ap-southeast-1`. The account has two other,
  unrelated Supabase projects — never point migrations at those.
- Package manager: npm (no pnpm/yarn/bun installed locally).

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
- Verified live in the browser rather than from source: light and dark
  mode on `/sign-up` (elevation inversion visible — the card panel is
  lighter than the page in dark mode, darker in light mode, exactly as
  DESIGN.md specifies), the marketing page's `text-display`/`text-headline`
  elements post-fix, and both new `bg-tertiary`/`bg-tertiary-subtle`
  Tailwind utilities via computed-style probes (same `@theme inline` risk
  class as the font-heading bug, checked for the same reason). The
  countdown badge and map markers are code- and type-verified, exact hex
  match to the derivation, but not pixel-verified live — both need an
  authenticated trip with a real start date/places, which this pass didn't
  create; said explicitly rather than implied from the code being correct.

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

- Base color neutral/zinc, with an indigo/violet accent layered on top of
  the shadcn `base-nova` preset defaults (see CSS variables in
  `src/app/globals.css`) — the preset itself ships fully grayscale.
- Fonts: Geist Sans + Geist Mono via `next/font/google`.
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
