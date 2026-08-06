/**
 * The film's narrative beats, keyed to scroll progress (0 → 1 across the
 * pinned section). Each beat fades in over `in0 → in1`, holds to `out0`,
 * then fades out by `out1` — so exactly one beat is legible at a time and
 * the gaps between them let the footage breathe.
 */
export interface FilmBeat {
  kicker: string
  line: string
  in0: number
  in1: number
  out0: number
  out1: number
  /**
   * Renders this beat's line as the page's `<h1>` instead of a `<p>`. Exactly
   * one beat per set should set it: on the campaign page that's the opening
   * title card, on the landing hero it's the closing product line, since
   * that's the one that actually states what Voyagr is.
   */
  isHeading?: boolean
}

const titleCard: FilmBeat = {
  kicker: "Vol. I — Tokyo",
  line: "Twenty minutes after sunset, the whole city turns blue.",
  // in0 === in1 === 0: the opening beat is a title card, so it has to be
  // legible at rest. A fade-in window here would leave the page's first
  // paint with no text on it at all until the reader starts scrolling.
  in0: 0,
  in1: 0,
  out0: 0.16,
  out1: 0.24,
}

const middleBeats: FilmBeat[] = [
  {
    kicker: "The street",
    line: "Six turns from the station. Steam, paper lanterns, no crowd.",
    in0: 0.3,
    in1: 0.37,
    out0: 0.46,
    out1: 0.54,
  },
  {
    kicker: "The plan",
    line: "Found, routed and timed before you landed.",
    in0: 0.6,
    in1: 0.67,
    out0: 0.76,
    out1: 0.83,
  },
]

/** The standalone campaign page: pure film, closing on its own title. */
export const campaignBeats: FilmBeat[] = [
  { ...titleCard, isHeading: true },
  ...middleBeats,
  {
    kicker: "Blue Hour",
    line: "A Voyagr film.",
    in0: 0.88,
    in1: 0.94,
    out0: 1,
    out1: 1,
  },
]

/**
 * The landing hero: identical footage and pacing, but the closing beat
 * hands off to the product instead of a title card — a hero that never
 * says what the product is would be a poor first screen, however good the
 * film looks.
 */
export const landingBeats: FilmBeat[] = [
  titleCard,
  ...middleBeats,
  {
    kicker: "Voyagr",
    line: "We plan the trip around moments like this.",
    in0: 0.86,
    in1: 0.92,
    out0: 1,
    out1: 1,
    isHeading: true,
  },
]

export function beatOpacity(beat: FilmBeat, progress: number): number {
  const { in0, in1, out0, out1 } = beat
  // `<` rather than `<=` so a beat with a zero-width fade-in (in0 === in1)
  // reads as already-visible at its start instead of collapsing to 0.
  if (progress < in0) return 0
  if (progress < in1) return (progress - in0) / (in1 - in0)
  if (progress <= out0) return 1
  if (progress < out1) return 1 - (progress - out0) / (out1 - out0)
  return out1 >= 1 ? 1 : 0
}
