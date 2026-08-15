"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { WizardField } from "@/features/trips/components/wizard/wizard-field"
import {
  addExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/features/trips/actions/expense.actions"
import type { ExpenseRow, BudgetRow } from "@/features/trips/queries/trip-detail"
import {
  BUDGET_CATEGORIES,
  CURRENCIES,
  formatCurrency,
} from "@/lib/trips/trip-domain"
import { convert, convertAndFormat, type ConversionTable } from "@/services/currency-service"

const CATEGORY_LABEL = new Map<string, string>(
  BUDGET_CATEGORIES.map((category) => [category.value, category.label])
)

interface ExpenseFormState {
  id: string | null
  category: string
  amount: string
  currency: string
  description: string
  expenseDate: string
}

function emptyForm(tripCurrency: string): ExpenseFormState {
  return {
    id: null,
    category: BUDGET_CATEGORIES[0]?.value ?? "activities",
    amount: "",
    currency: tripCurrency,
    description: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  }
}

/**
 * The Budget section: totals, an overall progress bar, planned-vs-actual per
 * category, and the expense ledger itself.
 *
 * `budget_breakdown` (planned) and `expenses` (actual) are two different
 * tables — see the migration's own comment for why — so "actual per
 * category" here is computed client-side from the expense rows already on
 * the page, not read from a stored `actual_amount` column, which this app
 * never writes to.
 */
export function BudgetSection({
  tripId,
  budget,
  expenses,
  currency,
  total,
  rates,
  homeCurrency,
}: {
  tripId: string
  budget: BudgetRow[]
  expenses: ExpenseRow[]
  currency: string
  total: number | null
  rates: ConversionTable
  /** The traveller's own currency, when it differs from the trip's — shown
   * as a "≈" conversion hint, same as the panel this section replaced. */
  homeCurrency: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ExpenseFormState>(() => emptyForm(currency))
  const [formError, setFormError] = useState<string | null>(null)

  const planned = budget.reduce((sum, row) => sum + Number(row.planned_amount), 0)

  // Every expense converted into the trip's own currency, silently skipping
  // any this session's rate table has no quote for — better to undercount by
  // one expense than to throw away the whole total over one missing rate.
  const spent = expenses.reduce((sum, expense) => {
    const converted = convert(Number(expense.amount), expense.currency, currency, rates)
    return sum + (converted ?? 0)
  }, 0)

  const budgetTotal = total ?? planned
  const remaining = budgetTotal - spent
  const overallPercent = budgetTotal > 0 ? Math.min(100, (spent / budgetTotal) * 100) : 0
  const showConversion =
    homeCurrency !== null && homeCurrency !== currency && Object.keys(rates.rates).length > 0

  const spentByCategory = new Map<string, number>()
  for (const expense of expenses) {
    const converted = convert(Number(expense.amount), expense.currency, currency, rates) ?? 0
    spentByCategory.set(expense.category, (spentByCategory.get(expense.category) ?? 0) + converted)
  }

  function openAdd() {
    setForm(emptyForm(currency))
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(expense: ExpenseRow) {
    setForm({
      id: expense.id,
      category: expense.category,
      amount: String(expense.amount),
      currency: expense.currency,
      description: expense.description ?? "",
      expenseDate: expense.expense_date,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter an amount greater than zero.")
      return
    }
    setFormError(null)

    startTransition(async () => {
      const payload = {
        tripId,
        category: form.category as (typeof BUDGET_CATEGORIES)[number]["value"],
        amount,
        currency: form.currency as (typeof CURRENCIES)[number]["value"],
        description: form.description,
        expenseDate: form.expenseDate,
      }
      const result = form.id
        ? await updateExpenseAction({ ...payload, id: form.id })
        : await addExpenseAction(payload)

      if (!result.ok) {
        setFormError(result.error)
        return
      }
      toast.success(form.id ? "Expense updated." : "Expense logged.")
      setDialogOpen(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteExpenseAction(id, tripId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Expense removed.")
    })
  }

  return (
    <section aria-labelledby="budget-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="budget-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wallet aria-hidden="true" className="size-4 text-primary" />
          Budget
        </h2>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus aria-hidden="true" className="size-4" />
          Add expense
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Budget</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">
              {total ? formatCurrency(total, currency) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Planned</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">
              {formatCurrency(planned, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Spent</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">
              {formatCurrency(spent, currency)}
            </dd>
            {showConversion ? (
              <p className="text-xs text-muted-foreground">
                ≈ {convertAndFormat(spent, currency, homeCurrency, rates)}
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Remaining</dt>
            <dd
              className={`text-lg font-semibold tabular-nums ${remaining < 0 ? "text-destructive" : "text-foreground"}`}
            >
              {formatCurrency(remaining, currency)}
            </dd>
          </div>
        </dl>

        {budgetTotal > 0 ? (
          <div className="mt-4">
            <Progress value={overallPercent} aria-label="Overall budget spent">
              <ProgressTrack>
                <ProgressIndicator
                  className={remaining < 0 ? "bg-destructive" : undefined}
                />
              </ProgressTrack>
            </Progress>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(overallPercent)}% of budget spent
            </p>
          </div>
        ) : null}

        {budget.length > 0 ? (
          <dl className="mt-5 space-y-3 border-t border-border pt-4">
            {budget.map((row) => {
              const plannedAmount = Number(row.planned_amount)
              const actualAmount = spentByCategory.get(row.category) ?? 0
              const share = plannedAmount > 0 ? Math.min(100, (actualAmount / plannedAmount) * 100) : 0
              return (
                <div key={row.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">
                      {CATEGORY_LABEL.get(row.category) ?? row.category}
                    </dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {formatCurrency(actualAmount, currency)}
                      <span className="ml-1 font-normal text-muted-foreground">
                        / {formatCurrency(plannedAmount, currency)}
                      </span>
                    </dd>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className={`h-full rounded-full ${share >= 100 ? "bg-destructive" : "bg-primary/70"}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No budget breakdown yet.</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Logged expenses
        </h3>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing logged yet — add an expense to start tracking actual spend against the plan.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {CATEGORY_LABEL.get(expense.category) ?? expense.category}
                    {expense.description ? (
                      <span className="font-normal text-muted-foreground"> · {expense.description}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(`${expense.expense_date}T00:00:00Z`))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatCurrency(Number(expense.amount), expense.currency)}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit expense: ${expense.description || CATEGORY_LABEL.get(expense.category)}`}
                    onClick={() => openEdit(expense)}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete expense: ${expense.description || CATEGORY_LABEL.get(expense.category)}`}
                    disabled={isPending}
                    onClick={() => handleDelete(expense.id)}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <WizardField label="Category">
              {({ controlId }) => (
                <Select
                  id={controlId}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {BUDGET_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </WizardField>

            <div className="grid grid-cols-2 gap-3">
              <WizardField label="Amount">
                {({ controlId }) => (
                  <Input
                    id={controlId}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                )}
              </WizardField>
              <WizardField label="Currency">
                {({ controlId }) => (
                  <Select
                    id={controlId}
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.value}
                      </option>
                    ))}
                  </Select>
                )}
              </WizardField>
            </div>

            <WizardField label="Date">
              {({ controlId }) => (
                <Input
                  id={controlId}
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  required
                />
              )}
            </WizardField>

            <WizardField label="Description" hint="Optional">
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              )}
            </WizardField>

            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : form.id ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
