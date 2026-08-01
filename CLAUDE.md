# Voyagr — engineering notes

AI travel planner SaaS, built in 13 phases (full spec came from the user at
project kickoff). Each phase must compile, pass quality gates, and be
committed before the next begins — don't skip ahead without the user's go-ahead.

## Phase status

- [x] **Phase 1 — Project foundation**
- [x] **Phase 2 — Landing page & dashboard**, plus a post-review polish pass
  and a final professional design-refinement pass (this commit) — see
  "Phase 2 polish" and "Phase 2 final polish pass" below
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
