import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { contrastRatio, parseColor, readThemeTokens, toHex } from "@/lib/design/contrast"

/**
 * WCAG 2.2 AA for the app's real tokens, read from globals.css — so a token
 * edit that breaks contrast fails here, not in someone's eyes. Text pairs need
 * 4.5:1 (SC 1.4.3); control boundaries, focus rings and state indicators need
 * 3:1 against everything they sit on (SC 1.4.11).
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
const tokens = readThemeTokens(css)
const THEMES = ["light", "dark"] as const

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "popover"],
  ["muted-foreground", "muted"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["destructive", "popover"],
  ["notice-foreground", "notice"],
  ["tertiary-foreground", "tertiary"],
  ["tertiary-subtle-foreground", "tertiary-subtle"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
]

/** Every surface a form control, focus ring or the nav can sit on. */
const SURFACES = ["background", "card", "popover", "muted"]
const NON_TEXT_PAIRS: [fg: string, bg: string][] = [
  ...SURFACES.map((s): [string, string] => ["border-interactive", s]),
  ...SURFACES.map((s): [string, string] => ["ring", s]),
  ["sidebar-ring", "sidebar"],
  ["sidebar-indicator", "sidebar"],
  ["sidebar-indicator", "sidebar-accent"],
]

function ratio(theme: (typeof THEMES)[number], fg: string, bg: string): number {
  const a = tokens[theme][fg]
  const b = tokens[theme][bg]
  if (!a || !b) throw new Error(`Missing token in ${theme}: ${a ? bg : fg}`)
  return contrastRatio(a, b)
}

describe("the colour maths", () => {
  it("matches known WCAG reference values", () => {
    expect(contrastRatio(parseColor("#000000")!, parseColor("#FFFFFF")!)).toBeCloseTo(21, 5)
    // From the design template, independently computed: navy on off-white.
    expect(contrastRatio(parseColor("#243B53")!, parseColor("#F8F7F3")!)).toBeCloseTo(10.73, 2)
    expect(contrastRatio(parseColor("#786A5C")!, parseColor("#291E17")!)).toBeCloseTo(3.11, 2)
  })

  it("converts oklch tokens to the hexes DESIGN.md lists", () => {
    expect(toHex(tokens.light["background"]!)).toBe("#F8F6F4")
    expect(toHex(tokens.light["primary"]!)).toBe("#244F54")
    expect(toHex(tokens.light["border-interactive"]!)).toBe("#777068")
    expect(toHex(tokens.dark["border-interactive"]!)).toBe("#948274")
    expect(toHex(tokens.dark["background"]!)).toBe("#1A0F08")
  })
})

describe.each(THEMES)("%s theme", (theme) => {
  it.each(TEXT_PAIRS)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(NON_TEXT_PAIRS)("%s against %s is at least 3:1", (fg, bg) => {
    expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(3)
  })

  it("keeps --border a divider: it is too faint to mark a control, which is why controls don't use it", () => {
    expect(ratio(theme, "border", "background")).toBeLessThan(3)
  })
})

describe("components use the accessible tokens", () => {
  const dir = join(process.cwd(), "src/components/ui")
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), "utf8") }))

  it("draws no focus ring or outline at partial opacity (measured under 3:1)", () => {
    for (const { file, text } of sources) {
      expect(text, file).not.toMatch(/\b(ring-ring|outline-ring|ring-sidebar-ring)\/\d+/)
    }
    expect(css).not.toMatch(/outline-ring\/\d+/)
  })

  it("borders every text field, select and checkbox with border-interactive", () => {
    for (const file of ["input.tsx", "textarea.tsx", "select.tsx", "checkbox.tsx"]) {
      const text = sources.find((s) => s.file === file)!.text
      expect(text, file).toContain("border-border-interactive")
      expect(text, file).not.toMatch(/\bborder-input\b/)
    }
  })

  it("makes default controls 44px everywhere and compact ones 44px on touch", () => {
    const button = sources.find((s) => s.file === "button.tsx")!.text
    expect(button).toMatch(/default:\s*\n?\s*"h-11/)
    expect(button).toContain('icon: "size-11"')
    expect(button).toContain("pointer-coarse:min-h-11 pointer-coarse:min-w-11")
    for (const file of ["input.tsx", "select.tsx"]) {
      expect(sources.find((s) => s.file === file)!.text, file).toMatch(/"h-11 w-full/)
    }
    const menu = sources.find((s) => s.file === "dropdown-menu.tsx")!.text
    expect(menu.match(/pointer-coarse:min-h-11/g)?.length).toBe(4)
  })
})
