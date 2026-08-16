import { Reveal, RevealItem } from "@/components/shared/reveal"
import { SectionHeading } from "@/components/shared/section-heading"

const steps = [
  {
    number: "01",
    title: "Tell us about your trip",
    description:
      "Destination, dates, budget, travel style — a short wizard, not a form to dread.",
  },
  {
    number: "02",
    title: "AI builds your itinerary",
    description:
      "A full day-by-day plan generated in seconds, with food, activities, and transport already worked out.",
  },
  {
    number: "03",
    title: "Refine by chatting",
    description:
      "\"Move this to day 2\", \"add hidden gems\", \"we're travelling with kids\" — the AI adjusts instantly.",
  },
  {
    number: "04",
    title: "Travel with confidence",
    description:
      "Maps, weather, budget, and packing lists all in one place, right up until you leave.",
  },
]

/** Dashes drawn with a repeating gradient rather than a border, so the dash
 *  and gap lengths are set independently — a dashed border in Tailwind gives
 *  no control over either. */
const dashedX =
  "bg-[repeating-linear-gradient(to_right,var(--color-primary)_0_4px,transparent_4px_11px)]"
const dashedY =
  "bg-[repeating-linear-gradient(to_bottom,var(--color-primary)_0_4px,transparent_4px_11px)]"

/**
 * The four steps sit on a dashed route with a station dot at each one: the
 * section describes a sequence, and four unconnected columns of text showed
 * no sequence at all — the only thing carrying the idea was a `text-sm`
 * numeral, the smallest element in the section.
 *
 * The rail runs horizontally from `lg` and vertically below it, which is
 * also why it's two elements rather than one rotated one.
 */
export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y border-border bg-muted/30 px-6 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          title="From idea to itinerary in minutes"
          description="No blank pages. No spreadsheets. Just a plan you can actually follow."
        />

        <Reveal className="mt-14">
          <ol className="grid gap-y-10 lg:grid-cols-4 lg:gap-y-0">
            {steps.map((step, index) => (
              <li key={step.number} className="relative pl-9 lg:pt-9 lg:pr-8 lg:pl-0">
                {/* The ring punches a hole in the rail so the dot reads as a
                    station on the line rather than sitting on top of it. */}
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 size-3 rounded-full bg-primary ring-4 ring-background"
                />

                {/* One connector per step rather than a single rail across the
                    whole row: a container-level line has to guess where the
                    last dot is, and the vertical version overshot it by the
                    height of the final step's copy. Anchoring each segment
                    between its own dot and the next — `-bottom-10` matching
                    the grid's `gap-y-10` — lands it exactly, whatever the
                    steps contain. */}
                {index < steps.length - 1 && (
                  <>
                    <span
                      aria-hidden="true"
                      className={`absolute top-[5px] right-0 left-3 hidden h-px opacity-40 lg:block ${dashedX}`}
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute top-3 -bottom-10 left-[5px] w-px opacity-40 lg:hidden ${dashedY}`}
                    />
                  </>
                )}
                {/* Anchored left, over its own step. At the cell's right edge
                    it sat in the column padding — visually nearer the next
                    step's dot than its own, so every watermark read as
                    labelling the step after it. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-4 left-6 text-6xl font-bold text-foreground/[0.04] select-none lg:top-2 lg:left-0"
                >
                  {step.number}
                </span>

                <RevealItem>
                  <span className="text-eyebrow text-primary">{step.number}</span>
                  <h3 className="mt-2 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </RevealItem>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}
