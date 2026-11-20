import type { Metadata } from "next"

import { LoginForm } from "@/features/auth/components/login-form"
import { pageMetadata } from "@/lib/site"
import { authErrorMessage, safeRedirectPath } from "@/lib/auth/safe-redirect"

// The auth layout marks this group noindex. Log in and Sign up are the two
// entry points people search for and are listed in the sitemap, so they opt
// back in; the password-reset pages stay noindex.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Log in",
    description: "Log in to Voyagr to plan, budget and pack for your next trip.",
    path: "/login",
  }),
  robots: { index: true, follow: true },
}

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string | string[]; error?: string | string[] }>
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const requested = first(params.redirectTo)
  // Pass on only a safe path, and only when one was asked for; the action
  // validates it again on the server.
  const redirectTo = requested ? safeRedirectPath(requested) : null
  return (
    <LoginForm
      redirectTo={redirectTo}
      initialError={authErrorMessage(first(params.error))}
    />
  )
}
