import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"

/**
 * A Supabase client with the service-role key, for the few writes no signed-in
 * user may make themselves — today only `hotel_bookings` status changes (the
 * table has no insert/update/delete policy; see its migration).
 *
 * This key bypasses row-level security, so:
 *  - import it only from server actions and route handlers, never from a
 *    component (the variable has no NEXT_PUBLIC_ prefix, so a client bundle
 *    would get `undefined` and this throws rather than silently connecting);
 *  - every query made with it must scope itself to the signed-in user's id,
 *    taken from the user's own session — never from request input;
 *  - the database triggers still apply to it, which is the backstop.
 */
export function createServiceClient() {
  if (typeof window !== "undefined") {
    throw new Error("The service-role Supabase client must never run in the browser.")
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Booking writes need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.")
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
