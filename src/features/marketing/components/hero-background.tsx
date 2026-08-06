/**
 * Purely decorative atmosphere layer behind the hero content: a faint
 * world-map wash, two soft blurred color blobs, and a static noise-grain
 * filter. No JS — everything here is inline SVG/CSS, so it costs nothing
 * beyond the world-map file's own network request.
 */
export function HeroBackground() {
  return (
    // The mask is what stops this reading as a seam. Every layer inside is
    // `absolute inset-0`, so without it the map wash, the colour blobs and
    // the grain all end on a hard horizontal line at the section boundary —
    // a visible edge across the full width where the next section's flat
    // background takes over. Fading both ends dissolves it instead.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_66%,transparent_100%)]"
    >
      <div
        className="absolute inset-0 bg-center bg-no-repeat opacity-[0.06] blur-md dark:invert"
        style={{
          backgroundImage: "url(/hero/world-map.svg)",
          backgroundSize: "110%",
        }}
      />
      <div className="absolute top-1/3 -left-32 size-[28rem] rounded-full bg-[color-mix(in_oklch,var(--primary),transparent_90%)] blur-3xl" />
      <div className="absolute -right-24 bottom-0 size-[24rem] rounded-full bg-[color-mix(in_oklch,var(--primary),transparent_92%)] blur-3xl" />
      <svg className="absolute inset-0 size-full opacity-[0.03]">
        <filter id="hero-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={2}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>
    </div>
  )
}
