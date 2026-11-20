import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"
import { staleGenerationCutoff } from "@/features/trips/services/generation-state"

/**
 * Turns a trip stuck at `generating` (its request was killed, so nothing
 * reset it) back into a `draft`, if and only if it has been generating for
 * longer than any request can live. A compare-and-set on both the status and
 * the timestamp, so a generation that is genuinely still running is never
 * touched. RLS limits it to the caller's own trips.
 *
 * Called at the start of every action that refuses a generating trip
 * (archive, duplicate, delete, regenerate), so those actions — including the
 * `duplicate_trip` database function, which checks the stored status — see the
 * recovered `draft`. Returns whether a row was recovered; failures are
 * swallowed, since the caller's own status check still applies.
 */
export async function recoverStaleGeneration(
  supabase: SupabaseClient<Database>,
  tripId: string,
  now: number = Date.now()
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("trips")
      .update({ status: "draft" })
      .eq("id", tripId)
      .eq("status", "generating")
      .lt("updated_at", staleGenerationCutoff(now))
      .select("id")
    return !error && (data?.length ?? 0) > 0
  } catch {
    return false
  }
}
