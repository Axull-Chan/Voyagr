"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  // A real route, unlike the in-page hashes above — the campaign page has
  // its own chrome, so it can't be reached any other way.
  { label: "Blue Hour", href: "/blue-hour" },
]

interface MarketingNavbarProps {
  /**
   * Sit transparently over a dark full-bleed hero (the Blue Hour film) until
   * it has scrolled past, then settle into the normal solid bar. Measured
   * against `#film-hero` rather than a fixed pixel threshold so it stays
   * correct whatever height that section resolves to.
   */
  overHero?: boolean
}

export function MarketingNavbar({ overHero = false }: MarketingNavbarProps) {
  const [onHero, setOnHero] = useState(overHero)

  useEffect(() => {
    if (!overHero) return

    let frame = 0
    const update = () => {
      frame = 0
      const hero = document.getElementById("film-hero")
      // Swap a little before the true edge so the bar is already solid by the
      // time the light content below it reaches the nav.
      setOnHero(!!hero && hero.getBoundingClientRect().bottom > 80)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [overHero])

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        onHero
          ? "border-transparent bg-transparent"
          : "border-border/60 bg-background/80 backdrop-blur-md"
      )}
    >
      {/* Scrolling content fades out as it passes under the nav instead of
          being hard-clipped — a gradient "tail" hanging below the header's
          own box, moving with it since it stickies as one unit. Suppressed
          over the film, where a light gradient would smear across it. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-full h-20 bg-gradient-to-b from-background to-transparent transition-opacity duration-300",
          onHero && "opacity-0"
        )}
      />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-sm text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            onHero ? "text-white" : "text-foreground"
          )}
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
            V
          </span>
          Voyagr
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                onHero
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "md:hidden",
                    onHero && "text-white hover:bg-white/10 hover:text-white"
                  )}
                  aria-label="Open navigation menu"
                />
              }
            >
              <Menu aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {navLinks.map((link) => (
                <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle onDark={onHero} />
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/login" />}
            className={cn(onHero && "text-white hover:bg-white/10 hover:text-white")}
          >
            Log in
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/sign-up" />}
            className={cn(onHero && "bg-white text-neutral-900 hover:bg-white/90")}
          >
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}
