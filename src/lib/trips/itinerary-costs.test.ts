import { describe, expect, it } from "vitest"

import {
  dayCostFromActivities,
  dayCostUpdates,
  planBudgetLines,
} from "@/lib/trips/itinerary-costs"
import { budgetLineUpdates } from "@/features/trips/services/itinerary-cost-sync"

const linesOf = (plan: ReturnType<typeof planBudgetLines>) =>
  Object.fromEntries(plan.lines.map((l) => [l.category, l.plannedAmount]))

describe("planBudgetLines", () => {
  it("reproduces the live Lisbon generation (budget 1500, hotel 210, transport 4)", () => {
    const plan = planBudgetLines({ budget: 1500, hotelTotal: 210, transportTotal: 4, activityTotal: 39 })
    expect(linesOf(plan)).toEqual({
      hotels: 210,
      transportation: 4,
      food: 540,
      activities: 386,
      shopping: 206,
      emergency_fund: 154,
    })
    expect(plan.isTight).toBe(false)
  })

  it("with a budget, the lines do not move when activities change", () => {
    const before = planBudgetLines({ budget: 1500, hotelTotal: 210, transportTotal: 4, activityTotal: 39 })
    const after = planBudgetLines({ budget: 1500, hotelTotal: 210, transportTotal: 4, activityTotal: 120 })
    expect(after.lines).toEqual(before.lines)
  })

  it("without a budget, the activity total drives the plan", () => {
    const low = linesOf(planBudgetLines({ budget: null, hotelTotal: 200, transportTotal: 0, activityTotal: 100 }))
    const high = linesOf(planBudgetLines({ budget: null, hotelTotal: 200, transportTotal: 0, activityTotal: 200 }))
    // estimated = 200 + 1.6 x activities; remaining = estimated - 200 (or 20% floor)
    expect(low.activities).toBe(Math.round(Math.max(160, 360 * 0.2) * 0.3))
    expect(high.activities).toBe(Math.round(Math.max(320, 520 * 0.2) * 0.3))
    expect(high.hotels).toBe(200)
  })

  it("treats a zero budget as no budget", () => {
    expect(planBudgetLines({ budget: 0, hotelTotal: 100, transportTotal: 0, activityTotal: 50 }).lines).toEqual(
      planBudgetLines({ budget: null, hotelTotal: 100, transportTotal: 0, activityTotal: 50 }).lines
    )
  })

  it("flags a budget under 75% of the estimate as tight", () => {
    expect(planBudgetLines({ budget: 100, hotelTotal: 300, transportTotal: 0, activityTotal: 0 }).isTight).toBe(true)
  })
})

describe("dayCostFromActivities", () => {
  it("sums and rounds, counting missing, non-numeric and negative estimates as 0", () => {
    expect(dayCostFromActivities([15, "10.4", null, -5, "n/a"])).toBe(25)
    expect(dayCostFromActivities([])).toBe(0)
  })
})

describe("dayCostUpdates after chat edits", () => {
  // Day 1 held 15 + 0 + 0, day 2 held 0 + 10 + 0, day 3 held 14.
  const days = [
    { id: "d1", daily_cost: 15 },
    { id: "d2", daily_cost: "10" },
    { id: "d3", daily_cost: 14 },
  ]

  it("re-derives both days when an activity moves between them", () => {
    // The 15 activity moves from day 1 to day 2.
    const activities = [
      { trip_day_id: "d2", estimated_cost: 15 },
      { trip_day_id: "d2", estimated_cost: 10 },
      { trip_day_id: "d3", estimated_cost: 14 },
    ]
    expect(dayCostUpdates(days, activities)).toEqual([
      { id: "d1", dailyCost: 0 },
      { id: "d2", dailyCost: 25 },
    ])
  })

  it("picks up an added and a removed activity", () => {
    const activities = [
      { trip_day_id: "d1", estimated_cost: 15 },
      { trip_day_id: "d1", estimated_cost: 12 }, // added
      { trip_day_id: "d2", estimated_cost: 10 },
      // day 3's only activity removed
    ]
    expect(dayCostUpdates(days, activities)).toEqual([
      { id: "d1", dailyCost: 27 },
      { id: "d3", dailyCost: 0 },
    ])
  })

  it("writes nothing when nothing changed (string and number storage compare equal)", () => {
    const activities = [
      { trip_day_id: "d1", estimated_cost: 15 },
      { trip_day_id: "d2", estimated_cost: "10" },
      { trip_day_id: "d3", estimated_cost: 14 },
    ]
    expect(dayCostUpdates(days, activities)).toEqual([])
  })

  it("fills a null daily_cost", () => {
    expect(dayCostUpdates([{ id: "d1", daily_cost: null }], [])).toEqual([{ id: "d1", dailyCost: 0 }])
  })
})

describe("budgetLineUpdates", () => {
  const stored = [
    { id: "b1", category: "hotels", planned_amount: 200 },
    { id: "b2", category: "transportation", planned_amount: 0 },
    { id: "b3", category: "food", planned_amount: Math.round(160 * 0.42) },
    { id: "b4", category: "activities", planned_amount: Math.round(160 * 0.3) },
    { id: "b5", category: "shopping", planned_amount: Math.round(160 * 0.16) },
    { id: "b6", category: "emergency_fund", planned_amount: Math.round(160 * 0.12) },
  ]
  const hotels = [
    { total_cost: 200, is_primary: true },
    { total_cost: 999, is_primary: false },
  ]

  it("leaves a no-budget trip's lines alone while its activity total is unchanged", () => {
    expect(
      budgetLineUpdates({ budget: null, hotels, transport: [], activities: [{ estimated_cost: 100 }], stored })
    ).toEqual([])
  })

  it("updates the allocation lines of a no-budget trip when activities change", () => {
    const updates = budgetLineUpdates({
      budget: null,
      hotels,
      transport: [],
      activities: [{ estimated_cost: 100 }, { estimated_cost: 100 }],
      stored,
    })
    expect(updates).toEqual([
      { id: "b3", plannedAmount: Math.round(320 * 0.42) },
      { id: "b4", plannedAmount: Math.round(320 * 0.3) },
      { id: "b5", plannedAmount: Math.round(320 * 0.16) },
      { id: "b6", plannedAmount: Math.round(320 * 0.12) },
    ])
  })

  it("leaves a trip with its own budget alone when activities change", () => {
    const withBudget = planBudgetLines({ budget: 1000, hotelTotal: 200, transportTotal: 0, activityTotal: 0 })
    const storedWithBudget = withBudget.lines.map((l, i) => ({
      id: `b${i}`,
      category: l.category,
      planned_amount: l.plannedAmount,
    }))
    expect(
      budgetLineUpdates({
        budget: "1000",
        hotels,
        transport: [],
        activities: [{ estimated_cost: 500 }],
        stored: storedWithBudget,
      })
    ).toEqual([])
  })
})
