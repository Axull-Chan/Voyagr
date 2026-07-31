import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
      />
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
          V
        </span>
        Voyagr
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
