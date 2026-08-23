import Link from "next/link"
import { Compass } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass aria-hidden="true" className="size-5 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-day-heading text-foreground">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        Back to home
      </Button>
    </div>
  )
}
