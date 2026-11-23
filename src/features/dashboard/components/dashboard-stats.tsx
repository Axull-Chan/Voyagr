import { cn } from "@/lib/utils"
import type { DashboardStat } from "@/features/dashboard/services/dashboard"

/**
 * The overview figures as a 2×2 matrix on the page ground, divided by
 * hairline cross-rules — no outer box (DESIGN.md: never put a stat in a card).
 * `band` lays the same four figures out in one row from `lg` up, for when
 * there is no hero to sit beside.
 */
export function DashboardStats({
  stats,
  layout = "rail",
}: {
  stats: DashboardStat[]
  layout?: "rail" | "band"
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2",
        layout === "band" && "lg:grid-cols-4"
      )}
    >
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            "border-border flex flex-col-reverse gap-1 px-4 py-5",
            // Cross-rules: a vertical between the columns, a horizontal between
            // the rows, nothing on the outside edges.
            index % 2 === 0 && "border-r",
            index < 2 && "border-b",
            layout === "band" && "lg:border-b-0 lg:border-r lg:last:border-r-0"
          )}
        >
          <dt className="text-caption text-muted-foreground">{stat.label}</dt>
          <dd className="text-data-lg text-foreground">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
