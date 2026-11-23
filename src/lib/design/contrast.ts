/**
 * WCAG contrast for the app's own colour tokens, read straight from
 * `globals.css` so the numbers in DESIGN.md can be checked rather than trusted.
 *
 * Pure and dependency-free: `oklch()` and hex are converted to sRGB with the
 * reference OKLab matrices, out-of-gamut channels are clamped, and contrast is
 * the WCAG 2.x relative-luminance ratio.
 */

export type Rgb = [number, number, number]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function srgbEncode(linear: number): number {
  const x = clamp01(linear)
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
}

export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const [L, M, S] = [l_ ** 3, m_ ** 3, s_ ** 3]
  return [
    srgbEncode(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    srgbEncode(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    srgbEncode(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  ]
}

/** `oklch(L C H)` or `#rrggbb`; null for anything else (alpha, keywords, var()). */
export function parseColor(value: string): Rgb | null {
  const v = value.trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const n = hex[1] as string
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as Rgb
  }
  const ok = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(v)
  if (ok) return oklchToRgb(Number(ok[1]), Number(ok[2]), Number(ok[3]))
  return null
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

/** The custom properties declared directly inside the first `selector { … }` block. */
function declarations(css: string, selector: string): Record<string, string> {
  const start = css.search(new RegExp(`(^|\\n)${selector.replace(".", "\\.")}\\s*\\{`))
  if (start === -1) return {}
  const open = css.indexOf("{", start)
  const close = css.indexOf("\n}", open)
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "")
  const out: Record<string, string> = {}
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out[match[1] as string] = (match[2] as string).trim()
  }
  return out
}

export interface ThemeTokens {
  light: Record<string, Rgb>
  dark: Record<string, Rgb>
}

/**
 * Colour tokens per theme. Dark inherits anything `.dark` doesn't redefine
 * (the countdown gold is deliberately the same in both), and `var(--x)`
 * references are followed within the theme.
 */
export function readThemeTokens(css: string): ThemeTokens {
  const root = declarations(css, ":root")
  const dark = { ...root, ...declarations(css, ".dark") }
  const resolve = (raw: Record<string, string>) => {
    const out: Record<string, Rgb> = {}
    for (const name of Object.keys(raw)) {
      let value = raw[name] as string
      for (let hops = 0; hops < 5; hops++) {
        const ref = /^var\(--([\w-]+)\)$/.exec(value)
        if (!ref) break
        value = raw[ref[1] as string] ?? ""
      }
      const rgb = parseColor(value)
      if (rgb) out[name] = rgb
    }
    return out
  }
  return { light: resolve(root), dark: resolve(dark) }
}
