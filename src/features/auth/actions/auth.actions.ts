"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { reportServerError } from "@/lib/monitoring/report-server"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignUpInput,
} from "@/features/auth/schemas/auth.schemas"

export type ActionResult = { error: string } | { success: true }

async function getOrigin() {
  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"
  return `${protocol}://${host}`
}

/**
 * Signs in and returns to `redirectTo` (the page the middleware bounced them
 * from) when it is a safe same-site path, else the dashboard. Validated here,
 * on the server, whatever the client sent.
 */
export async function signInAction(
  values: LoginInput,
  redirectTo?: string | null
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Enter a valid email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { error: error.message }
  }

  redirect(safeRedirectPath(redirectTo))
}

export async function signUpAction(values: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Please check the form for errors." }
  }

  const origin = await getOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })
  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function requestPasswordResetAction(
  values: ForgotPasswordInput
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Enter a valid email address." }
  }

  const origin = await getOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/auth/callback?next=/reset-password` }
  )
  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updatePasswordAction(
  values: ResetPasswordInput
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Please check the form for errors." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}

export async function signInWithGoogleAction(
  redirectTo?: string | null
): Promise<ActionResult> {
  const origin = await getOrigin()
  // Carried through the callback's `next`, which validates it again.
  const next = safeRedirectPath(redirectTo)
  const callback =
    next === "/dashboard"
      ? `${origin}/auth/callback`
      : `${origin}/auth/callback?next=${encodeURIComponent(next)}`
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  })
  if (error) {
    return { error: error.message }
  }

  // `signInWithOAuth` builds the authorize URL locally — it never calls the
  // auth server, so `error` above is null even when Google isn't enabled on
  // the project. Without this probe the browser navigates to that URL and the
  // user is dropped on a raw JSON 400 with no navigation and no way back.
  //
  // Asking the URL first turns that dead end into an inline message on the
  // form, and needs no configuration flag: the moment the provider is enabled
  // in Supabase the probe starts succeeding on its own.
  const probe = await fetch(data.url, { redirect: "manual" }).catch(() => null)
  if (probe && probe.status >= 400) {
    const body: unknown = await probe.json().catch(() => null)
    const message =
      typeof body === "object" && body !== null && "msg" in body
        ? String((body as { msg: unknown }).msg)
        : "Google sign-in is unavailable."
    await reportServerError(new Error(`Google sign-in rejected: ${message}`), {
      context: "action:signInWithGoogle",
    })
    // No directional wording: this message renders under the fields on the
    // login form and above them on sign-up, so "below" would be wrong on one
    // of the two.
    return {
      error: "Google sign-in isn't set up yet — please use your email and password instead.",
    }
  }

  // `redirect` throws internally to unwind, so it has to stay outside any
  // try/catch that would swallow it.
  redirect(data.url)
}
