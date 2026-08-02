/**
 * Purely decorative atmosphere layer behind the hero content: a faint
 * world-map wash, two soft blurred color blobs, and a static noise-grain
 * filter. No JS — everything here is inline SVG/CSS, so it costs nothing
 * beyond the world-map file's own network request.
 */
export function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
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
