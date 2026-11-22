import { getAiLimits, type AiLimits } from "@/lib/ai/usage-limits"

/**
 * The plans shown on the pricing section, derived from what the app actually
 * enforces so the page can't promise more than the product does.
 *
 * There is no payment system: only Free exists. Paid tiers are listed as
 * "Coming soon" with no price and no feature list, because a feature list for
 * something that can't be bought — or that isn't built (shared trips, priority
 * support) — is a promise the app can't keep. Free's numbers come from
 * `getAiLimits`, the same limits `consume_ai_quota` enforces (after its
 * database ceilings), so changing AI_LIMIT_* changes this page too.
 */

export interface PlanTier {
  id: "free" | "explorer" | "team"
  name: string
  status: "available" | "coming-soon"
  /** Null for a plan that can't be bought yet. */
  price: string | null
  cadence: string | null
  description: string
  features: string[]
  /** Small print under the features, e.g. how the limits work. */
  note: string | null
  highlighted: boolean
}

const perDay = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many} a day`

export function freePlanFeatures(trips: AiLimits, chat: AiLimits): string[] {
  return [
    perDay(trips.perUser, "AI trip plan", "AI trip plans"),
    perDay(chat.perUser, "trip-assistant message", "trip-assistant messages"),
    "Maps, live weather and real places",
    "Budget tracker with expenses in any currency",
    "Packing checklist",
    "PDF and JSON export",
  ]
}

export function pricingPlans(env: Record<string, string | undefined> = process.env): PlanTier[] {
  const quiet = () => {}
  const trips = getAiLimits("trip_generation", env, quiet)
  const chat = getAiLimits("chat_message", env, quiet)
  return [
    {
      id: "free",
      name: "Free",
      status: "available",
      price: "$0",
      cadence: "forever",
      description: "Everything Voyagr does today.",
      features: freePlanFeatures(trips, chat),
      note: "Limits reset on a rolling 24 hours. At very busy times, new plans may pause briefly for everyone.",
      highlighted: true,
    },
    {
      id: "explorer",
      name: "Explorer",
      status: "coming-soon",
      price: null,
      cadence: null,
      description: "Higher daily limits for people who travel often.",
      features: [],
      note: null,
      highlighted: false,
    },
    {
      id: "team",
      name: "Team",
      status: "coming-soon",
      price: null,
      cadence: null,
      description: "Plans for groups are on the way.",
      features: [],
      note: null,
      highlighted: false,
    },
  ]
}
