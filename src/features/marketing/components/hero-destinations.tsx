import Image from "next/image"
import Link from "next/link"
import { CloudSun } from "lucide-react"

import { Badge } from "@/components/ui/badge"

const destinations = [
  {
    city: "Tokyo",
    src: "/destinations/tokyo.jpg",
    temp: "18°C",
    category: "City & culture",
  },
  {
    city: "Seoul",
    src: "/destinations/seoul.jpg",
    temp: "15°C",
    category: "City & nightlife",
  },
  {
    city: "Paris",
    src: "/destinations/paris.jpg",
    temp: "16°C",
    category: "Romance & art",
  },
  {
    city: "Bali",
    src: "/destinations/bali.jpg",
    temp: "29°C",
    category: "Beach & nature",
  },
  {
    city: "New York",
    src: "/destinations/new-york.jpg",
    temp: "12°C",
    category: "Urban icon",
  },
]

export function HeroDestinations() {
  return (
    // No sr-only heading any more: `DestinationsSection` now gives this rail
    // a real visible <h2>, and two headings for one list is a worse
    // screen-reader experience than none.
    <div className="w-full">
      <ul
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {destinations.map((destination) => (
          <li
            key={destination.city}
            className="w-36 shrink-0 snap-start sm:w-44"
          >
            <Link
              href="/sign-up"
              aria-label={`Start planning a trip to ${destination.city}`}
              className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="relative aspect-4/3 overflow-hidden rounded-xl shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                <Image
                  src={destination.src}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 176px, 144px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* An eased multi-stop scrim rather than
                    `from-black/70 via-black/5 to-transparent`: a single
                    midpoint at 5% put almost the whole falloff in the bottom
                    half, which showed up as a hard band across the photo.
                    These stops approximate an ease-out so it reads as one
                    continuous fade. */}
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.75)_14%,rgba(0,0,0,0.58)_28%,rgba(0,0,0,0.40)_42%,rgba(0,0,0,0.24)_56%,rgba(0,0,0,0.12)_70%,rgba(0,0,0,0.04)_84%,transparent_100%)]" />
                <Badge
                  variant="secondary"
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
                >
                  <CloudSun aria-hidden="true" />
                  {destination.temp}
                </Badge>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-sm font-medium text-white">
                    {destination.city}
                  </p>
                  <p className="text-xs text-white/80">
                    {destination.category}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
