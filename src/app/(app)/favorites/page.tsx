import type { Metadata } from "next"
import { Heart, MapPin } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealItem } from "@/components/shared/reveal"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Favorites" }

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: favorites } = await supabase
    .from("favorites")
    .select("id, name, type")
    .order("created_at", { ascending: false })

  return (
    <Reveal mode="mount" className="space-y-6">
      <RevealItem>
        <h1 className="text-headline text-foreground">Favorites</h1>
        <p className="text-sm text-muted-foreground">
          Places you&apos;ve saved from your trips.
        </p>
      </RevealItem>

      {/* A saved place carries a name and a type — that's a list item, not a
          comparable object, so it's a row separated by a rule rather than a
          bordered box in a grid (DESIGN.md § Components: cards are reserved
          for a trip in a grid of trips). The single column also lets a long
          place name breathe instead of wrapping inside a third-width card.
          The plain <ul> between Reveal and RevealItem is fine — Framer
          propagates variants through context, not the DOM tree. */}
      {favorites && favorites.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {favorites.map((favorite) => (
            <li key={favorite.id}>
              <RevealItem className="flex items-center gap-3 py-3">
                <MapPin
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
                <p className="min-w-0 flex-1 truncate font-semibold text-foreground">
                  {favorite.name}
                </p>
                {favorite.type && (
                  <Badge variant="status" className="shrink-0">
                    {favorite.type}
                  </Badge>
                )}
              </RevealItem>
            </li>
          ))}
        </ul>
      ) : (
        <RevealItem>
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="Save hotels, restaurants, and attractions from your trips to find them here."
          />
        </RevealItem>
      )}
    </Reveal>
  )
}
