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
  border-interactive: "#777068"
  error: "#A23D3A"
  surface-dark: "#1A0F08"
  on-surface-dark: "#EAE4D9"
  neutral-dark: "#38271D"
  border-dark: "#493930"
  border-interactive-dark: "#948274"
  primary-strong-dark: "#85B9BF"
  primary-subtle-dark: "#0A3438"
  secondary-dark: "#A2B0B9"
  error-dark: "#EB8278"
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
  control-boundary:
    backgroundColor: "{colors.border-interactive}"
    height: 1px
  control-boundary-dark:
    backgroundColor: "{colors.border-interactive-dark}"
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

### How to read this document

This file has three kinds of content, and they must never be confused:

| Part | What it is | Status |
|---|---|---|
| **Spec** — Overview through Anti-Patterns | What Voyagr's interface *should* be. Normative. | Decided |
| **Implementation Status** | What the codebase *actually does* today, audited against the spec. | Observed |
| **Design Implementation Roadmap** | What to change, in priority order. | Planned |

**The spec sections describe intent, not reality.** Anything the spec asserts is only true in the product if the Implementation Status table says so. When the two disagree, the spec is the target and the status table is the truth — fix the code, not the spec, unless the spec is what turns out to be wrong.

The frontmatter tokens are normative. The prose exists so that a decision this file never anticipated still has a defensible answer.

### The product

Voyagr is used in short, focused sessions — someone building an itinerary at a kitchen table, or checking tomorrow's plan the morning of. It is not used for hours at a stretch, and it is not high-stakes: the cost of a wrong note here is a mildly wrong afternoon, not a missed flight. That combination — discretionary, imagery-rich, read in bursts — rules out the dense operational registers and points toward a kept object: a travel journal.

The direction is **Field Journal** — paper-and-ink calm for anything the user *consults* (budget, packing, transport), crossed with serif editorial storytelling for anything the user *reads* (the trip hero, the day-by-day plan). The system draws a real line between these two registers rather than blurring them: a page should be legible at a glance as either "the story of this trip" or "the reference material about it."

What this gives up, deliberately: **uniform density.** Every screen does not look equally full. The hero and the day narrative are spacious and slow; the budget table and the packing list are tighter and quieter. A system that insisted on identical rhythm everywhere would flatten exactly the distinction this direction exists to make.

Voyagr ships a light and a dark theme, and this system designs both: light mode is the journal's paper, dark mode is its leather cover read by lamplight. The dark palette is a separate, from-scratch derivation, not an inversion.

**Scope note.** The marketing pages (`/`, `/blue-hour`) and the Blue Hour scroll-film run their own deliberately separate visual world — a fixed dark cinematic palette scoped to `.film-surface`, plus Cormorant Garamond. That is intentional and out of scope here. **This document governs the product UI**: everything under `(app)`, plus the auth screens and the shared primitives in `components/ui`.

## Visual Hierarchy

Every visual decision in Voyagr answers one question: **is this the story, the reference, or the apparatus?**

Six tiers, derived from what a trip page actually contains. A thing's tier determines its surface, its type, and how much space it gets — in that order.

| Tier | What lives here | How it reads |
|---|---|---|
| **1 — Destination imagery** | The trip hero photograph | Full-bleed, edge to edge, nothing competing. The single most dominant element in the product. |
| **2 — Trip identity** | Trip title, dates, countdown badge | Serif, large, sitting on or directly beneath the image. The only place `tertiary` gold appears. |
| **3 — The narrative** | Day-by-day plan, day summaries, activities | The reason the product exists. Generous vertical rhythm, serif day headings, comfortable measure. Never compressed to fit something else in. |
| **4 — Spatial context** | The map | One large, quiet, full-width object. Supports Tier 3; never competes with it. |
| **5 — Reference material** | Budget, packing, stays, transport, weather, favorites | Deliberately tighter and quieter than Tier 3. Rows and rules, not cards. Mono for every number. |
| **6 — Apparatus** | Sidebar, header, buttons, inputs, badges, metadata, provenance captions | Should disappear until needed. Small, sans, low contrast. Never gains emphasis at the expense of Tiers 1–3. |

Three rules follow from this and are not negotiable:

1. **Tier 5 must never look more important than Tier 3.** If the budget section reads as heavier than the day plan, the page has failed regardless of how good the budget section looks on its own.
2. **Tier 6 never uses Tier 1–3 devices.** No serif on a button. No large type on a metadata label. No accent color on apparatus.
3. **Density is the hierarchy signal.** Tiers 1–3 are spacious; Tiers 5–6 are tight. That contrast is load-bearing — it is how a reader knows which register they are in before reading a word.

## Colors

The palette reads as travel hardware and travel paper, not as a brand kit. Everything is derived in the same OKLCH neighborhood rather than picked separately, so the system holds together as one material rather than a set of swatches.

