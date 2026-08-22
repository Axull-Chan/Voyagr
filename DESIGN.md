---
version: alpha
name: Voyagr
description: An AI travel planner where a trip reads like a kept travel journal — day-by-day narrative and real destination photography carry the page, budget and packing sit behind it as quiet reference material.

colors:
  primary: "#587b7f"
  primary-strong: "#244F54"
  primary-subtle: "#D9ECEE"
  secondary: "#393e41"
  tertiary: "#e2c044"
  tertiary-subtle: "#F5EBCF"
  neutral: "#d3d0cb"
  surface: "#F8F6F4"
  on-surface: "#1e2019"
  border: "#BBB7B0"
  error: "#A23D3A"
  surface-dark: "#1A0F08"
  on-surface-dark: "#EAE4D9"
  neutral-dark: "#38271D"
  border-dark: "#493930"
  primary-strong-dark: "#85B9BF"
  primary-subtle-dark: "#0A3438"
  secondary-dark: "#A2B0B9"
  error-dark: "#E47C72"
  marker-hotel: "#A6567E"
  marker-restaurant: "#BF6F33"
  marker-activity: "#3D865A"

typography:
  display:
    fontFamily: Fraunces
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Fraunces
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Fraunces
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  body-lead:
    fontFamily: Fraunces
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.5
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.65
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.12em
  data-lg:
    fontFamily: Geist Mono
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.2
    fontFeature: "'tnum' 1"
  data-md:
    fontFamily: Geist Mono
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  data-sm:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.02em
    fontFeature: "'tnum' 1"
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4

rounded:
  none: 0px
  sm: 2px
  md: 4px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 24px
  margin: 32px

components:
  page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  map-marker-destination:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    size: 12px
  map-marker-hotel:
    backgroundColor: "{colors.marker-hotel}"
    rounded: "{rounded.full}"
    size: 12px
  map-marker-restaurant:
    backgroundColor: "{colors.marker-restaurant}"
    rounded: "{rounded.full}"
    size: 12px
  map-marker-activity:
    backgroundColor: "{colors.marker-activity}"
    rounded: "{rounded.full}"
    size: 12px
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.surface}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  button-primary-hover:
    backgroundColor: "#0C3D42"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  nav-active:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    padding: "{spacing.sm}"
  badge-status:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  badge-countdown:
    backgroundColor: "{colors.tertiary-subtle}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  badge-countdown-urgent:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  data-stat:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.data-lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  input-error:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
  checkbox-checked:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    size: 18px
  tooltip:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  page-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-surface-dark}"
    typography: "{typography.body-md}"
  divider-dark:
    backgroundColor: "{colors.border-dark}"
    height: 1px
  card-dark:
    backgroundColor: "{colors.neutral-dark}"
    textColor: "{colors.on-surface-dark}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  row-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-surface-dark}"
    typography: "{typography.body-md}"
  button-primary-dark:
    backgroundColor: "{colors.primary-strong-dark}"
    textColor: "{colors.surface-dark}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  button-secondary-dark:
    backgroundColor: "{colors.neutral-dark}"
    textColor: "{colors.primary-strong-dark}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  nav-active-dark:
    backgroundColor: "{colors.primary-subtle-dark}"
    textColor: "{colors.primary-strong-dark}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  badge-status-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.secondary-dark}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  data-stat-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-surface-dark}"
    typography: "{typography.data-lg}"
  input-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-surface-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  input-error-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.error-dark}"
    typography: "{typography.body-sm}"
  checkbox-checked-dark:
    backgroundColor: "{colors.primary-strong-dark}"
    textColor: "{colors.surface-dark}"
    rounded: "{rounded.sm}"
    size: 18px
  tooltip-dark:
    backgroundColor: "{colors.on-surface-dark}"
    textColor: "{colors.surface-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
---

# Voyagr

## Overview

Voyagr is used in short, focused sessions — someone building an itinerary at a kitchen table, or checking tomorrow's plan the morning of. It is not used for hours at a stretch, and it is not high-stakes: the cost of a wrong note here is a mildly wrong afternoon, not a missed flight. That combination — discretionary, imagery-rich, read in bursts — is what rules out the dense operational registers (Terminal Precision, Utility Dense) and points toward something closer to a kept object: a travel journal.

