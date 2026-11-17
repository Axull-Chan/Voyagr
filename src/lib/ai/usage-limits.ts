/**
 * Limits on AI usage — the numbers, where they can be changed, and what a
 * blocked traveller is told.
 *
 * The enforcement itself is in Postgres (`consume_ai_quota`, see the migration
 * `add_ai_usage_limits`), because a limit held in a serverless function's memory
 * would reset on every cold start and differ between instances. This file only
 * decides which limits to ask for and how to word a refusal, and it is pure so
 * both are unit-tested.
 *
 * Why these defaults: the live model is on a free tier of roughly 1,500 requests
 * a day shared by every visitor, and each call can be retried once, so a single
 * generation can cost two requests. The global ceilings below (250 trips and 500
 * chat messages) are sized so that even if every one of them retried, the total
 * stays at that free-tier cap. The per-user figures keep one person from using a
 * meaningful share of it. All four are overridable with environment variables, so
 * they can be tuned from the host without a code change.
 */

export const AI_USAGE_KINDS = ["trip_generation", "chat_message"] as const
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number]

export interface AiLimits {
  /** Most uses one traveller gets in a rolling 24 hours. */
  perUser: number
  /** Most uses all travellers together get in a rolling 24 hours. */
  global: number
}

export const DEFAULT_AI_LIMITS: Record<AiUsageKind, AiLimits> = {
  trip_generation: { perUser: 5, global: 250 },
  chat_message: { perUser: 30, global: 500 },
}

export const AI_LIMIT_ENV: Record<AiUsageKind, { perUser: string; global: string }> = {
  trip_generation: {
    perUser: "AI_LIMIT_TRIPS_PER_USER",
    global: "AI_LIMIT_TRIPS_GLOBAL",
  },
  chat_message: {
    perUser: "AI_LIMIT_CHAT_PER_USER",
    global: "AI_LIMIT_CHAT_GLOBAL",
  },
}

/** Sanity ceiling, so a typo such as an extra zero cannot silently disable a limit. */
const MAX_LIMIT = 100_000

function parseLimit(
  name: string,
  raw: string | undefined,
  fallback: number,
  warn: (message: string) => void
): number {
  if (raw === undefined || raw.trim() === "") return fallback
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 1 && n <= MAX_LIMIT) return n
  // An unusable value falls back to the (restrictive) default rather than to
  // "no limit" — a typo must never turn protection off.
  warn(
    `[ai limits] Ignoring ${name}="${raw}": expected a whole number from 1 to ${MAX_LIMIT}. Using the default (${fallback}).`
  )
  return fallback
}

export function getAiLimits(
  kind: AiUsageKind,
  env: Record<string, string | undefined> = process.env,
  warn: (message: string) => void = console.warn
): AiLimits {
  const defaults = DEFAULT_AI_LIMITS[kind]
  const names = AI_LIMIT_ENV[kind]
  return {
    perUser: parseLimit(names.perUser, env[names.perUser], defaults.perUser, warn),
    global: parseLimit(names.global, env[names.global], defaults.global, warn),
  }
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** "in a few minutes", "in about 3 hours" — rounded up, because telling someone
 * to come back too early is worse than telling them slightly late. */
export function formatWait(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "in a moment"
  const minutes = Math.ceil(ms / 60_000)
  if (minutes <= 1) return "in a minute"
  if (minutes < 60) return `in about ${minutes} minutes`
  const hours = Math.ceil(ms / 3_600_000)
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`
}

export interface QuotaBlock {
  reason: "user" | "global"
  /** ISO timestamp at which a slot frees up, when the database knows it. */
  resetsAt: string | null
  max: number
}

export function describeQuotaBlock(
  kind: AiUsageKind,
  block: QuotaBlock,
  now: Date = new Date()
): string {
  const resets = block.resetsAt ? new Date(block.resetsAt).getTime() : Number.NaN
  const wait = Number.isNaN(resets) ? "later" : formatWait(resets - now.getTime())

  if (block.reason === "global") {
    // The traveller did nothing wrong; say so, and don't hand them a number they
    // can't act on.
    return `Voyagr has reached its daily limit for AI features across all travellers. Please try again ${wait}.`
  }

  return kind === "trip_generation"
    ? `You've used all ${block.max} of today's AI-planned trips. You can plan another ${wait}.`
    : `You've reached today's limit of ${block.max} assistant messages. You can send another ${wait}.`
}
