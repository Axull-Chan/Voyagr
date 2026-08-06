import Image from "next/image"

import { cn } from "@/lib/utils"
import { filmLabel, filmSerif } from "@/features/film/film-typography"

/**
 * The five keyframes the series was cut from. `span` is assigned explicitly
 * rather than left to a uniform grid: five items never divide evenly into a
 * 2-, 3- or 4-column grid, so a plain `grid-cols-*` would always strand the
 * last card alone on its own row with a hole beside it. Pairing them 7/5,
 * 5/7 and then letting Bali run full width makes that asymmetry look
 * deliberate instead.
 */
const plates = [
  { src: "tokyo", city: "Tokyo", note: "Blue hour, Shiba", span: "lg:col-span-7", height: "lg:h-[26rem]" },
  { src: "paris", city: "Paris", note: "After rain, Champ de Mars", span: "lg:col-span-5", height: "lg:h-[26rem]" },
  { src: "seoul", city: "Seoul", note: "Namsan, by cable car", span: "lg:col-span-5", height: "lg:h-[26rem]" },
  { src: "new-york", city: "New York", note: "Last light, Midtown", span: "lg:col-span-7", height: "lg:h-[26rem]" },
  { src: "bali", city: "Bali", note: "First light, Bedugul", span: "lg:col-span-12", height: "lg:h-[34rem]" },
]

export function FilmGallery() {
  return (
    <section id="series" className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <p className={filmLabel}>The series</p>
      <h2
        className={cn(
          filmSerif,
          "mt-4 max-w-xl text-4xl leading-[1.1] font-light text-balance text-film-ink sm:text-5xl"
        )}
      >
        Five cities, each at the hour they look least like themselves.
      </h2>

      <ul className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {plates.map((plate) => (
          <li key={plate.src} className={plate.span}>
            <figure>
              {/* Fixed height per row from `lg` up, rather than a shared
                  aspect ratio: two plates of different column spans sharing
                  one aspect resolve to different heights, which left the
                  captions of a pair on visibly different baselines. */}
              <div
                className={cn(
                  "relative aspect-video overflow-hidden bg-film-raise lg:aspect-auto",
                  plate.height
                )}
              >
                <Image
                  src={`/film/gallery/${plate.src}.jpg`}
                  alt={`${plate.city} — ${plate.note}`}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-4 flex items-baseline justify-between gap-4 border-t border-film-line pt-4">
                <span className={cn(filmSerif, "text-2xl text-film-ink")}>
                  {plate.city}
                </span>
                <span className={filmLabel}>{plate.note}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