The direction is **Field Journal** — Warm Analog's paper-and-ink calm for anything the user consults (budget, packing, transport), crossed with Editorial Print's serif storytelling for anything the user reads (the trip hero, the day-by-day plan). The system draws a real line between these two registers rather than blurring them: a page should be legible, at a glance, as either "the story of this trip" or "the reference material about it."

What this gives up, deliberately: **uniform density.** Every screen does not look the same amount of "full." The hero and the day narrative are spacious and slow; the budget table and the packing list are allowed to be tighter and quieter. A system that insisted on identical rhythm everywhere would flatten exactly the distinction this direction exists to make.

The palette carries its own travel logic: an ink for writing the plan down (`primary`), brass fittings and departure-board lettering for the one thing that's actually time-sensitive (`tertiary`), and paper for everything else. Nothing in it is pulled from a framework default — see Colors.

Voyagr supports both a light and a dark theme, and this system designs both: light mode is the journal's paper, dark mode is its leather cover read by lamplight. The dark palette is a separate, from-scratch derivation — reduced chroma, an inverted elevation direction, its own hue family — not the light tokens run through an inversion filter. See the "Dark mode" subsection under Colors and the corresponding note under Elevation & Depth.

## Colors

The palette reads as travel hardware and travel paper, not as a brand kit. Four of five core colors are exact, deliberately chosen values; everything else is derived in the same OKLCH neighborhood rather than picked separately, so the system holds together as one material rather than five.

