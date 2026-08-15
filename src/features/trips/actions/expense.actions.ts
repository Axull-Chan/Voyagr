"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  expenseSchema,
  updateExpenseSchema,
  type ExpenseInput,
  type UpdateExpenseInput,
} from "@/features/trips/schemas/expense.schemas"

export type ExpenseActionResult = { ok: true } | { ok: false; error: string }

/**
 * Logs, edits, and removes individual expenses against `expenses`.
 *
 * Ownership is never checked here directly — every query is scoped by the
 * trip's RLS policies (`exists (... trips where user_id = auth.uid())`), so a
 * request for a trip this user doesn't own fails at the database rather than
 * needing a duplicate check in application code.
 */

export async function addExpenseAction(input: ExpenseInput): Promise<ExpenseActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the expense details.",
    }
  }
  const { tripId, category, amount, currency, description, expenseDate } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to log an expense." }
  }

  const { error } = await supabase.from("expenses").insert({
    trip_id: tripId,
    category,
    amount,
    currency,
    description: description || null,
    expense_date: expenseDate,
  })
  if (error) {
    return { ok: false, error: "We couldn't save that expense. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function updateExpenseAction(
  input: UpdateExpenseInput
): Promise<ExpenseActionResult> {
  const parsed = updateExpenseSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the expense details.",
    }
  }
  const { id, tripId, category, amount, currency, description, expenseDate } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to edit an expense." }
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      category,
      amount,
      currency,
      description: description || null,
      expense_date: expenseDate,
    })
    .eq("id", id)
  if (error) {
    return { ok: false, error: "We couldn't update that expense. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}

export async function deleteExpenseAction(
  id: string,
  tripId: string
): Promise<ExpenseActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in to delete an expense." }
  }

  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) {
    return { ok: false, error: "We couldn't delete that expense. Please try again." }
  }

  revalidatePath(`/trips/${tripId}`)
  return { ok: true }
}
