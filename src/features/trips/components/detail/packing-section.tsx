"use client"

import { useMemo, useState, useTransition } from "react"
import { Plus, Trash2, Backpack } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { SwipeToDelete } from "@/components/shared/swipe-to-delete"
import {
  addPackingItemAction,
  deletePackingItemAction,
  togglePackingItemAction,
} from "@/features/trips/actions/packing.actions"
import type { PackingItemRow } from "@/features/trips/queries/trip-detail"

/** Shown in the new-item category datalist alongside whatever's already on
 * this trip's list, so a first-time trip still has sensible suggestions. */
const SUGGESTED_CATEGORIES = [
  "Documents",
  "Clothing",
  "Electronics",
  "Health",
  "Toiletries",
  "Travel Essentials",
  "Miscellaneous",
]

const UNCATEGORISED = "Other"

/**
 * The Packing section: progress, items grouped by category, and full CRUD.
 *
 * Generated items and user-added items are the same row shape and go through
 * the same actions — nothing here distinguishes "AI-suggested" from
 * "traveller-added" once a list exists, which is deliberate: a user's own
 * edit to a generated item is exactly as permanent as the generated item was.
 */
export function PackingSection({
  tripId,
  items,
}: {
  tripId: string
  items: PackingItemRow[]
}) {
  const [isPending, startTransition] = useTransition()
  const [newItem, setNewItem] = useState("")
  const [newCategory, setNewCategory] = useState("")

  const packedCount = items.filter((i) => i.is_checked).length
  const percent = items.length > 0 ? Math.round((packedCount / items.length) * 100) : 0

  const grouped = useMemo(() => {
    const map = new Map<string, PackingItemRow[]>()
    for (const item of items) {
      const key = item.category?.trim() || UNCATEGORISED
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [items])

  const categoryOptions = useMemo(() => {
    const existing = [...new Set(items.map((i) => i.category?.trim()).filter(Boolean))] as string[]
    return [...new Set([...existing, ...SUGGESTED_CATEGORIES])]
  }, [items])

  function handleToggle(item: PackingItemRow) {
    startTransition(async () => {
      const result = await togglePackingItemAction(item.id, tripId, !item.is_checked)
      if (!result.ok) toast.error(result.error)
    })
  }

  function handleDelete(item: PackingItemRow) {
    startTransition(async () => {
      const result = await deletePackingItemAction(item.id, tripId)
      if (!result.ok) toast.error(result.error)
      else toast.success("Item removed.")
    })
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const item = newItem.trim()
    if (!item) return
    const category = newCategory.trim() || "Miscellaneous"

    startTransition(async () => {
      const result = await addPackingItemAction({ tripId, category, item })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setNewItem("")
      toast.success("Added to your list.")
    })
  }

  return (
    <section aria-labelledby="packing-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="packing-heading"
          className="flex items-center gap-2 text-destination text-foreground"
        >
          <Backpack aria-hidden="true" className="size-4 text-primary" />
          Packing
        </h2>
        {items.length > 0 ? (
          <p className="text-data-sm text-muted-foreground">
            {packedCount} / {items.length} packed
          </p>
        ) : null}
      </div>

      {/* Same treatment as the budget section: a checklist is reference
          material you consult, not a discrete object you compare against
          others, so it gets a rule and space rather than a card. */}
      <div className="border-t border-border pt-5">
        {items.length > 0 ? (
          <div className="mb-5">
            <Progress value={percent} aria-label="Packing progress">
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>
            <p className="mt-1 text-data-sm text-muted-foreground">{percent}% packed</p>
          </div>
        ) : (
          <p className="mb-5 text-sm text-muted-foreground">
            No packing list yet — add your first item below.
          </p>
        )}

        <div className="space-y-5">
          {grouped.map(([category, categoryItems]) => (
            <div key={category}>
              <h3 className="text-eyebrow text-muted-foreground">
                {category}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {categoryItems.map((item) => (
                  <li key={item.id}>
                    <SwipeToDelete onDelete={() => handleDelete(item)} disabled={isPending}>
                      <div className="group flex items-center gap-2.5">
                        <Checkbox
                          id={`pack-${item.id}`}
                          checked={item.is_checked}
                          onCheckedChange={() => handleToggle(item)}
                          disabled={isPending}
                        />
                        <label
                          htmlFor={`pack-${item.id}`}
                          className={`flex-1 cursor-pointer text-sm ${item.is_checked ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {item.item}
                        </label>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove ${item.item} from packing list`}
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                          disabled={isPending}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </Button>
                      </div>
                    </SwipeToDelete>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAdd}
          className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap"
        >
          <label htmlFor="new-packing-item" className="sr-only">
            New packing item
          </label>
          <Input
            id="new-packing-item"
            placeholder="Add an item…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            className="min-w-0 sm:flex-1"
          />
          <div className="flex gap-2">
            <label htmlFor="new-packing-category" className="sr-only">
              Category
            </label>
            <Input
              id="new-packing-category"
              list="packing-categories"
              placeholder="Category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="min-w-0 flex-1 sm:w-32 sm:flex-initial"
            />
            <datalist id="packing-categories">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Button type="submit" size="sm" disabled={isPending || !newItem.trim()}>
              <Plus aria-hidden="true" className="size-4" />
              Add
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
