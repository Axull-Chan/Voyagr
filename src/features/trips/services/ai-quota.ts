import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveProviderId } from "@/lib/ai"
import { reportServerError } from "@/lib/monitoring/report-server"
import {
  describeQuotaBlock,
  getAiLimits,
  type AiUsageKind,
} from "@/lib/ai/usage-limits"
import type { Database } from "@/types/database.types"

type Client = SupabaseClient<Database>

/**
 * Reserve, then confirm, a slot of AI usage.
 *
 * The call sequence around a model request is:
 *
 *   const quota = await reserveAiQuota(supabase, "trip_generation")
 *   if (!quota.allowed) return { ok: false, error: quota.message }
 *   ...the model call...
 *   await confirmAiQuota(supabase, quota.usageId)   // only once it has succeeded
 *
 * A call that fails is never confirmed, so its reservation lapses on its own and
 * a provider outage does not burn anyone's allowance. There is deliberately no
 * "refund": a signed-in user can call database functions directly, so a refund
 * would be a way to hand yourself unlimited free calls. The reasoning and the
 * database side are in the `add_ai_usage_limits` migration.
 *
 * FAILS OPEN. If the limiter itself breaks — the migration isn't applied yet, the
 * database is unreachable — the request is allowed and the problem is logged. A
 * broken safety mechanism must not take the product down with it, and the window
 * is bounded by how fast the error is noticed. (It also makes deploy order
 * irrelevant: shipping this code before the migration is applied is harmless.)
 * It does NOT fail open on a real "limit reached" answer.
 */

export type QuotaReservation =
  /** `usageId` is null when no slot was reserved (free mock provider, or the limiter was unavailable). */
  | { allowed: true; usageId: number | null }
  | { allowed: false; message: string }

interface ReserveOptions {
  /** For tests; defaults to the configured provider. */
  providerId?: string
  now?: Date
}

export async function reserveAiQuota(
  supabase: Client,
  kind: AiUsageKind,
  options: ReserveOptions = {}
): Promise<QuotaReservation> {
  // The mock provider costs nothing and has no quota to protect.
  let providerId: string
  try {
    providerId = options.providerId ?? resolveProviderId()
  } catch {
    // An unrecognised AI_PROVIDER: the action throws its own clear error when it
    // resolves the provider, so don't reserve a slot for a call that can't happen.
    return { allowed: true, usageId: null }
  }
  if (providerId === "mock") return { allowed: true, usageId: null }

  const limits = getAiLimits(kind)

  try {
    const { data, error } = await supabase.rpc("consume_ai_quota", {
      p_kind: kind,
      p_user_limit: limits.perUser,
      p_global_limit: limits.global,
    })

    const row = data?.[0]
    if (error || !row) {
      await reportServerError(error ?? new Error("consume_ai_quota returned no row"), {
        context: "ai-quota:reserve-failed-open",
      })
      return { allowed: true, usageId: null }
    }

    if (row.allowed) return { allowed: true, usageId: row.usage_id }

    return {
      allowed: false,
      message: describeQuotaBlock(
        kind,
        {
          reason: row.reason === "global" ? "global" : "user",
          resetsAt: row.resets_at,
          max: row.max_allowed,
        },
        options.now
      ),
    }
  } catch (error) {
    await reportServerError(error, { context: "ai-quota:reserve-threw-open" })
    return { allowed: true, usageId: null }
  }
}

/** Marks a reserved slot as used. Never throws: the model call already succeeded
 * and nothing here is worth failing the traveller's request over. */
export async function confirmAiQuota(
  supabase: Client,
  usageId: number | null
): Promise<void> {
  if (usageId === null) return
  try {
    const { error } = await supabase.rpc("confirm_ai_quota", { p_usage_id: usageId })
    if (error) await reportServerError(error, { context: "ai-quota:confirm-failed" })
  } catch (error) {
    await reportServerError(error, { context: "ai-quota:confirm-threw" })
  }
}
