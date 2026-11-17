/**
 * Makes arbitrary text safe to draw with the PDF's built-in fonts.
 *
 * Helvetica and Times (PDF's standard fonts, which cost nothing to embed) can
 * draw exactly the Windows-1252 ("WinAnsi") character set. Anything outside it is
 * not skipped or boxed — it comes out as *different, wrong glyphs* (a probe of
 * Hungarian, Polish, Greek, Cyrillic and Japanese text, arrows and check marks
 * printed as `Q B©[/q¬`). A PDF people keep and share must never contain
 * scrambled place names, so every string is passed through here first.
 *
 * What it does, in order of preference for each character:
 *   1. keep it if the fonts can draw it;
 *   2. fold it to a plain letter where that is honest (o-double-acute -> "o",
 *      l-with-stroke -> "l");
 *   3. otherwise replace it with "?" — one "?" per run, not per character, so a
 *      Japanese name reads as "?" rather than "????".
 *
 * Real data does reach rule 3 eventually: OpenTripMap returns a place's local
 * name when it has no English one. Bundling a CJK-capable font would fix that, at
 * several MB per script; that is a deliberate later decision, and until then a
 * visible "?" is the honest failure.
 *
 * Every special character below is built from its numeric code point rather than
 * typed or escaped. Invisible characters in source are unreadable, and a literal
 * line separator inside a regex literal is a syntax error — an earlier version of
 * this file hit exactly that. Code points are plain ASCII and survive any tooling.
 */

const chars = (...codes: number[]): string[] => codes.map((c) => String.fromCodePoint(c))

/** Windows-1252 positions 0x80-0x9F that map to characters outside Latin-1. */
const WIN_ANSI_EXTRA = new Set(
  chars(
    0x20ac, // euro
    0x201a,
    0x0192,
    0x201e,
    0x2026, // ellipsis
    0x2020,
    0x2021,
    0x02c6,
    0x2030,
    0x0160,
    0x2039,
    0x0152,
    0x017d,
    0x2018, // curly quotes
    0x2019,
    0x201c,
    0x201d,
    0x2022, // bullet
    0x2013, // en dash
    0x2014, // em dash
    0x02dc,
    0x2122, // trade mark
    0x0161,
    0x203a,
    0x0153,
    0x017e,
    0x0178
  )
)

/** Characters with no Unicode decomposition that still have an honest plain form. */
const FOLD = new Map<string, string>(
  (
    [
      [0x0142, "l"], // l with stroke
      [0x0141, "L"],
      [0x0111, "d"], // d with stroke
      [0x0110, "D"],
      [0x0127, "h"], // h with stroke
      [0x0126, "H"],
      [0x0131, "i"], // dotless i
      // Typographic variants that look like, and mean, a plain character.
      [0x2010, "-"], // hyphen
      [0x2011, "-"], // non-breaking hyphen
      [0x2012, "-"], // figure dash
      [0x2212, "-"], // minus sign
      [0x2009, " "], // thin space
      [0x2002, " "], // en space
      [0x2003, " "], // em space
      [0x202f, " "], // narrow no-break space
      [0x2192, "->"], // right arrow
      [0x2248, "~"], // almost equal
      [0x2264, "<="],
      [0x2265, ">="],
    ] as [number, string][]
  ).map(([code, plain]) => [String.fromCodePoint(code), plain])
)

/** Zero-width and bidi-control characters: invisible, so drop them silently. */
const INVISIBLE_RANGES: [number, number][] = [
  [0x200b, 0x200f], // zero-width space/joiners, direction marks
  [0x2028, 0x2029], // line and paragraph separators
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2060, 0x2064], // word joiner and invisible operators
  [0xfeff, 0xfeff], // byte-order mark / zero-width no-break space
]
const INVISIBLE = new RegExp(
  `[${INVISIBLE_RANGES.map(
    ([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`
  ).join("")}]`,
  "g"
)

function isDrawable(char: string): boolean {
  const code = char.codePointAt(0) as number
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.has(char)
  )
}

export function toPdfText(input: string | null | undefined): string {
  if (!input) return ""

  const normalised = input
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")

  let out = ""
  let inUnsupportedRun = false

  for (const original of normalised) {
    // Newlines are the one control character worth keeping (multi-line notes).
    if (original === "\n") {
      out += "\n"
      inUnsupportedRun = false
      continue
    }

    let piece: string | null = null

    if (isDrawable(original)) {
      piece = original
    } else if (FOLD.has(original)) {
      piece = FOLD.get(original) as string
    } else {
      // An accented letter decomposes to base + combining mark(s). Only accept
      // the fold if the result is fully drawable; otherwise it is a real
      // non-Latin character.
      const folded = original.normalize("NFD").replace(/\p{M}/gu, "")
      if (folded !== original && [...folded].every(isDrawable)) piece = folded
    }

    if (piece === null) {
      // Other control characters are dropped outright; real unsupported glyphs
      // become a single "?" for the whole run.
      if (/\p{Cc}/u.test(original)) continue
      if (!inUnsupportedRun) out += "?"
      inUnsupportedRun = true
    } else {
      out += piece
      inUnsupportedRun = false
    }
  }

  return out
}

/** Whether `toPdfText` had to replace anything with a "?" — for tests and logging. */
export function hasUnsupportedText(input: string | null | undefined): boolean {
  if (!input) return false
  return toPdfText(input).includes("?") && !input.includes("?")
}
