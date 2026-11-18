import type { Metadata } from "next"

import { cn } from "@/lib/utils"
import { filmSerifFont } from "@/fonts/film-serif"
import { FilmFooter, FilmHeader } from "@/features/film/components/film-chrome"
import { FilmGallery } from "@/features/film/components/film-gallery"
import { FilmStats } from "@/features/film/components/film-stats"
import { InquiryForm } from "@/features/film/components/inquiry-form"
import { ScrollFilm } from "@/features/film/components/scroll-film"

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
        filmSerifFont.variable
      )}
    >
      <FilmHeader />
      <main>
        <ScrollFilm />
        <FilmStats />
        <FilmGallery />
        <InquiryForm />
      </main>
      <FilmFooter />
    </div>
  )
}
