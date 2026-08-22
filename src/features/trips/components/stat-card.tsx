import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  className?: string
}

export function StatCard({ icon: Icon, label, value, className }: StatCardProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-data-lg text-foreground">{value}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </div>
    </div>
  )
}
