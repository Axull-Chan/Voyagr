import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  CHAT_GROUNDING_RULES,
  assignItemRefIds,
  budgetLines,
  buildChatPrompt,
  chatCapabilityGuide,
  forecastLine,
} from "@/lib/ai/providers/chat-edit-shared"
import type { Candidates } from "@/lib/ai/providers/venue-grounded"
import type { ChatEditRequest, ChatItinerarySnapshot } from "@/lib/ai/types"
import { getAiLimits } from "@/lib/ai/usage-limits"

/**
 * What the trip assistant is told. The rules in the snapshot builder decide
 * the facts; these tests pin that the prompt says them without dressing them
 * up: no numbers for a day without a forecast, the example-stay and
 * guessed-hours labels always present, uncounted spend always mentioned, and a
 * capability guide that follows the real limits and the real button names.
 */

const snapshot: ChatItinerarySnapshot = {
  tripId: "t1",
  destination: "Lisbon",
  currency: "EUR",
  days: [
    {
      dayNumber: 1,
      date: "2026-12-04",
      summary: "Old town",
      forecast: {
        kind: "forecast",
        origin: "live",
        condition: "Rain",
        highC: 17.2,
        lowC: 13.6,
        precipitationChance: 70,
        windKph: 22,
        severe: true,
      },
      dailyCost: 25.5,
      pace: "busy",
      paceProblems: ["About 13.1 km on foot"],
    },
    { dayNumber: 2, date: "2026-12-05", summary: null, forecast: { kind: "none" }, dailyCost: null, pace: "unknown", paceProblems: [] },
  ],
  activities: [
    {
      id: "a1",
      dayNumber: 1,
      timeSlot: "morning",
      title: "Visit the castle",
      locationName: "Castelo",
      startTime: "09:30:00",
      durationMinutes: 120,
      estimatedCost: 15,
      category: "view_points",
      description: "Views over the river.",
      legFromPrevious: { km: 1.2, minutes: 16, mode: "walk" },
    },
  ],
  restaurants: [
    { id: "r1", dayNumber: 1, mealType: "lunch", name: "Tasca", cuisine: "Local", hours: "typical meal hours 11:30 – 15:00 (not this restaurant's verified hours)" },
    { id: "r2", dayNumber: 1, mealType: "dinner", name: "Casa", cuisine: null, hours: null },
  ],
  trip: {
    title: "Lisbon long weekend",
    startDate: "2026-12-04",
    endDate: "2026-12-05",
    status: "ready",
    travelers: 2,
    travelStyle: "relaxed",
    interests: ["food", "history"],
    accommodation: "hotel",
    transportation: "public",
    startingCity: null,
    notes: "Vegetarian; avoid steep walks",
  },
  budget: {
    total: 1500,
    plannedTotal: 1420,
    plannedByCategory: [{ category: "accommodation", amount: 660 }],
    itineraryCost: 85,
    spent: 52.5,
    unconvertedExpenseCount: 1,
    remaining: 1447.5,
  },
  stays: [{ name: "Example hotel in Lisbon", nights: 2, pricePerNight: 110, isExample: true }],
  transport: [{ mode: "train", from: "Porto", to: "Lisbon", departAt: null }],
  packing: { checked: 4, total: 18 },
}

const candidates: Candidates = {
  attractionsById: new Map(),
  restaurantsById: new Map(),
  hotelsById: new Map(),
}

const request: ChatEditRequest = {
  tripId: "t1",
  message: "how is the weather on day 2?",
  history: [],
  itinerary: snapshot,
  dailyLimits: { tripsPerDay: 5, messagesPerDay: 30 },
  sourced: null,
}

const { system, user } = buildChatPrompt(request, candidates, assignItemRefIds(snapshot))
const dayBlock = (n: number) => {
  const start = user.indexOf(`Day ${n} (`)
  const next = user.indexOf(`Day ${n + 1} (`)
  return user.slice(start, next === -1 ? user.indexOf("Candidate activities") : next)
}

describe("forecast lines", () => {
  it("gives a real forecast with its origin and numbers", () => {
    expect(dayBlock(1)).toContain(
      "forecast (live): Rain, 14–17°C, 70% chance of rain, wind 22 km/h, SEVERE"
    )
    expect(forecastLine({ ...snapshot.days[0]!.forecast, origin: "planning" } as never)).toContain(
      "forecast (from when the trip was planned)"
    )
  })

  it("prints no numbers at all for a day without a forecast", () => {
    const block = dayBlock(2)
    expect(block).toContain("forecast: none available")
    expect(block).not.toMatch(/°C|% chance|km\/h/)
  })
})