- **Primary — Pine Blue (#587b7f):** a weathered, desaturated teal-ink. The identity color — map markers and large decorative elements — but a genuine mid-tone (3.6:1 against both `on-surface` and `surface`), so **it never carries text**. `primary` is a color you *see*, not one you *read*.
- **Primary Strong (#244F54):** the same ink, deepened until it is safe under real text (8.4:1 on `surface`). This does all the interaction work — every button, link, and control that holds a label.
- **Primary Subtle (#D9ECEE):** the palest wash of the same ink, for selected and active states.
- **Secondary — Gunmetal (#393e41):** a cool near-neutral dark, reserved for metadata: timestamps, counts, provenance captions — anything that reads as *apparatus* rather than *content*.
- **Tertiary — Old Gold (#e2c044):** brass fittings and departure-board lettering. The only genuinely saturated color in the system, with exactly one job: marking that a trip's dates are close. Its scarcity *is* the mechanism.
- **Neutral — Dust Grey (#d3d0cb):** worn paper. The fill for genuinely discrete objects.
- **Surface (#F8F6F4):** the page itself. The half-step to Neutral is deliberate: a card is a different paper stock laid on the page, not a box floating above it.
- **On-surface — Carbon Black (#1e2019):** ink. Carries a trace of warmth rather than sitting at true black.
- **Border (#BBB7B0):** a hairline step — for dividing, never for enclosing. At 1.85:1 on the page it is deliberately too faint to mark something you operate.
- **Border Interactive (#777068):** the boundary of a control — input, select, textarea, checkbox, an unselected wizard option. WCAG 1.4.11 asks 3:1 against whatever it sits on: 4.51 page, 4.69 dialog, 3.16 card, 3.55 muted. Never used as a divider.
- **Error (#A23D3A):** brick-and-oxide red at the same restrained chroma as everything else. A mistake should look like a smudge of red ink, not a system alarm.

Every neutral is warm-tinted (OKLCH hue ≈ 75–90); nothing has R = G = B, and neither pure `#FFFFFF` nor pure `#000000` appears anywhere.

### Token names in code do not match token names here

**This is the single most dangerous thing in this document to get wrong.** The CSS custom properties in `globals.css` are shadcn's semantic names, not this file's names, and one pair actively collides:

| This document | CSS variable / Tailwind class | Note |
|---|---|---|
| `primary-strong` | `--primary` / `text-primary`, `bg-primary` | ⚠️ **`--primary` is `primary-strong` (#244F54), *not* `primary` (#587b7f).** |
| `primary` (#587b7f) | *(no CSS variable)* | Exists only as a hardcoded hex in `trip-map.tsx`. |
| `primary-subtle` | `--accent` | |
| `secondary` | `--muted-foreground` | ⚠️ **not** `--secondary`, which is a *surface*. |
| `surface` | `--background` | |
| `on-surface` | `--foreground` | |
| `neutral` | `--card`, `--popover`, `--secondary`, `--muted` | See the surface-collapse note in Elevation & Depth. |
| `border` | `--border` | Dividers only. |
| `border-interactive` | `--border-interactive` / `border-border-interactive` | Control boundaries. `--input` is the field's faint fill tint, not its border. |
| `error` | `--destructive` | |
| `tertiary` | `--tertiary` | Added for this system; only `Badge` consumes it. |

Because `--primary` resolves to `primary-strong`, **`text-primary` is AA-safe and correct** — it is not the forbidden mid-tone. The rule "never use `primary` as a text color" refers to the raw hex #587b7f, which no CSS class exposes.

### Dark mode: Espresso Command Center

The dark theme is named the **Espresso Command Center**: the same journal, its leather cover, read under lamplight. Dark mode is a different material in the same object, not this palette inverted. The paper family sits at OKLCH hue ≈68–82 (pale straw); the leather family sits at hue ≈52 (warm umber) — two substances, not one substance with the lights off.

- **Surface Dark — leather (#1A0F08):** a near-black warm umber, not a desaturated grey and not the slate-navy that "dark mode" defaults to almost everywhere.
- **On-surface Dark — lamplight ink (#EAE4D9):** warm parchment rather than white.
- **Neutral Dark — tooled leather (#38271D):** the card fill, and the one token whose *relationship* to its page is inverted — see Elevation & Depth.
- **Border Dark (#493930):** the hairline, at roughly the same perceptual step as light mode's. Dividers only.
- **Border Interactive Dark (#948274):** control boundaries — 5.15 page, 3.88 card, 3.43 dialog, 4.33 muted. (A darker `#786A5C` was considered and measured 2.40:1 on the dialog surface every form sits on.)
- **Primary Strong Dark (#85B9BF):** lightened so it reads against near-black, with chroma held close to its light counterpart (0.055 vs 0.048) rather than pushed higher — a saturated accent gets *louder* against a dark ground, so dark mode's accent must never be more intense than light mode's.
- **Primary Subtle Dark (#0A3438):** the active/selected lift, *lighter* than the page.
- **Secondary Dark (#A2B0B9)** and **Error Dark (#EB8278):** lightened for a dark ground. Error Dark was #E47C72 until it measured 4.45:1 as the Delete item in a dropdown; #EB8278 is 4.80:1 there.

### Verified contrast

`src/lib/design/contrast.test.ts` reads every token out of `globals.css` and asserts, in both themes: **4.5:1** for every text/surface pair the components use (SC 1.4.3), and **3:1** for control borders, focus rings and the active-nav indicator against every surface they can sit on — page, card, popover, muted, sidebar (SC 1.4.11). A token edit that breaks a pair fails CI; the ratios quoted in this section are the ones it computes. The same test fails if a UI primitive draws a focus ring at partial opacity or borders a field with anything but `border-interactive`.

**Tertiary, Tertiary Subtle, and base Primary are unchanged in dark mode.** Brass fittings are made for lamplight. The countdown badges and map markers use identical values in both themes.

## Typography

Two families split by job — voice and apparatus — plus a mono for anything counted or timed.

**Fraunces** carries the voice: the trip hero title, section headlines, day headings, and the day's own narrative summary. A variable serif with real optical-size and `SOFT`/`WONK` axes, so it holds at display sizes without going thin, and reads as *written* rather than *set*.

**Geist** carries the apparatus: body copy, labels, buttons, form controls. It was the sole typeface before this system — "one face doing every job" is the mechanism this system corrects, not Geist itself.

**Geist Mono** carries anything measured: prices, dates, times, distances, counts. Tabular figures throughout, so a column of amounts actually aligns.

Only **two weights** exist in this system — 400 and 600, the same two in every family. Hierarchy comes from family and size, never from a weight ladder. If a heading is not reading as a heading, give it more space, not more weight.

### Fixed token sizes vs. fluid utilities

The `typography` tokens above carry **fixed px values that are the desktop anchor**, not a literal instruction to hardcode that size. The implementation expresses each level as a fluid `clamp()` so a viewport gets its own correct size in one declaration, with optical tracking baked into the same rule. Both are correct; the token is the value the clamp should reach at desktop width. A level whose clamp maximum sits far below its token value is a bug in the clamp, not a licence to ignore the token.

### The type levels

| Level | Family | Role |
|---|---|---|
| `display` | Fraunces 600 | Marketing hero only. Not used in product UI. |
| `headline-lg` | Fraunces 600 | Page title — dashboard greeting, "Your trips". |
| `headline-md` | Fraunces 600 | Trip title on hero and card; major section headings. |
| `headline-sm` | Fraunces 600 | Day heading; sub-section headings. |
| `body-lead` | Fraunces 400 | A day's narrative summary — the one place serif carries body copy. |
| `body-lg` / `body-md` / `body-sm` | Geist 400 | Reading copy, default UI text, dense secondary text. |
| `label-md` | Geist | Nav items and control labels. |
| `label-caps` | Geist 600, +0.12em, uppercase | Eyebrows, buttons, badges. |
| `data-lg` / `data-md` / `data-sm` | Geist Mono, tnum | Stat values; inline numbers; dense numeric metadata. |
| `caption` | Geist 400 | Provenance notes, photo credits, footnotes. |

## Layout

Content sits in a **72rem (1152px)** column with 24px page padding.

The system's one committed asymmetric device is the trip-detail `1fr / 20rem` split: a wide primary column carrying hero, map and day plan, beside a narrower fixed rail carrying stays, transport and notes. This is the model for "primary content beside reference material" wherever that shape recurs.

Spacing runs on an **8px base** with a 4px half-step for micro-adjustment. Only values from the `spacing` scale are permitted — no arbitrary px.

Section rhythm carries meaning and is not uniform:

- **Between major sections** (map → day plan → budget): 24px minimum, more where the register changes.
- **Between peer items in a list** (activities, packing rows): 8–12px. Tight on purpose.
- **Between a heading and its content**: 12px. A heading belongs to what follows it, and must sit closer to it than to the section above.

Body measure is capped at **65 characters** for anything read at length — day summaries and activity descriptions — set explicitly rather than left to the container.

### Responsive behaviour

Three ranges. **768px is the structural breakpoint** — it is what `useIsMobile` uses to switch the sidebar between a rail and a Sheet, and no new breakpoint should be invented near it.

| | **Mobile** (< 768px) | **Tablet** (768–1023px) | **Desktop** (≥ 1024px) |
|---|---|---|---|
| **Sidebar** | Sheet, opened from the header trigger | Sheet | Persistent rail, collapsible to icons |
| **Trip detail rail** | Stacks below the main column | Stacks below | `1fr / 20rem`, sticky |
| **Trip card grid** | 1 column | 2 columns | 3 columns |
| **Stat row** | 2 columns | 2 columns | 4 columns |
| **Day activities** | Time column stays; text wraps beneath | Same | Same |
| **Expense / packing forms** | Stack fully (`flex-col`) | Row | Row |
| **Map** | Full width, reduced height | Full width | Full width |

Rules that hold across all three:

- **Nothing in Tiers 1–3 disappears on mobile.** The hero, the day plan and the map are the product. Reference material may collapse, condense, or move below; the narrative may not.
- **Stack, don't shrink.** A row that would squeeze becomes `flex-col` at the breakpoint rather than `flex-wrap` — wrapping permits shrinking, and a tight-but-not-overflowing row is a bug a scroll-width check cannot see.
- **A destructive or secondary action that becomes cramped becomes a Sheet on mobile**, never a smaller tap target.
- **Touch targets: 44×44px (WCAG 2.2 AAA, SC 2.5.5).** Default and large controls — `Button` `default`/`lg`/`icon`/`icon-lg`, `Input`, `Select` — are 44px on every pointer. Compact controls (`Button` `sm`/`xs`/`icon-sm`/`icon-xs`, dropdown items, sidebar items) stay compact on a mouse and lift to 44px on touch screens (`pointer-coarse:`), so dense desktop rows aren't doubled in height; on a mouse they stay above the 24px AA floor. Inline links inside text are exempt, as WCAG allows.
- Verify at 375 / 390 / 768 / 1024 / 1280 / 1440 with real data, not empty states — count- and length-driven layout bugs only appear with content.

## Elevation & Depth

Voyagr is almost entirely flat. **There is no shadow language for ordinary content** — no card, row, or badge casts one.

Depth comes from three devices, in this order of preference:

1. **Tonal layering** — the Surface → Neutral half-step. A card is a different paper stock on the page, not an object above it.
2. **Hairline rules** — 1px `border`, dividing rows and sections *without enclosing them*.
3. **Space** — the primary grouping tool. Most "this needs a shadow" moments are spacing problems.

### Surfaces — when to use which

| Surface | Use for | Never use for |
|---|---|---|
| **Page** (`--background`) | The page ground; every row; every section that is one thing rather than one of many. | — |
| **Card** (`--card`) | Genuinely discrete, comparable objects — a trip in a grid of trips. | A single item; a section wrapper; grouping unrelated fields. |
| **Muted** (`--muted`) | The secondary structural tier — the trip-detail aside, recessed panels that are *parallel* to content rather than part of it. | A second kind of content card. |
| **Popover** (`--popover`) | Dropdown menus, map popups, tooltips' ground. | Anything in normal document flow. |
| **Sidebar** (`--sidebar`) | The nav rail only. | Any content region. |
| **Dialog / Sheet** | Genuinely floating, modal content. The only surfaces permitted a shadow. | Non-modal panels. |

**Card, Muted, Popover and Sidebar must be visually distinguishable from each other and from the page.** If two of them resolve to the same value, the material hierarchy has collapsed and the interface will read flat and undifferentiated — see the Implementation Status note, where this is currently the case.

### Borders and shadows

**A border exists to divide, not to enclose.** Concretely:

| Situation | Border? |
|---|---|
| Between rows in a list | ✅ 1px bottom rule, none after the last |
| Between a section and the next | ✅ 1px top rule |
| Around a card | ❌ The tonal step already separates it |
| Around a section | ❌ Space and a rule do this |
| Around an input or control | ✅ It marks an editable region — `border-interactive` (3:1), never `border` |
| Around an empty state | ❌ |

**A shadow exists only on something genuinely floating above the page** — Dialog, Sheet, dropdown menus. Never on a card, never on hover, never to imply importance. If something needs to feel separated, reach for the tonal step or a rule.

**Glassmorphism** (`backdrop-blur`) is permitted for exactly two functional reasons and no decorative ones: (1) a scrim keeping text legible over photography, and (2) a sticky bar that content scrolls beneath. Both are legibility mechanisms. Blur applied to make something "look premium" is not.

### Dark mode inverts the direction of the tonal step

In light mode a card is a step *down* from the page — more pigmented paper on paler paper. In dark mode a card is a step *up* — a leather panel catching more lamplight than the cover around it. The steps are proportionally matched (light 1.43:1, dark 1.32:1) so neither theme reads weaker; only the sign flips. The tooltip is the exception in both: always the *opposite polarity* from its surroundings.

## Shapes

Radius is small and hierarchical, not uniform:

- **2px** on anything you operate — buttons, inputs, menu items, tooltips.
- **4px** on anything you look at as a discrete object — cards, the trip hero, image containers.
- **0** everywhere else.

`full` (9999px) is not a fourth step. It means the shape is *genuinely circular or capsule*, where radius is not a style choice: avatars, map markers, status dots, progress tracks, the sheet's drag handle. Among things that could be either, the rule is narrow: **of the badges, only the countdown is a pill.** A status badge is content and takes the 2px operable radius; the countdown is a signal, and the enclosed shape is what says so.

**Dialog and Sheet are exempt and keep 14px corners.** They are the one place a softer, larger radius earns its keep — a panel that genuinely floats reads as a separate physical object. They must read a dedicated radius value, never the shared scale, so shrinking the scale cannot reshape them by accident.

## Components

Format: *Tier* — surface — type — interaction — **never**.

**Button.** *Tier 6.* `primary-strong` fill with `surface` text (primary) or `neutral` fill with `primary-strong` text (secondary). `label-caps`. 2px radius. Press: `scale-0.97`, `duration-100 ease-out`, disabled by `motion-reduce`. 44px tall by default. Focus: a full-opacity 2px `ring` with a 2px page-coloured offset, always — the offset because the primary fill *is* the ring colour. **Never** a third fill variant to express a third importance level, a serif label, or a gradient.

**Card.** *Tier 3–4.* `neutral` fill, 4px radius, **no border, no shadow**. Reserved for genuinely discrete, comparable objects. **Never** wrap a single item, a section, or a group of unrelated fields in one.

**TripCard.** *Tier 3.* Card surface. Photograph on top at fixed aspect ratio; `headline-md` title truncated to one line; `body-sm` destination; `data-sm` dates. Press `scale-0.98` (a card-sized surface reads a firmer squeeze as heavy-handed). **Never** add a hover shadow, let the title wrap to two lines (it breaks row alignment across the grid), or nest an anchor inside it.

**Stat.** *Tier 5.* No surface at all — value and label on the page ground. `data-lg` value, `label-caps` or `caption` label. **Never** put a stat in a card; a four-up row of bordered stat boxes is the single most generic dashboard pattern there is.

**Badge.** *Tier 6.* Status: page ground, `secondary` text, 2px radius, quiet. Countdown: the only pill, the only `tertiary` element, two states — subtle gold for "in N days", full gold for Tomorrow/Today, and **plain `secondary` for a past trip** (gold means *imminent*, which a finished trip is the opposite of). **Never** use a pill for ordinary content, and never introduce a third countdown state.

**Timeline item (activity).** *Tier 3.* Page ground, no surface, no border. Fixed-width `data-sm` time column, then title in `body-md`, description in `body-sm` capped at 65ch, then metadata in `data-sm`/`caption`. **Never** wrap an activity in a card or a bordered box — the day is the object, the activity is a line in it.

**Hotel / Restaurant / Activity entries.** *Tier 5* (hotel, restaurant in the aside) or *Tier 3* (activity in the timeline). Rows separated by space, name in `body-sm` 600, everything else `caption`. Numbers in `data-sm`. **Provenance is part of the design**: an example stay, a modelled price and a real listing must be visually distinguishable, using `--notice` for approximations. **Never** render a fabricated rating, and never let a modelled number look like a measured one.

**Weather.** *Tier 5.* A compact inline chip on the day header, `muted` ground, condition in `body-sm`, every number in `data-sm`. Four provenance states, not two — live, real-but-stale, modelled, unavailable — with the modelled case carrying `--notice`. **Never** collapse those states into one label, and never show a zero where a null exists.

**Map.** *Tier 4.* One large quiet object, 4px radius, full width of its column. Markers are 12px circles in the four dedicated marker colors, fixed hex in both themes — a pin must stay findable against uncontrollable tile colors. Popups take `--popover` and must set both ground and text. **Never** give the map a shadow, and never reuse `tertiary` for a marker.

**Budget row / Packing row.** *Tier 5.* Page ground, no radius, divided by 1px rules, tight rhythm. Amounts in `data-md`, right-aligned so a column aligns. Progress as a thin capsule track. Swipe-to-delete on touch. **Never** enclose the section in a card, and never let this tier out-weigh the day plan.

**Dialog.** *Tier above everything.* `popover` ground, 14px radius, shadow permitted, scrim behind. Entrance/exit on `dialogSpring`. **Never** restyle its radius from the shared scale or change its physics for visual reasons.

**Input / Select / Textarea / Checkbox.** *Tier 6.* Transparent over the faint `--input` tint, `border-interactive` boundary, 2px radius, 44px tall, `body-md`. Focus: border and a 2px ring in `ring`, both at full opacity — a half-opacity ring measured under 3:1. Errors carry a written message, never colour alone.

**Sheet.** *Same tier as Dialog.* Bottom sheet on mobile with a visible drag handle and drag-to-dismiss; side panel for the sidebar under 768px. `sheetSpring`. **Never** use a Sheet for non-modal content, and never remove the handle — it is the affordance that makes the gesture discoverable.

**Sidebar.** *Tier 6.* `--sidebar` ground, which must be a genuinely different tone from the page — a border alone is not material identity. Active item uses `primary-subtle` ground with `primary-strong` text **and a 2px `primary-strong` bar on its leading edge** (`--sidebar-indicator`): the fill alone is 1.15:1 light / 1.40:1 dark against the sidebar, too faint to say "you are here" by itself. Collapses to icons on desktop, becomes a Sheet below 768px, and closes itself on navigation. **Never** let it compete with content for attention.

**Header.** *Tier 6.* Sticky, 56px, page-ground with a blur and a gradient tail so content dissolves rather than clipping as it scrolls under. Holds only the sidebar trigger, theme toggle and user menu. **Never** add page titles or primary actions to it — those belong in the page.

**Empty state.** *Tier 5.* Centered, generous vertical padding, page ground. A `headline-sm` line and a `body-sm` explanation, plus one action where there is a next step. **Never** use the icon-in-a-circle-inside-a-dashed-box pattern — it is the most recognizable AI-generated layout unit in existence. Type and space carry this.

**Loading state.** Mirrors the real layout's shape and heights so nothing shifts when content arrives. **A route's `loading.tsx` must be edited in the same commit as any layout change to the route it mirrors** — otherwise the skeleton silently desyncs and reintroduces the shift it exists to prevent.

## Motion

Voyagr already has a complete motion vocabulary from Stage 2. **Do not invent a second one.** Every value below lives in `src/lib/motion.ts` and is the only vocabulary permitted.

| Behaviour | Definition | Applies to |
|---|---|---|
| **Press** | `duration-100 ease-out`, `scale-0.97` controls / `scale-0.98` card surfaces | Buttons, TripCard, quick actions, wizard options |
| **Hover** | Border/tone shift only | Interactive surfaces |
| **Reveal** | `slideUp` (16px, 0.4s easeOut), `staggerChildren: 0.08` | Page and section entrances via `Reveal`/`RevealItem` |
| **Dialog** | `dialogSpring` — spring, bounce 0, 0.35s | Dialog enter/exit |
| **Sheet** | `sheetSpring` — spring, bounce 0.15, 0.3s | Sheet enter/exit |
| **Gesture release** | `gestureDragTransition` — bounceStiffness 380, damping 30 | Sheet drag-to-dismiss, swipe-to-delete |
| **Dismiss thresholds** | Sheet 120px or 0.5px/ms; swipe-delete 80px or 0.5px/ms | Either condition alone commits |
| **Reduced motion** | `<MotionConfig reducedMotion="user">` globally; `motion-reduce:transition-none` on press; `fadeIn` substituted for `slideUp`; `reducedGestureDragTransition` (1000/60) — fast and damped, never instant | Everywhere |

Rules:

- **Motion confirms an action or explains a spatial relationship.** Nothing animates for decoration.
- **Only two things animate on entrance**: a page's own content, once, and a modal surface. Not every section, not every card, not on every scroll.
- **Never animate `box-shadow`, `width`, `height`, or `top`/`left`.** Compositor-only properties (`transform`, `opacity`) or nothing.
- **What does not animate:** hover color changes on text, list reordering, number counting, the map, and anything the user is trying to read.
- Reduced motion is a first-class state, not a fallback — every new animation must handle it at the point it is written.

## Do's and Don'ts

- **Do** keep `tertiary` on the countdown badge and nowhere else. Its legibility as "time-sensitive" depends entirely on that scarcity.
- **Don't** use raw `#587b7f` as a text color in either direction — 3.6:1 against both ends, under AA at any size. Use `primary-strong` (which is what `--primary` already resolves to).
- **Do** wrap a trip in a card. **Don't** wrap anything else in one.
- **Don't** add a drop shadow to ordinary content. Shadows are for Dialog, Sheet and dropdowns only.
- **Do** set every price, date, time, distance and count in a `data-*` level. Numbers in Geist Sans will not align in a column beside numbers that are.
- **Don't** introduce a third weight. 400 and 600 only.
- **Do** cap body measure at 65 characters for anything read at length.
- **Don't** pair an error state with color alone — always a written message.
- **Do** let density vary between narrative and reference. That contrast is load-bearing.
- **Don't** touch Dialog, Sheet, drag physics, or any constant in `src/lib/motion.ts` to implement a *visual* change. This is a visual language, not a motion change.
- **Don't** derive a dark-mode color by inverting, darkening, or applying opacity to a light one. Derive it in OKLCH from the leather/lamplight logic.
- **Do** keep the card elevation step inverted between themes.

## Anti-Patterns

Concrete behaviours that must not be introduced. Several are drawn from patterns that exist in the codebase today and are listed in the roadmap for removal.

**Surfaces and containers**

1. **Do not add a card to group information.** Grouping is spacing's job. A card means "this is one of several comparable objects."
2. **Do not turn a section into a rounded rectangle.** Sections are delimited by a heading, a rule and space.
3. **Do not put a border *and* a tonal fill *and* a radius on the same element.** That combination gives everything the same rank and is the visual signature of a generated dashboard.
4. **Do not stack floating surfaces.** A panel inside a panel inside a card means the hierarchy was never decided.
5. **Do not add a hover shadow.** Hover changes border or tone, nothing else.
6. **Do not use `backdrop-blur` decoratively** — only as a scrim over photography or under a sticky bar.
7. **Do not add a gradient for decoration.** The only permitted gradients are a legibility scrim over an image and the header's fade tail.

**Type and rhythm**

8. **Do not introduce an arbitrary font size.** Use a level. `text-2xl`, `text-lg` and friends on a heading are how a type system dies.
9. **Do not introduce an arbitrary spacing value.** Use the scale.
10. **Do not add a third font weight.**
11. **Do not set a number in the sans face.**
12. **Do not center body copy.** Centering is for a hero line or an empty state, never a paragraph.

**Structure and hierarchy**

13. **Do not give every element equal visual weight.** If everything is emphasized, the page has no hierarchy — decide the tier first.
14. **Do not build a four-up row of bordered stat boxes.** Stats sit on the page ground.
15. **Do not use the icon-in-a-circle-in-a-dashed-box empty state.** It is the most recognizable AI layout unit that exists.
16. **Do not repeat a card grid for content that is a list.** A list of one-line items is rows.
17. **Do not create a new component pattern when an existing one expresses the same hierarchy.** Reuse `row`, `card`, `divider` and the existing panels first.
18. **Do not show the same information in two places on one page.** Two panels for one thing is a hierarchy failure, not a convenience.

**Motion**

19. **Do not animate everything.** Entrance animation belongs to a page once and to modals; not to every card, section, hover and scroll.
20. **Do not add a second motion vocabulary.** `src/lib/motion.ts` is the whole vocabulary.
21. **Do not animate a property that forces layout or paint.**

**Process**

22. **Do not redesign an existing surface without a documented reason.** Stage 2's material and motion decisions were deliberate; changing one requires saying why here first.
23. **Do not optimize for more visual effect.** Optimize for hierarchy and clarity. If a change adds an effect without clarifying rank, it is the wrong change.
24. **Do not let internal vocabulary reach the UI.** No phase numbers, no token names, no "Tier 3" in user-facing copy.

## Implementation Status

Audited against the codebase. **Legend:** ✅ matches spec · ◐ partial · ❌ missing · ⚠️ conflicts with spec.

### Typography

Fraunces is loaded and wired, and four fluid `@utility` levels resolve to it. **But the serif voice barely reaches the product**: `text-display` and `text-headline` are used *only* in marketing components. Every section heading inside the app is hand-rolled sans.

| Spec level | Implementation | Status | Used in |
|---|---|---|---|
| `display` | `text-display` (Fraunces, clamp 36→52px) | ◐ marketing only | `feature-block`, `product-headline` |
| `headline-lg` | `text-headline` (Fraunces, clamp 24→32px) | ◐ marketing only | `section-heading`, marketing sections |
| `headline-md` | `text-destination` (Fraunces, clamp 18→24px) | ✅ | TripCard, TripHero |
| `headline-sm` | `text-day-heading` (Fraunces, clamp 16→18px) | ✅ | DayTimeline |
| `body-lead` | — | ❌ | Day summaries render as `text-sm` sans |
| `body-lg` | `text-supporting` (Geist, clamp 16→17.6px) | ◐ marketing only | |
| `body-md` / `body-sm` | Default body / ad-hoc `text-sm` | ◐ no token | |
| `label-md` | — | ❌ | |
| `label-caps` | `text-eyebrow` (11.5px, +0.14em) | ◐ tracking differs (spec 0.12em) | Day slots, budget, packing |
| `data-lg` | `text-price` + ad-hoc `text-2xl sm:text-3xl` | ◐ mono correct, size ad-hoc | StatCard, budget |
| `data-md` / `data-sm` | — | ❌ | Ad-hoc `font-mono text-xs` in one place |
| `caption` | Ad-hoc `text-xs` | ◐ no token | |

⚠️ **16 hand-rolled headings across 5 different size/weight combinations** in product UI: `text-sm font-semibold` (×7), `text-2xl font-semibold` (×4), `text-sm font-medium` (×2), `text-lg font-medium` (×2), `text-lg font-semibold` (×1). None use a type level; none use Fraunces.

⚠️ **Weight discipline is not met.** `font-medium` (500) appears **40 times** across ~24 product files including every shadcn primitive (Button, Badge, Input, Label, Card, Dialog, Sheet, Sidebar). `font-light` (6) and `font-bold` (1) are confined to the out-of-scope film/marketing surfaces.

### Buttons

| Property | Spec | Actual | Status |
|---|---|---|---|
| Fill / text | `primary-strong` on `surface` | `bg-primary` = `primary-strong` | ✅ |
| Typography | `label-caps` (11px, uppercase, +0.12em, 600) | `text-sm font-medium` (14px, sentence case, 500) | ⚠️ |
| Radius | 2px | 2px | ✅ |
| Press | scale 0.97, `duration-100 ease-out` | Exactly that, with `motion-reduce` | ✅ |
| Hover | Tone shift | `hover:bg-primary/80` | ✅ |
| Disabled | — | `disabled:opacity-50 disabled:pointer-events-none` | ✅ |
| Focus | Visible ring, 3:1 | `focus-visible:ring-2 ring-ring ring-offset-2` (full opacity; the old `ring-ring/50` measured 2.47:1 light / 2.98:1 dark) | ✅ |
| Invalid | — | `aria-invalid:` border + ring | ✅ |

Sizes: `xs`/`sm`/`default`/`lg`/`icon`/`icon-xs`/`icon-sm`/`icon-lg` — richer than the spec describes, and fine as a *set*.

✅ **Control proportions (resolved Nov 2026).** `Button` default/`icon`, `Input` and `Select` are 44px (`h-11`) on every pointer; compact sizes, dropdown items and sidebar items lift to 44px on touch. Inputs are `body-md` at every breakpoint.

### Numbers — audit of "every price, date, time and distance in mono"

**The rule is currently false more often than true.**

| Location | Value | Mono? |
|---|---|---|
| `day-timeline.tsx:135` | Activity start time | ✅ |
| `stat-card.tsx` | Stat values (`text-price`) | ✅ |
| `budget-section.tsx` | Budget / planned / spent / remaining, per-category amounts | ✅ |
| `trip-hero.tsx:141` | Trip date range | ❌ sans |
| `trip-card.tsx:99` | Trip date range | ❌ sans |
| `day-timeline.tsx:114` | Day date | ❌ sans |
| `day-timeline.tsx:148–166` | Duration, walking distance, activity cost | ❌ sans |
| `day-timeline.tsx:242–275` | Temps, precipitation %, wind, humidity, sunrise/sunset | ❌ `tabular-nums` only, sans face |
| `trip-aside.tsx:28–39` | Hotel nights, price/night, rating | ❌ sans |
| `trip-aside.tsx:80–96` | Transport duration, cost | ❌ sans |
| `packing-section.tsx:114` | "N / M packed" | ❌ sans |
| `trip-hero.tsx` | Budget total | ❌ sans |

### Layout

| Property | Spec | Actual | Status |
|---|---|---|---|
| Page width | 72rem | `max-w-6xl` = 72rem | ✅ |
| Page padding | — | `px-6 py-8` | ✅ |
| Trip detail split | `1fr / 20rem` | Exactly, at `lg:` | ✅ |
| Spacing base | 8px | Consistently on-scale | ✅ |
| Body measure | 65ch | **No cap anywhere in the codebase** | ❌ |
| Section rhythm | Varied by meaning | Uniform `space-y-6` / `space-y-8` | ◐ |
| Structural breakpoint | 768px | `useIsMobile` = 768 ✅, but CSS grids switch at `sm:` 640 and `lg:` 1024 | ◐ mixed |

⚠️ **Hierarchy does not adapt responsively — it only collapses.** The entire product UI contains **exactly one** responsive form change (`flex-col sm:flex-row`, the packing add-item row). Nothing is hidden, reordered, condensed, or converted to a different component at any breakpoint; the sidebar's Sheet swap is the only structural adaptation, and it lives in the shared primitive rather than in any page. Every screen is the desktop composition narrowed. The Responsive table above therefore describes intent almost entirely, not behaviour.

### Surfaces

⚠️ **The material hierarchy has collapsed at the token level. Six named surfaces currently resolve to only two distinct values.**

| Group | Tokens | Light | Dark |
|---|---|---|---|
| Page | `--background`, `--sidebar` | `oklch(0.974 0.003 67.8)` | `oklch(0.180 0.024 52)` |
| Raised | `--card`, `--popover`, `--secondary`, `--muted` | `oklch(0.859 0.008 80.7)` | `oklch(0.290 0.030 52)` |

This was introduced by the Field Journal color pass, which mapped every raised surface onto `neutral` and the sidebar onto `surface`. Consequences:

- Stage 2D's deliberate distinction between content cards (`bg-card`) and the recessed aside (`bg-muted`) survives *only* through alpha (`bg-muted/40`), not through the tokens.
- `Button variant="secondary"` and `Badge variant="secondary"` render on the same fill as a card.
- **The sidebar is the same color as the page**, separated from content by nothing but its 1px border — so the app shell has no material identity of its own.

This is the most likely single cause of the interface reading as flat and undifferentiated, and is why it is P0.

### Borders / shadows / glass

| Pattern | Location | Verdict |
|---|---|---|
| Card with border + fill + radius | `trip-card.tsx:53` | ⚠️ spec says fill only |
| `hover:shadow-md` | `trip-card.tsx:53`, `dashboard/page.tsx:125` | ⚠️ spec forbids |
| Enclosing bordered box | trip-detail aside, EmptyState, empty-itinerary | ⚠️ encloses rather than divides |
| `backdrop-blur` scrim over photo | `trip-card.tsx:75,81` | ✅ functional |
| `backdrop-blur` sticky bar | `(app)/layout.tsx:39` | ✅ functional |
| `backdrop-blur` modal scrim | `dialog.tsx:67`, `sheet.tsx:75` | ✅ functional |
| Gradient scrim over photo | `trip-hero.tsx:74`, `trip-card.tsx:67` | ✅ functional |
| Gradient header fade | `(app)/layout.tsx:47` | ✅ functional |
| Divided rows | day timeline, budget, packing, favorites | ✅ correct pattern |

### Radius

✅ **Fully implemented and verified.** The scale re-bands the existing class vocabulary: `sm`/`md`/`lg` → 2px (operable), `xl`/`2xl`/`3xl`/`4xl` → 4px (objects). Dialog and Sheet read a dedicated `--radius-overlay` (14px) that the scale cannot reach. Badge base is 2px with the pill on the countdown variants only. Verified via computed `borderRadius` in-browser.

### Motion

✅ **Complete and consistent.** All values in `src/lib/motion.ts`; press timing shared across Button, TripCard, dashboard quick-action and wizard options; reduced motion handled globally and at 14 call sites. Two notes: `scaleIn` is **defined but unused** (dead), and the marketing hero carries ambient loops that are out of scope here.

### Components not yet matching spec

| Component | Gap |
|---|---|
| Section headings (all) | Sans, ad-hoc sizes, no type level, no Fraunces |
| Day summary | `text-sm` sans; spec calls for `body-lead` serif |
| EmptyState | Icon-in-circle-in-dashed-box; spec forbids |
| StatCard | Correct (no card despite the name) but ad-hoc sizing |
| TripCard | Border + hover shadow; dates in sans |
| Badge status | Uses `variant="outline"`, not the `badge-status` spec |
| Weather chip | Numbers in sans |
| Trip aside | Enclosing bordered box; numbers in sans |
| Day-timeline skeleton | ⚠️ Draws three **bordered rounded cards**, but the real day timeline renders open `<article>`s separated by `divide-y` with no border and no card. The skeleton is a fossil of an older, card-heavier layout and promises a shape the page no longer delivers. |

### Verified but not visually confirmed

The countdown badge, map markers, and the budget/packing/favorites row conversions are type-checked, lint-clean, build-clean and probed via computed styles, but have **never been rendered with real data** — they sit behind authentication and no session was available. Not claimed as visually confirmed.

## Open Questions

Genuine ambiguities in this document, surfaced by the audit. **These are unresolved by design** — each needs a decision before the implementation stage that depends on it. Do not resolve one by picking whichever reading is convenient mid-implementation.

1. **Is Blue Hour the product's aesthetic parent, or a separate world?** This document scopes the marketing pages and the scroll-film out entirely, and the product currently shares *nothing* with them — different serif (Cormorant Garamond vs Fraunces), different palette, different density. If Blue Hour is meant to remain part of Voyagr's identity, some thread must actually cross into the product (a shared serif, a cinematic full-bleed moment, the letterboxed framing). Blocks: any decision about the trip hero.

2. **Is the trip hero full-bleed or contained?** Visual Hierarchy calls Tier 1 "full-bleed, edge to edge, nothing competing." The implementation is a `rounded-2xl border` box inside the 72rem column. These contradict outright. Full-bleed would be the single most cinematic change available; contained is what exists. Blocks: Trip Detail work.

3. **Where does reference material live?** Layout formalizes `1fr / 20rem` as the model for "primary content beside reference material," and Visual Hierarchy classes budget and packing as Tier 5 reference. But both currently sit in the *main* column beneath the day plan, while the rail holds only stays/transport/notes. Either the rail is for all Tier 5, or the split means something narrower. Blocks: Trip Detail composition.

4. **Are wizard option toggles "cards"?** The card rule says cards are for "a trip in a grid of trips," yet the wizard's selectable options are bordered boxes in a grid. They are *controls*, and a border marks a selectable region legitimately. The rule needs an explicit carve-out for selection controls, or the wizard needs a different treatment.

5. ~~**What are the actual control heights?**~~ **Resolved (Nov 2026):** 44px for default controls on every pointer; compact controls 44px on touch only. See Responsive behaviour.

6. **What does "spacious" vs "tight" mean numerically?** Density is called the primary hierarchy device, but no per-tier spacing values exist, so "Tier 3 is spacious" is unenforceable and will drift. Needs concrete values from the `spacing` scale per tier.

7. **What are the six surfaces' actual values?** P0 requires them to be distinguishable, but this document does not say what they should be — only that they currently collapse to two. The values themselves are a design decision that has not been made.

## Design Implementation Roadmap

Ordered by impact on the "generic" feeling, not by effort.

### P0 — Foundation

Fix before any feature work; everything else depends on these.

1. **Restore surface differentiation.** Give `--card`, `--popover`, `--secondary`, `--muted` and `--sidebar` distinct values so the six-surface table is real. This is the highest-leverage single change in this document — six named surfaces currently collapse to two values, which is why the interface reads flat and why the app shell has no material identity.
2. **Add the missing type levels as utilities** — `body-lead`, `label-md`, `data-md`, `data-sm`, `caption`, and size tokens for `data-lg`. Nothing below can be done consistently without them.

### P1 — High-impact visual consistency

The changes that most affect whether Voyagr reads as designed.

3. **Give the product UI its serif voice.** Replace all 16 hand-rolled headings with `headline-lg` / `headline-md` / `headline-sm`. Today Fraunces appears in exactly three product places; every section heading is 14px sans. This is the largest contributor to the product feeling generic while the marketing pages do not.
4. **Set the day summary in `body-lead`.** The narrative is Tier 3 and currently renders as small muted sans — visually indistinguishable from metadata.
5. **Put every number in mono.** 10 of the 13 audited locations are wrong. Dates, temperatures, durations, distances, and counts.
6. **Move buttons to `label-caps`.** The single most repeated control in the product, currently at odds with the spec.

### P2 — Component refinement

7. **TripCard**: drop the border and the hover shadow; let the tonal step do the work.
8. **EmptyState**: replace the icon-circle-in-dashed-box with type and space.
9. **Trip aside**: stop enclosing; use rules and space, matching the budget/packing treatment.
10. **Badge status**: adopt the `badge-status` spec instead of `variant="outline"`.
11. **Section rhythm**: vary spacing by meaning rather than a uniform `space-y-6`.
12. **Body measure**: apply the 65ch cap to day summaries and activity descriptions.

### P3 — Polish

13. Reconcile `text-eyebrow` tracking (0.14em) with `label-caps` (0.12em).
14. Normalize `font-medium` → 400/600 as primitives are touched for other reasons; not a standalone sweep.
15. Align CSS grid breakpoints with the 768px structural breakpoint where the mismatch is visible.
16. Remove the unused `scaleIn` variant.
17. Retint `--notice`, and `--chart-*` if charts are ever built (currently zero consumers).

### Not in scope

Marketing pages, the Blue Hour film, Dialog/Sheet physics and radius, and anything in `src/lib/motion.ts`.
