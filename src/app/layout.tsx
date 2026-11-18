import type { Metadata, Viewport } from "next"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"

import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { MotionProvider } from "@/components/motion-provider"
import { ErrorReporter } from "@/components/monitoring/error-reporter"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
// Voice, per DESIGN.md — headlines, day headings, and dialog/sheet/card
// titles via --font-heading. Weights 400/600 only (the system's discipline
// throughout); optical sizing and SOFT/WONK are what the display sizes need
// to stay legible rather than thin, so the full variable font loads instead
// of static cuts.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
})

export const metadata: Metadata = {
  title: {
    default: "Voyagr — Plan smarter trips with AI",
    template: "%s · Voyagr",
  },
  description:
    "Voyagr is an AI travel planner that builds day-by-day itineraries, tracks your budget, and adapts your trip in real time.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "font-sans antialiased",
          geistSans.variable,
          geistMono.variable,
          fraunces.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>
            <TooltipProvider>
              {children}
              <Toaster />
              <ErrorReporter />
            </TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
