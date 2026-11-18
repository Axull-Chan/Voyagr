import type { Metadata } from "next"

import { SignUpForm } from "@/features/auth/components/signup-form"
import { pageMetadata } from "@/lib/site"

// Opts back in to indexing — see the note on the login page.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Sign up",
    description:
      "Create a free Voyagr account and let AI build your first day-by-day trip itinerary.",
    path: "/sign-up",
  }),
  robots: { index: true, follow: true },
}

export default function SignUpPage() {
  return <SignUpForm />
}