describe("trip facts", () => {
  it("lists dates, travellers, style, interests, transport and the traveller's notes as theirs", () => {
    expect(user).toContain('Trip: "Lisbon long weekend" · 2026-12-04 to 2026-12-05 · 2 days · status ready')
    expect(user).toContain("Travellers: 2 · Style: relaxed · Interests: food, history")
    expect(user).toContain("Getting around: public")
    expect(user).toContain(`Traveller's own notes (their words, not checked facts): "Vegetarian; avoid steep walks"`)
    expect(user).toContain("Transport: train from Porto to Lisbon")
    expect(user).toContain("Packing list: 4 of 18 items packed")
  })

  it("always marks an example stay as not a real listing", () => {
    expect(user).toContain(
      "Stay: Example hotel in Lisbon (an EXAMPLE stay for budgeting, not a real listing) · 2 nights · est. EUR 110/night"
    )
  })

  it("quotes the budget exactly and says which spend is not included", () => {
    expect(user).toContain(
      "Budget (EUR): trip budget EUR 1,500 · planned EUR 1,420 · spent EUR 52.5 · remaining EUR 1,447.5"
    )
    expect(user).toContain('1 expense logged in another currency is NOT included in "spent" or "remaining"')
    expect(budgetLines({ ...snapshot.budget, unconvertedExpenseCount: 0 }, "EUR")).not.toContain("NOT included")
    expect(budgetLines({ ...snapshot.budget, unconvertedExpenseCount: 3 }, "EUR")).toContain("3 expenses logged in another currency are NOT included")
  })
})

describe("itinerary logistics", () => {
  it("shows time, length, cost estimate, category, leg and description for an activity", () => {
    const block = dayBlock(1)
    expect(block).toContain('morning 09:30, 120 min, est. EUR 15 | "Visit the castle" at Castelo [view_points]')
    expect(block).toContain("getting there: est. 1.2 km, ~16 min on foot")
    expect(block).toContain("about: Views over the river.")
    expect(block).toContain("pace: Busy (About 13.1 km on foot)")
    expect(block).toContain("activities est. EUR 25.5")
  })

  it("labels guessed hours and says unknown otherwise; never prints a rating", () => {
    expect(user).toContain("hours: typical meal hours 11:30 – 15:00 (not this restaurant's verified hours)")
    expect(user).toContain('"Casa" | hours: unknown')
    expect(user.toLowerCase()).not.toMatch(/rating|★|stars?\b/)
  })
})

describe("system prompt", () => {
  it("carries the grounding rules and the capability guide", () => {
    expect(system).toContain(CHAT_GROUNDING_RULES)
    expect(system).toContain(chatCapabilityGuide(request.dailyLimits))
    expect(CHAT_GROUNDING_RULES).toContain("forecast: none available")
    expect(CHAT_GROUNDING_RULES).toMatch(/never describe typical or likely weather/)
  })

  it("states the daily limits the limiter actually uses", () => {
    const tight = { AI_LIMIT_CHAT_PER_USER: "7", AI_LIMIT_TRIPS_PER_USER: "2" }
    const guide = chatCapabilityGuide({
      tripsPerDay: getAiLimits("trip_generation", tight).perUser,
      messagesPerDay: getAiLimits("chat_message", tight).perUser,
    })
    expect(guide).toContain("7 assistant messages and 2 new AI trip plans in any 24 hours")
  })

  it("names only controls that exist on the trip page", () => {
    const source = ["trip-actions-menu.tsx", "replan-button.tsx", "budget-section.tsx"]
      .map((file) => readFileSync(join(process.cwd(), "src/features/trips/components/detail", file), "utf8"))
      .join("\n")
    const guide = chatCapabilityGuide(request.dailyLimits)
    for (const label of [
      "Adapt for weather",
      "Optimize pace",
      "Change dates",
      "Edit budget",
      "Rename",
      "Duplicate",
      "Download PDF",
      "Export as JSON",
      "Archive",
      "Delete",
      "Add expense",
    ]) {
      expect(guide).toContain(label)
      expect(source).toContain(label)
    }
  })
})
