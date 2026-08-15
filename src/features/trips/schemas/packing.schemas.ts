import { z } from "zod"

/**
 * Packing categories are a free-text column (`packing_lists.category` has no
 * check constraint, unlike `budget_breakdown.category`) — the generated list
 * already produces categories like "Weather" and "Activities" that don't fit
 * a closed set, so this stays a plain string rather than an enum.
 */
export const packingItemSchema = z.object({
  tripId: z.string().uuid(),
  category: z.string().trim().min(1, "Pick a category.").max(60),
  item: z.string().trim().min(1, "Enter an item.").max(140),
})

export type PackingItemInput = z.infer<typeof packingItemSchema>

export const updatePackingItemSchema = z.object({
  id: z.string().uuid(),
  category: z.string().trim().min(1).max(60).optional(),
  item: z.string().trim().min(1).max(140).optional(),
  isChecked: z.boolean().optional(),
})

export type UpdatePackingItemInput = z.infer<typeof updatePackingItemSchema>