- **Primary — Pine Blue (#587b7f):** a weathered, desaturated teal-ink. It is the identity color — icons, map markers, large decorative elements — but it is a genuine mid-tone (measured contrast 3.6:1 against both `on-surface` and `surface`), so it never carries text of its own. That's a real constraint this system accepts rather than papers over: `primary` is a color you *see*, not one you *read*.
- **Primary Strong (#244F54):** the same ink, deepened until it's safe under real text (8.4:1 on `surface`). This is the color that actually does the interaction work — every button, every link, every piece of primary UI that needs to hold a label.
- **Primary Subtle (#D9ECEE):** the palest wash of the same ink, for selected and active states — a highlighted day, an active nav item.
- **Secondary — Gunmetal (#393e41):** a cool, near-neutral dark, reserved for metadata: timestamps, counts, provenance captions, anything that should read as *apparatus* rather than *content*.
- **Tertiary — Old Gold (#e2c044):** brass fittings, luggage-tag lettering, a departure board mid-flip. The only genuinely saturated color in the system, and it has exactly one job: marking that a trip's dates are close. It appears nowhere except the countdown badge on a trip hero, and that scarcity is the whole mechanism — if gold showed up on a button or an icon too, the countdown would stop meaning anything.
- **Neutral — Dust Grey (#d3d0cb):** worn paper, used as the fill for genuinely discrete objects — a trip card, nothing else.
- **Surface (#F8F6F4):** a lighter, barely-there step of the same paper tone as Neutral. This is the page itself. The half-step between Surface and Neutral is deliberate: a card should read as a slightly different paper stock laid on the page, not as a box floating above it.
- **On-surface — Carbon Black (#1e2019):** ink on the page. Carries a trace of warmth (a faint olive cast) rather than sitting at true black, which is why body text reads as settled rather than printed on top.
- **Border (#BBB7B0):** a hairline step between Neutral and Surface — for dividing, never for enclosing.
- **Error (#A23D3A):** a brick-and-oxide red, built at the same restrained chroma as the rest of the palette rather than imported from a stock alert red. A mistake in a travel plan should look like a smudge of red ink, not a system alarm.

Every neutral in this system is warm-tinted (OKLCH hue ≈ 75–90 for the paper family); nothing has R = G = B, and neither pure `#FFFFFF` nor pure `#000000` appears anywhere.

### Dark mode: the same journal, its cover

Dark mode is not this palette inverted — it's a different material in the same object. Light mode is the journal's paper, read by daylight. Dark mode is its leather cover and brass fittings, read by lamplight. That distinction shows up as a real hue shift, not just a lightness flip: the paper family sits at OKLCH hue ≈68–82 (pale straw), while the leather family sits at hue ≈52 (warm umber) — two different substances, not one substance with the lights off.

- **Surface Dark — leather (#1A0F08):** the page itself in dark mode. A near-black warm umber, not a desaturated grey and not the slate-navy that "dark mode" defaults to almost everywhere.
- **On-surface Dark — lamplight ink (#EAE4D9):** body text. A warm parchment tone rather than white — the same "no pure endpoint" rule that governs light mode's ink applies symmetrically here.
- **Neutral Dark — tooled leather (#38271D):** the card fill, and the one token whose *relationship* to Surface Dark is the opposite of its light-mode counterpart — see Elevation & Depth.
- **Border Dark (#493930):** the hairline rule, one step up from Surface Dark, at roughly the same perceptual step (1.7:1) as light mode's own border-on-surface relationship.
- **Primary Strong Dark — pine under lamplight (#85B9BF):** lightened from Primary Strong so it reads clearly against near-black, with chroma held close to Primary Strong's own (0.055 vs. 0.048) rather than pushed higher — a saturated accent gets louder, not calmer, against a dark ground, so dark mode's version of an accent color should never be *more* intense than its light counterpart. This is the dark-mode interactive workhorse, same job as its light counterpart.
- **Primary Subtle Dark (#0A3438):** the active/selected lift. Notably *lighter* than Surface Dark, not darker — a selected row should catch more lamplight than its surroundings, the same logic as Neutral Dark.
- **Secondary Dark (#A2B0B9):** Gunmetal lightened for metadata text against a dark ground.
- **Error Dark (#E47C72):** Error, lightened the same way Primary Strong is — a dark ground needs a lighter accent to read at all.

**Tertiary, Tertiary Subtle, and base Primary are unchanged in dark mode.** Brass fittings don't need to be redesigned for lamplight — they're made for it. The countdown badges and the map markers use the identical light-mode values in both themes; every pairing they rely on was re-verified against the dark tokens and still holds.

## Typography

Two families, split by job — voice and apparatus — plus a mono for anything counted or timed.

**Fraunces** carries the voice: the trip hero title, section headlines, day headings, and — at `body-lead` — the day's own narrative summary. It's a variable serif with real optical-size and `SOFT`/`WONK` axes, which is why it can sit at 64px without going thin and fragile, and why it reads as *written* rather than *set* — the right quality for something standing in for a travel journal's own hand. Fallback: `Fraunces, "Source Serif 4", Georgia, serif`. SIL Open Font License, self-hosted.

**Geist** carries the apparatus: body copy, labels, buttons, form controls. It was already the sole typeface in the product before this system, doing every job at once — that "one face for everything" is the actual mechanism this system corrects, not Geist itself, which is a genuinely well-made grotesque already self-hosted and licensed in the codebase. Kept deliberately rather than replaced: introducing Fraunces for the voice role fixes the real problem without discarding infrastructure that was never the issue.

**Geist Mono** carries anything measured: prices, dates, times, walking distances, day counts. Tabular figures (`'tnum' 1`) are on throughout, so a column of expense amounts or a stack of activity times actually aligns.

The scale runs 11 → 64px, generated at a 1.25 ratio and hand-broken at the top — the jump from `body-md` (16px) to `headline-lg` (40px) is meant to feel like a jump, not a step. Tracking moves with size: −0.03em at display, neutral through body, +0.12em on uppercase labels. Line-height runs inversely, 1.05 at display to 1.65 at `body-lg`. Only two weights are used anywhere in the system — 400 and 600, the same two numbers in every family — because a third weight reads as indecision, and because hierarchy here is meant to come from family and size, not from a weight ladder.

## Layout

Content sits in a **72rem (1152px)** column — unchanged from the current implementation, which was already a reasonable width and didn't need to move.

The system's one committed asymmetric device is the trip-detail page's existing `1fr / 20rem` split: a wide primary column carrying the hero, map, and day-by-day plan, beside a narrower, fixed-width rail carrying stays, transport, and notes. This is not a new pattern — it's the one asymmetric instinct already in the product, formalized as the model for "primary content beside reference material" everywhere that shape recurs.

Spacing runs on an **8px base** with a 4px half-step for micro-adjustment (chip padding, icon gaps). Body measure is capped at **65 characters** for anything read at length — day summaries and activity descriptions — set explicitly rather than left to the container.

Density is intentionally uneven across a trip page. The hero and the day-by-day narrative get generous vertical rhythm; budget, packing, and the stays/transport rail tighten up considerably. That contrast is the primary hierarchy device on the page: the density shift tells a reader which register they're in — story or reference — before they read a word of it.

## Elevation & Depth

Voyagr is almost entirely flat. There is no shadow language for ordinary content — no card, row, or badge in this system casts one.

Depth is carried by three devices:

1. **Tonal layering** — the Surface → Neutral half-step. A trip card is a slightly different paper stock on the page, not an object floating above it. This is the same logic Stage 2D's trip-detail aside already proved out (`bg-muted` over `bg-card`); this system generalizes it into the palette itself rather than leaving it as one page's exception.
2. **Hairline rules** — 1px `border`, dividing rows and sections without enclosing them. The `divider` component exists specifically because `borderColor` has no token of its own in this format; a 1px-tall filled rule *is* a border, modeled honestly.
3. **Space** — the primary grouping tool. Most apparent "this needs a shadow" moment is actually a spacing problem, and should be solved there first.

**The one exception is genuinely floating content** — Dialog and Sheet overlays, which are already built on Base UI plus Framer Motion (Stage 2B) and are out of this system's scope entirely. Their existing soft shadow is correct precisely because they're the one thing in the interface actually above everything else; nothing here asks for it to change.

**Dark mode inverts the direction of the tonal step, not just its colors.** In light mode, a card (Neutral, #d3d0cb) is a step *down* from the page — more pigmented paper laid on paler paper. In dark mode, a card (Neutral Dark, #38271D) is a step *up* from the page (Surface Dark, #1A0F08) — a tooled leather panel catching more lamplight than the cover around it, the same convention that governs why a raised surface in a dark room reflects more light rather than less. The two steps are proportionally matched (light: 1.43:1, dark: 1.32:1) so neither theme's hierarchy reads as weaker than the other's — only the sign of the step flips. The tooltip carries a related but distinct rule: it's always the *opposite polarity* from its surroundings, a dark chip on the light page and a light chip on the dark page, so it reads as a floating callout in both themes rather than blending into whichever surface is currently the "light" one.

## Shapes

Radius is small and hierarchical, not uniform: `2px` on anything you operate (buttons, inputs), `4px` on anything you look at as a discrete object (cards, the trip hero, image containers), and `0` everywhere else.

`full` (`9999px`) is not a fourth step on that ramp — it means the shape is *genuinely circular or capsule*, where the radius isn't a style choice at all: avatars, map markers, status dots, progress tracks, the sheet's drag handle. Among things that could plausibly be either, the rule is narrow: **of the badges, only the countdown is a pill.** A status badge is content and takes the 2px operable radius; the countdown is a signal, and the enclosed shape is what marks it as a different class of object.

This is a real departure from the current implementation, which defaults to a 14px radius (`rounded-xl`) on nearly everything — the single most common shape in the product today. Pulling every surface down to 0–4px is the shape-language half of "borders are earned, not default": a sharper, quieter geometry that reads as considered rather than soft-by-default.

**Dialog and Sheet are exempt and keep their current 14px corners.** They're out of this system's scope (see Elevation & Depth), and they're the one place a softer, larger radius still earns its keep: a panel that genuinely floats above the page reads as a separate physical object, not a region of it. Implementations must give them a dedicated radius value rather than letting them inherit the shared scale, so that shrinking the scale can't reshape them by accident.

## Components

**Buttons.** Primary is a solid `primary-strong` fill with `surface` text, set in `label-caps` — the deep-ink color rather than base `primary`, because base `primary` cannot carry text at AA on its own. Secondary is a `neutral` fill with `primary-strong` text. There is no tertiary button; tertiary is a color, not an action level.

**Map markers.** Four kinds of pin need to stay distinguishable at a glance, so this is a small dedicated set rather than one reused color: `map-marker-destination` is the one place base `primary` appears directly (identity, no text). The other three are new, purpose-built tokens rather than a second job for `tertiary` — Marker Hotel (`#A6567E`, a sealing-wax rose), Marker Restaurant (`#BF6F33`, an ochre), and Marker Activity (`#3D865A`, a trail green), spaced around the hue wheel for real distinguishability and kept out of the 260–330° indigo-violet band on purpose. All four are small filled dots with no text, sized 12px, replacing `trip-map.tsx`'s current stock Tailwind quad (`#6366f1`/`#0ea5e9`/`#f59e0b`/`#10b981`) with values that actually belong to this palette.

**Cards (`card`).** `neutral` fill, 4px radius, no border, no shadow — the tonal step alone separates a card from the page. Reserved for genuinely discrete, comparable objects: a trip in a grid of trips. Not used for a single saved favorite, a budget section, or anything else that is one thing rather than one of many.

**Rows (`row`).** Page-background fill, no radius, separated by `divider` below rather than by a container around them. This is the default for list content — a day's activities, a packing item, a favorite place — matching the pattern the day timeline already uses today, extended to the places that currently use a card instead.

**Badges.** `badge-status` (trip status: Draft, Ready) is deliberately quiet — page background, secondary text, no fill of its own. `badge-countdown` and `badge-countdown-urgent` are the only pill-shaped, tertiary-colored elements in the system, and the only two states between them: subtle gold wash for "in N days," full gold for "tomorrow" or "today." Escalating gold as a trip nears is the entire visual vocabulary of urgency in this product — there is no other one.

**Data (`data-stat`, and `data-md`/`data-sm` inline).** Every price, date, time, and distance is set in Geist Mono with tabular figures. A column of expense amounts must align; proportional figures make it jitter.

**Inputs.** `surface` fill, 1px `border`, 2px radius, full `body-md` size rather than a smaller UI size — filled in while looking at a map or a calendar, not while sitting still. Error state switches text to `error`; always paired with a written message, never color alone.

**Checkboxes (`checkbox-checked`).** `primary-strong` fill with a `surface` checkmark — packing-list items, the one place a filled checkbox appears.

**Tooltips.** `on-surface` fill with `surface` text — the one inversion in the system.

**Dark mode.** Every `*-dark` component is a full, independently-verified restatement of its light counterpart, not a CSS filter — `button-primary-dark`, `card-dark`, `row-dark`, `divider-dark`, `input-dark`/`input-error-dark`, `checkbox-checked-dark`, `nav-active-dark`, `badge-status-dark`, `data-stat-dark`, `button-secondary-dark`, and `tooltip-dark`, all wired to the eight `*-dark` color tokens. The four `map-marker-*` components and both countdown badges have no dark counterpart on purpose — Tertiary, base Primary, and the three marker colors all carry over unchanged (see Colors); a map pin's job is to be found against varied, uncontrollable map-tile colors, not to sit AA-safe against a page background, so the light/dark contrast logic that governs everything else doesn't apply to it.

## Do's and Don'ts

- **Do** keep `tertiary` (#e2c044) on the countdown badge and nowhere else. Its entire legibility as "this is time-sensitive" depends on it appearing nowhere else in the interface.
- **Don't** use base `primary` (#587b7f) as a text color, in either direction. It measures 3.6:1 against both `on-surface` and `surface` — under AA at any text size. Use `primary-strong` for anything that reads as a word.
- **Do** wrap a trip in a card. Don't wrap anything else in one — a budget section, a packing list, a single favorite, and a day's activities are all `row`, not `card`.
- **Don't** add a drop shadow to ordinary content. If something needs to feel separated, reach for the Surface→Neutral step or a `divider` first. Shadows stay reserved for Dialog/Sheet overlays, which already have them.
- **Do** set every price, date, time, and distance in a `data-*` typography token. Numbers set in Geist Sans will not align in a column next to numbers that are.
- **Don't** introduce a third weight. Every typeface in this system uses exactly 400 and 600 — if a heading isn't reading as a heading, give it more space above it, not more weight.
- **Do** cap body measure at 65 characters for day summaries and activity descriptions — they're read, not scanned.
- **Don't** pair an error state with color alone. Every `input-error` needs a written message alongside the red.
- **Do** let density vary between the hero/narrative and the reference sections (budget, packing, transport). That contrast is load-bearing — it's how a reader knows which kind of content they're looking at.
- **Don't** touch Dialog, Sheet, drag/gesture physics, or any Framer Motion constant to implement this system. It is a visual language, not a motion or interaction change.
- **Don't** derive a dark-mode color by running a light-mode value through an automatic inverter, darkener, or opacity trick. Every `*-dark` token was designed and contrast-verified on its own terms — if a new component needs a color this system doesn't have yet, derive it the same way: in OKLCH, from the leather/lamplight material logic, not from `filter: invert()`.
- **Do** keep the card elevation step inverted between themes — lighter-than-page for a dark-mode card, darker-than-page for a light-mode one. Flattening this to "cards are always darker than the page" breaks dark mode's own logic, not just its look.
