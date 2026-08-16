import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  title: string
  description?: string
  className?: string
}

export function SectionHeading({
  title,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mx-auto max-w-xl text-center", className)}>
      <h2 className="text-headline text-foreground">{title}</h2>
      {description && (
        <p className="text-supporting mt-3 text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
