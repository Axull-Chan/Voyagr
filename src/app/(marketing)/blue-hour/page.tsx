import type { Metadata } from "next"
import { Cormorant_Garamond } from "next/font/google"

import { cn } from "@/lib/utils"
import { FilmFooter, FilmHeader } from "@/features/film/components/film-chrome"
import { FilmGallery } from "@/features/film/components/film-gallery"
import { FilmStats } from "@/features/film/components/film-stats"
import { InquiryForm } from "@/features/film/components/inquiry-form"
import { ScrollFilm } from "@/features/film/components/scroll-film"

/**
 * Loaded per-route rather than in the root layout — this serif is only ever
 * used by the campaign page, and shipping it site-wide would put a font on
 * the critical path of every product screen that never renders it.
 */
const filmSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-film-serif",
})

export const metadata: Metadata = {
  title: "Blue Hour — Vol. I, Tokyo",
  description:
    "A scroll-scrubbed film shot at blue hour in Tokyo, and the five-city series it was cut from. A fictional showcase for Voyagr.",
}

export default function BlueHourPage() {
  return (
    <div
      className={cn(
        "film-surface relative flex-1 bg-film-bg text-film-ink",
        filmSerif.variable
      )}
    >
      <FilmHeader />
      <main id="main-content">
        <ScrollFilm />
        <FilmStats />
        <FilmGallery />
        <InquiryForm />
      </main>
      <FilmFooter />
    </div>
  )
}
