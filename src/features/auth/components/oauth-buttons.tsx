"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signInWithGoogleAction } from "@/features/auth/actions/auth.actions"

export function OAuthButtons({
  onError,
  redirectTo,
}: {
  onError?: (message: string) => void
  /** Where to return after sign-in; validated on the server. */
  redirectTo?: string | null
}) {
  const [isPending, setIsPending] = useState(false)

  async function handleGoogle() {
    setIsPending(true)
    const result = await signInWithGoogleAction(redirectTo)
    if (result && "error" in result) {
      onError?.(result.error)
    }
    setIsPending(false)
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={isPending}
      onClick={handleGoogle}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
      Continue with Google
    </Button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.87c2.27-2.09 3.58-5.17 3.58-8.66z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.87-3a7.15 7.15 0 0 1-4.07 1.14c-3.13 0-5.78-2.11-6.73-4.96H1.2v3.1A11.998 11.998 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.26a7.2 7.2 0 0 1 0-4.52v-3.1H1.2a12 12 0 0 0 0 10.72l4.07-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.42-3.42A11.6 11.6 0 0 0 12 0 11.998 11.998 0 0 0 1.2 6.64l4.07 3.1C6.22 6.9 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}
