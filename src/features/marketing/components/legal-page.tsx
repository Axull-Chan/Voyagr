import Link from "next/link"

import { MarketingNavbar } from "@/components/layout/marketing-navbar"
import { MarketingFooter } from "@/components/layout/marketing-footer"

/** Where to reach the person who runs this project. */
export const PROJECT_ISSUES_URL = "https://github.com/Axull-Chan/Voyagr/issues"

interface LegalPageProps {
  title: string
  /** One or two sentences under the title: what this page is for. */
  summary: string
  /** Shown as "Last updated: ...". Keep in step with the content below. */
  updated: string
  children: React.ReactNode
}

/**
 * Shared frame for the Privacy and Terms pages: the marketing chrome, a serif
 * title, and one reading column. Deliberately plain — long-form legal text is
 * the one place in the product where decoration has nothing to add, so there
 * is no reveal animation and no card around the prose.
 */
export function LegalPage({ title, summary, updated, children }: LegalPageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingNavbar />
      <main id="main-content" className="flex-1 px-6 py-16 sm:py-20">
        <article className="mx-auto max-w-[68ch]">
          <header className="border-b border-border pb-8">
            <h1 className="text-display text-foreground">{title}</h1>
            <p className="text-supporting mt-4 text-muted-foreground">
              {summary}
            </p>
            <p className="text-caption mt-4 text-muted-foreground">
              Last updated: {updated}
            </p>
          </header>
          <div className="mt-10 space-y-10">{children}</div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  )
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string
  heading: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-destination text-foreground">
        {heading}
      </h2>
      <div className="space-y-4 leading-relaxed text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

/** An inline link that reads as a link inside prose (underlined, not just coloured). */
export function LegalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const className =
    "rounded-sm font-medium text-primary underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
