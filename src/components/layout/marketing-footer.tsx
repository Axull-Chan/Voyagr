import Link from "next/link"

const productLinks = [
  // Rooted at "/" so they still work from /privacy and /terms, which share
  // this footer; on the landing page they resolve to an in-page jump.
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
]

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="flex gap-16">
          <FooterColumn heading="Product" links={productLinks} />
          <FooterColumn heading="Legal" links={legalLinks} />
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

function FooterColumn({
  heading,
  links,
}: {
  heading: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-foreground">{heading}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
