import type { Metadata } from "next"
import { Heart, MapPin } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal, RevealGroup, RevealItem } from "@/components/shared/reveal"
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
        <h1 className="text-2xl font-semibold text-foreground">Favorites</h1>
        <p className="text-sm text-muted-foreground">
          Places you&apos;ve saved from your trips.
        </p>
      </RevealItem>

      {favorites && favorites.length > 0 ? (
        <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => (
            <RevealItem key={favorite.id}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MapPin aria-hidden="true" className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {favorite.name}
                  </p>
                  {favorite.type && (
                    <Badge variant="outline" className="mt-1">
                      {favorite.type}
                    </Badge>
                  )}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
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
