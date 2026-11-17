import { describe, expect, it } from "vitest"

import { hasUnsupportedText, toPdfText } from "@/features/trips/pdf/pdf-text"

// Unusual characters are built from code points, never typed or escaped: invisible
// characters in test source are unreadable, and tooling has mangled escapes before.
const cp = (...codes: number[]) => String.fromCodePoint(...codes)

describe("toPdfText", () => {
  it("passes Latin-1 text through untouched, accents and all", () => {
    for (const s of [
      "Café Água São João",
      "Ñandú Ørsted Zürich",
      "½ ° × ± £ ¥ ©",
      "Plain ASCII, 123 & more!",
    ]) {
      expect(toPdfText(s)).toBe(s)
    }
  })

  it("keeps the WinAnsi extras the standard fonts can draw", () => {
    const s = "€ • – — ‘a’ “b” … ™ Š š Ž ž Œ œ Ÿ"
    expect(toPdfText(s)).toBe(s)
  })

  it("folds accented letters outside Latin-1 to their base letter", () => {
    expect(toPdfText("Kőszeg")).toBe("Koszeg")
    expect(toPdfText("Gdańsk")).toBe("Gdansk")
    expect(toPdfText("Śląsk")).toBe("Slask")
  })

  it("folds letters with no decomposition", () => {
    // "ó" and "à" are Latin-1, so they are kept; only the letters the fonts
    // lack are folded.
    expect(toPdfText("Łódź")).toBe("Lódz")
    expect(toPdfText("Đà Nẵng")).toBe("Dà Nang")
  })

  it("folds typographic look-alikes to plain characters", () => {
    const nonBreakingHyphen = cp(0x2011)
    const minusSign = cp(0x2212)
    const arrow = cp(0x2192)
    expect(toPdfText(`a${nonBreakingHyphen}b ${minusSign} c`)).toBe("a-b - c")
    expect(toPdfText(`A${arrow}B`)).toBe("A->B")
    expect(toPdfText(`a${cp(0x2009)}b${cp(0x202f)}c`)).toBe("a b c")
  })

  it("replaces a run of unsupported characters with ONE question mark", () => {
    // Without this a Japanese place name would print as wrong glyphs; with a
    // per-character "?" it would print as "????".
    expect(toPdfText("東京")).toBe("?")
    expect(toPdfText("Senso-ji 浅草寺 Temple")).toBe("Senso-ji ? Temple")
    expect(toPdfText("Привет мир")).toBe("? ?")
    expect(toPdfText("✓ done ★")).toBe("? done ?")
  })

  it("never emits a character the fonts cannot draw", () => {
    const hostile = [
      "ő ł Ω Я 東京 ✓ ☐ ★ 😀",
      cp(0x200b, 0x202e), // zero-width space, right-to-left override
      " zero",
      cp(0),
      "width",
      cp(7),
      " ñ é",
    ].join("")
    const out = toPdfText(hostile)
    const winAnsiExtra = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"
    for (const ch of out) {
      const code = ch.codePointAt(0) as number
      const ok =
        ch === "\n" ||
        (code >= 0x20 && code <= 0x7e) ||
        (code >= 0xa0 && code <= 0xff) ||
        winAnsiExtra.includes(ch)
      expect(ok, `unexpected character U+${code.toString(16)}`).toBe(true)
    }
    // And the legitimate text around the junk survived.
    expect(out).toContain("zerowidth")
    expect(out).toContain("ñ é")
  })

  it("drops invisible and control characters but keeps newlines", () => {
    expect(toPdfText(`a${cp(0x200b)}b${cp(0x202e)}c`)).toBe("abc")
    expect(toPdfText(`a${cp(0x2028)}b${cp(0xfeff)}c`)).toBe("abc")
    expect(toPdfText(`a${cp(0)}b${cp(7)}c`)).toBe("abc")
    expect(toPdfText("line one\r\nline two\rline three")).toBe(
      "line one\nline two\nline three"
    )
    expect(toPdfText("a\tb")).toBe("a b")
  })

  it("handles empty and missing input", () => {
    expect(toPdfText("")).toBe("")
    expect(toPdfText(null)).toBe("")
    expect(toPdfText(undefined)).toBe("")
  })
})

describe("hasUnsupportedText", () => {
  it("flags text that had to be degraded, but not one that already had a ?", () => {
    expect(hasUnsupportedText("東京")).toBe(true)
    expect(hasUnsupportedText("Café")).toBe(false)
    expect(hasUnsupportedText("Really?")).toBe(false)
    expect(hasUnsupportedText(null)).toBe(false)
  })
})
