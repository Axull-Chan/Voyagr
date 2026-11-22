import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { AI_LIMIT_CEILINGS, DEFAULT_AI_LIMITS, getAiLimits } from "@/lib/ai/usage-limits"
import { pricingPlans } from "@/lib/billing/plans"
import {
  AI_NOTICE,
  dataSourceGroups,
  usesRealPlaces,
} from "@/lib/attribution"

describe("pricing plans follow the enforced limits", () => {
  it("shows Free with the real per-user limits", () => {
    const free = pricingPlans({}).find((p) => p.id === "free")!
    expect(free.status).toBe("available")
    expect(free.features).toContain(`${DEFAULT_AI_LIMITS.trip_generation.perUser} AI trip plans a day`)
    expect(free.features).toContain(`${DEFAULT_AI_LIMITS.chat_message.perUser} trip-assistant messages a day`)
  })

  it("follows AI_LIMIT_* settings, and never shows more than the database allows", () => {
    const free = pricingPlans({ AI_LIMIT_TRIPS_PER_USER: "1", AI_LIMIT_CHAT_PER_USER: "500" }).find((p) => p.id === "free")!
    expect(free.features).toContain("1 AI trip plan a day")
    expect(free.features).toContain(`${AI_LIMIT_CEILINGS.chat_message.perUser} trip-assistant messages a day`)
  })

  it("promises nothing that can't be bought or isn't built", () => {
    const paid = pricingPlans({}).filter((p) => p.id !== "free")
    expect(paid.map((p) => p.status)).toEqual(["coming-soon", "coming-soon"])
    for (const plan of paid) {
      expect(plan.price).toBeNull()
      expect(plan.features).toEqual([])
    }
    const everything = JSON.stringify(pricingPlans({})).toLowerCase()
    for (const unbuilt of ["unlimited", "collaboration", "shared trips", "priority"]) {
      expect(everything).not.toContain(unbuilt)
    }
  })
})

describe("app limits and database ceilings agree", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261122090000_cap_ai_quota_limits.sql"),
    "utf8"
  )
  it("uses the same ceilings as consume_ai_quota", () => {
    const t = AI_LIMIT_CEILINGS.trip_generation
    const c = AI_LIMIT_CEILINGS.chat_message
    expect(sql).toContain(`least(p_user_limit, case p_kind when 'trip_generation' then ${t.perUser} else ${c.perUser} end)`)
    expect(sql).toContain(`least(p_global_limit, case p_kind when 'trip_generation' then ${t.global} else ${c.global} end)`)
  })

  it("clamps a setting above the ceiling, with a warning", () => {
    const warnings: string[] = []
    const limits = getAiLimits("trip_generation", { AI_LIMIT_TRIPS_PER_USER: "50", AI_LIMIT_TRIPS_GLOBAL: "99999" }, (m) => warnings.push(m))
    expect(limits).toEqual(AI_LIMIT_CEILINGS.trip_generation)
    expect(warnings).toHaveLength(2)
  })

  it("keeps the defaults within the ceilings", () => {
    for (const kind of ["trip_generation", "chat_message"] as const) {
      expect(DEFAULT_AI_LIMITS[kind].perUser).toBeLessThanOrEqual(AI_LIMIT_CEILINGS[kind].perUser)
      expect(DEFAULT_AI_LIMITS[kind].global).toBeLessThanOrEqual(AI_LIMIT_CEILINGS[kind].global)
    }
  })
})

describe("trip page credits", () => {
  it("has the exact AI notice", () => {
    expect(AI_NOTICE).toBe("Planned with AI. Check opening hours, prices and bookings before you travel.")
  })

  it("credits exactly the sources a trip uses, linked", () => {
    expect(dataSourceGroups({ weather: false, places: false, photo: false })).toEqual([])
    const all = dataSourceGroups({ weather: true, places: true, photo: true })
    expect(all.map((g) => g.heading)).toEqual(["Weather", "Places", "Photo"])
    expect(all.flatMap((g) => g.credits.map((c) => c.label))).toEqual([
      "Open-Meteo.com (CC BY 4.0)",
      "OpenTripMap",
      "© OpenStreetMap contributors (ODbL)",
      "Unsplash",
    ])
    expect(all.flatMap((g) => g.credits).every((c) => c.href?.startsWith("https://"))).toBe(true)
  })

  it("detects real places from a real stay or an OpenStreetMap category", () => {
    expect(usesRealPlaces([], [{ source: "opentripmap" }])).toBe(true)
    expect(usesRealPlaces([{ category: "museums" }], [{ source: "mock" }])).toBe(true)
    // The example planner's own vocabulary is not a real source.
    expect(usesRealPlaces([{ category: "history" }, { category: "food" }], [{ source: "mock" }])).toBe(false)
    // Ambiguous words count as examples: under-crediting is the safer mistake.
    expect(usesRealPlaces([{ category: "beaches" }], [])).toBe(false)
    expect(usesRealPlaces([{ category: null }], [])).toBe(false)
  })
})
