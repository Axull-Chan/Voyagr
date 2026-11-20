import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // Never `${origin}${next}` with a raw `next`: `@evil.example` would make the
  // host evil.example. Only a same-site path survives; anything else -> /dashboard.
  const next = safeRedirectPath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
