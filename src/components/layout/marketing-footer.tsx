import Link from "next/link"

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
              V
            </span>
            Voyagr
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            AI-powered trip planning — the itinerary, the budget, and the
            maps, all in one place.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground">Product</h3>
          <ul className="mt-3 space-y-2">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Voyagr. Built as a portfolio project.
        </p>
      </div>
    </footer>
  )
}
