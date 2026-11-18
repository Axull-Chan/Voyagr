import type { Metadata } from "next"

import { LoginForm } from "@/features/auth/components/login-form"
import { pageMetadata } from "@/lib/site"

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

export default function LoginPage() {
  return <LoginForm />
}
