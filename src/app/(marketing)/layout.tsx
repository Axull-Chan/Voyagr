export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* First stop for keyboard users: the navbar has eight tab stops ahead
          of the content. Each marketing page gives its <main> this id. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
      >
        Skip to content
      </a>
      {children}
    </div>
  )
}
