"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { signInAction } from "@/features/auth/actions/auth.actions"
import { OAuthButtons } from "@/features/auth/components/oauth-buttons"
import { loginSchema, type LoginInput } from "@/features/auth/schemas/auth.schemas"

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginInput) {
    setError(null)
    const result = await signInAction(values)
    if (result && "error" in result) {
      setError(result.error)
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="space-y-1.5 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Log in to keep planning your trip.
        </p>
      </div>

      <OAuthButtons onError={setError} />

      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="-my-2 inline-block rounded-sm py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="animate-spin" />
            )}
            Log in
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
