import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// /reset-password is deliberately excluded: it must stay reachable both by a
// freshly-authenticated recovery session (password reset email flow) and by
// an already logged-in user changing their password, so it can't be in the
// "bounce logged-in users away" list below.
const AUTH_ROUTES = ["/login", "/sign-up", "/forgot-password"]

// Every route in the (app) group, not just /dashboard. RLS already stops a
// signed-out visitor reading anyone's data, but without this they reach the
// app shell and can fill in the whole trip wizard before the submit fails —
// so this is about not wasting their time as much as it is about access.
// Keep in step with the folders under src/app/(app).
const PROTECTED_PREFIXES = ["/dashboard", "/trips", "/favorites"]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Always use getUser(), never getSession(), in server-side code: it
  // revalidates the token against Supabase's auth server instead of trusting
  // whatever is sitting in the (spoofable) cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
