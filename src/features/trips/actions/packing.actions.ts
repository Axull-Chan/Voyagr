"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  packingItemSchema,
  updatePackingItemSchema,
  type PackingItemInput,
  type UpdatePackingItemInput,
} from "@/features/trips/schemas/packing.schemas"

export type PackingActionResult = { ok: true } | { ok: false; error: string }

/**
 * Checks, adds, edits, and removes items against `packing_lists`.
 *
 * The generated list is a starting point, not the final word — every
 * operation here is a plain row mutation, so a traveller's own edits persist
 * exactly the way a generated item does. Ownership is enforced by RLS, the
 * same as `expense.actions.ts`.
 */

export async function togglePackingItemAction(
  id: string,
  tripId: string,
  isChecked: boolean
): Promise<PackingActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to update packing." }
  }

  const { error } = await supabase
    .from("packing_lists")
    .update({ is_checked: isChecked })
    .eq("id", id)
  if (error) {
    return { ok: false, error: "We couldn't update that item. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function addPackingItemAction(
  input: PackingItemInput
): Promise<PackingActionResult> {
  const parsed = packingItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the item." }
  }
  const { tripId, category, item } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to add a packing item." }
  }

  // New items sort after everything already on the list, so an addition
  // never reshuffles items the traveller has already checked off.
  const { count } = await supabase
    .from("packing_lists")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)

  const { error } = await supabase.from("packing_lists").insert({
    trip_id: tripId,
    category,
    item,
    sort_order: count ?? 0,
  })
  if (error) {
    return { ok: false, error: "We couldn't add that item. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function updatePackingItemAction(
  input: UpdatePackingItemInput,
  tripId: string
): Promise<PackingActionResult> {
  const parsed = updatePackingItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the item." }
  }
  const { id, category, item, isChecked } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to edit a packing item." }
  }

  const { error } = await supabase
    .from("packing_lists")
    .update({
      ...(category !== undefined ? { category } : {}),
      ...(item !== undefined ? { item } : {}),
      ...(isChecked !== undefined ? { is_checked: isChecked } : {}),
    })
    .eq("id", id)
  if (error) {
    return { ok: false, error: "We couldn't update that item. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function deletePackingItemAction(
  id: string,
  tripId: string
): Promise<PackingActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to delete a packing item." }
  }

  const { error } = await supabase.from("packing_lists").delete().eq("id", id)
  if (error) {
    return { ok: false, error: "We couldn't delete that item. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}
