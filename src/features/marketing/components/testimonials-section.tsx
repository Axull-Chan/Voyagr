import { Quote } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { SectionHeading } from "@/components/shared/section-heading"

const testimonials = [
  {
    name: "Ava Chen",
    role: "Solo traveler",
    quote:
      "I used to spend a whole weekend planning a trip. Now I get a full itinerary before I've finished my coffee.",
  },
  {
    name: "Marcus Bell",
    role: "Family trips",
    quote:
      "The budget tracker alone saved our Japan trip from going way over. Seeing the daily breakdown changed how we booked things.",
  },
  {
    name: "Priya Nair",
    role: "Weekend explorer",
    quote:
      "Being able to just ask it to \"add more hiking\" and watching the whole plan update instantly is wild.",
  },
]

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function TestimonialsSection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Loved by people who hate planning" />

        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <RevealItem
              key={testimonial.name}
              className="flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <Quote aria-hidden="true" className="size-5 text-primary/40" />
              <p className="mt-4 flex-1 text-sm text-foreground">
                {testimonial.quote}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {initialsFor(testimonial.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
