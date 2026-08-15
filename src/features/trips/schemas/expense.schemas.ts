import { z } from "zod"

import { BUDGET_CATEGORY_VALUES, CURRENCY_VALUES } from "@/lib/trips/trip-domain"

function enumOf<T extends string>(values: T[]) {
  return z.enum(values as [T, ...T[]])
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const expenseSchema = z.object({
  tripId: z.string().uuid(),
  category: enumOf([...BUDGET_CATEGORY_VALUES]),
  amount: z
    .number({ invalid_type_error: "Enter an amount." })
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "That amount is unrealistically large."),
  currency: enumOf([...CURRENCY_VALUES]),
  description: z
    .string()
    .trim()
    .max(200, "Keep descriptions under 200 characters.")
    .optional()
    .or(z.literal("")),
  expenseDate: z.string().regex(ISO_DATE, "Pick a date."),
})

export type ExpenseInput = z.infer<typeof expenseSchema>

export const updateExpenseSchema = expenseSchema.extend({
  id: z.string().uuid(),
})

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
