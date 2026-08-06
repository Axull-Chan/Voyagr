import { cn } from "@/lib/utils"
import { filmLabel, filmSerif } from "@/features/film/film-typography"

/**
 * Stats describing the film itself rather than invented business metrics —
 * this is a showcase page, and "12,000 happy travellers" on a fictional
 * brand reads as filler. Every number here is literally true of the reel
 * above it.
 */
const stats = [
  { value: "05", label: "Cities in the series" },
  { value: "71", label: "Frames" },
  { value: "5.9″", label: "Runtime" },
  { value: "00", label: "Cuts" },
]

export function FilmStats() {
  return (
    <section className="border-y border-film-line">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px lg:grid-cols-4">
        {/* dt precedes dd in the DOM as the spec wants; `order` flips them
            visually so the number reads first. */}
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col px-6 py-12 text-center sm:py-16"
          >
            <dt className={cn(filmLabel, "order-2 mt-4")}>{stat.label}</dt>
            <dd
              className={cn(
                filmSerif,
                "order-1 text-5xl font-light text-film-ink sm:text-6xl"
              )}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
