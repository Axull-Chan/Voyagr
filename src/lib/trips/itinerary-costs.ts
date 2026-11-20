import type { BudgetCategory } from "@/lib/trips/trip-domain"

/**
 * The cost arithmetic that generation does once, kept in one pure place so a
 * later edit (the chat's add/remove/move) can re-run exactly the same rules
 * over the rows now in the database instead of leaving stale figures behind.
 *
 * - A day's `daily_cost` is the rounded sum of its activities' estimated costs
 *   (what `venue-grounded.ts` writes for Gemini/OpenAI trips).
 * - The planned budget lines are an allocation, not a sum: hotel and transport
 *   at cost, then food/activities/shopping/emergency as fixed shares of what is
 *   left of the traveller's budget. Only when no budget was given does the
 *   activity total move the lines, through the estimated trip cost.
 */

export function roundMoney(value: number, dp = 0): number {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

/** Headroom for food/shopping on top of activities when estimating a trip with no budget. */
export const ACTIVITY_HEADROOM = 1.6

export const BUDGET_SHARES = {
  food: 0.42,
  activities: 0.3,
  shopping: 0.16,
  emergency_fund: 0.12,
} as const

export interface BudgetPlanInput {
  /** The traveller's own total, or null/0 when they gave none. */
  budget: number | null
  hotelTotal: number
  transportTotal: number
  activityTotal: number
}

export interface BudgetPlan {
  lines: { category: BudgetCategory; plannedAmount: number }[]
  /** True when the given budget is well under what the plan is estimated to cost. */
  isTight: boolean
}

export function planBudgetLines(input: BudgetPlanInput): BudgetPlan {
  const { budget, hotelTotal, transportTotal, activityTotal } = input
  const hasBudget = budget !== null && budget > 0
  const estimated = hotelTotal + transportTotal + activityTotal * ACTIVITY_HEADROOM
  const total = hasBudget ? budget : estimated
  const remaining = Math.max(total - hotelTotal - transportTotal, total * 0.2)

  return {
    lines: [
      { category: "hotels", plannedAmount: roundMoney(hotelTotal) },
      { category: "transportation", plannedAmount: roundMoney(transportTotal) },
      { category: "food", plannedAmount: roundMoney(remaining * BUDGET_SHARES.food) },
      { category: "activities", plannedAmount: roundMoney(remaining * BUDGET_SHARES.activities) },
      { category: "shopping", plannedAmount: roundMoney(remaining * BUDGET_SHARES.shopping) },
      { category: "emergency_fund", plannedAmount: roundMoney(remaining * BUDGET_SHARES.emergency_fund) },
    ],
    isTight: hasBudget && budget < estimated * 0.75,
  }
}

/** A day's cost: the rounded sum of its activities' estimates; a missing estimate counts as 0. */
export function dayCostFromActivities(costs: ReadonlyArray<number | string | null>): number {
  return roundMoney(
    costs.reduce<number>((sum, cost) => {
      const value = Number(cost)
      return sum + (Number.isFinite(value) && value > 0 ? value : 0)
    }, 0)
  )
}

export interface DayCostRow {
  id: string
  daily_cost: number | string | null
}

export interface ActivityCostRow {
  trip_day_id: string
  estimated_cost: number | string | null
}

/**
 * The `daily_cost` every day should have given the activities it now holds,
 * returning only the days whose stored value differs. A day left with no
 * activities costs 0.
 */
export function dayCostUpdates(
  days: readonly DayCostRow[],
  activities: readonly ActivityCostRow[]
): { id: string; dailyCost: number }[] {
  const costsByDay = new Map<string, (number | string | null)[]>()
  for (const activity of activities) {
    const list = costsByDay.get(activity.trip_day_id) ?? []
    list.push(activity.estimated_cost)
    costsByDay.set(activity.trip_day_id, list)
  }

  const updates: { id: string; dailyCost: number }[] = []
  for (const day of days) {
    const next = dayCostFromActivities(costsByDay.get(day.id) ?? [])
    const current = day.daily_cost === null ? null : Number(day.daily_cost)
    if (current !== next) updates.push({ id: day.id, dailyCost: next })
  }
  return updates
}
