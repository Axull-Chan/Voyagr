# Voyagr — engineering notes

AI travel planner SaaS, built in 13 phases (full spec came from the user at
project kickoff). Each phase must compile, pass quality gates, and be
committed before the next begins — don't skip ahead without the user's go-ahead.

## Phase status

- [x] **Phase 1 — Project foundation**
- [x] **Phase 2 — Landing page & dashboard**, plus a post-review polish pass,
  a final professional design-refinement pass, two out-of-sequence hero
  redesign passes, and a feature-section redesign (this commit) — see
  "Phase 2 polish", "Phase 2 final polish pass", "Phase 2.5", and "Feature
  section redesign" below
- [ ] Phase 3 — Create trip wizard
- [ ] Phase 4 — AI itinerary generation (OpenAI)
- [ ] Phase 5 — Maps & location (Google Maps)
- [ ] Phase 6 — Weather + currency + restaurants
- [ ] Phase 7 — Budget tracker
- [ ] Phase 8 — Packing checklist
- [ ] Phase 9 — AI travel assistant (chat-based itinerary editing)
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
