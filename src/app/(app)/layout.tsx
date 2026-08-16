import { cookies } from "next/headers"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single()
    : { data: null }

  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          {/* Same technique as MarketingNavbar's own fade — a gradient tail
              hanging below the header's box, moving with it since `sticky`
              already gives it a containing block. This bar has no dark-hero
              state to swap for, so it's the plain always-on version: no
              scroll listener, no opacity toggle. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full h-20 bg-gradient-to-b from-background to-transparent"
          />
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <ThemeToggle />
          {user && (
            <UserMenu
              email={user.email ?? ""}
              fullName={profile?.full_name ?? null}
              avatarUrl={profile?.avatar_url ?? null}
            />
          )}
        </header>
        {/* SidebarInset itself renders <main> (see sidebar.tsx) — this stays
            a <div> so the page has exactly one <main> landmark, not two. */}
        <div className="flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
