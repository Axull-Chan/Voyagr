import { BedDouble, Plane, Wallet } from "lucide-react"

import { BUDGET_CATEGORIES, formatCurrency } from "@/lib/trips/trip-domain"
import { convertAndFormat, type ConversionTable } from "@/services/currency-service"
import type {
  BudgetRow,
  HotelRow,
  TransportRow,
} from "@/features/trips/queries/trip-detail"

// Keyed by plain string: `budget_breakdown.category` is a text column with a
// check constraint, so a row could in principle hold a value the union does
// not know about.
const CATEGORY_LABEL = new Map<string, string>(
  BUDGET_CATEGORIES.map((category) => [category.value, category.label])
)

/**
 * Budget breakdown with live conversion.
 *
 * `homeCurrency` differs from the trip's currency when someone is planning
 * abroad — showing "¥370,230" next to "S$3,000" is the whole point, and the
 * rate comes from Frankfurter rather than a stored constant.
 */
export function BudgetPanel({
  budget,
  currency,
  total,
  rates,
  homeCurrency,
}: {
  budget: BudgetRow[]
  currency: string
  total: number | null
  rates: ConversionTable
  homeCurrency: string | null
}) {
  const planned = budget.reduce((sum, row) => sum + Number(row.planned_amount), 0)
  const showConversion =
    homeCurrency !== null && homeCurrency !== currency && Object.keys(rates.rates).length > 0

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Wallet aria-hidden="true" className="size-4 text-primary" />
        Budget
      </h2>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-foreground">
          {formatCurrency(planned, currency)}
        </p>
        {total ? (
          <p className="text-xs text-muted-foreground">
            planned of {formatCurrency(total, currency)}
          </p>
        ) : null}
      </div>

      {showConversion ? (
        <p className="mt-1 text-xs text-muted-foreground">
          ≈ {convertAndFormat(planned, currency, homeCurrency, rates)} · rates
          from {rates.asOf}
        </p>
      ) : null}

      {budget.length > 0 ? (
        <dl className="mt-4 space-y-2">
          {budget.map((row) => {
            const amount = Number(row.planned_amount)
            const share = planned > 0 ? (amount / planned) * 100 : 0
            return (
              <div key={row.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">
                    {CATEGORY_LABEL.get(row.category) ?? row.category}
                  </dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {formatCurrency(amount, currency)}
                  </dd>
                </div>
                {/* Decorative: the number above already states the value. */}
                <div
                  aria-hidden="true"
                  className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            )
          })}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No budget breakdown yet.
        </p>
      )}
    </section>
  )
}

export function StaysPanel({
  hotels,
  currency,
}: {
  hotels: HotelRow[]
  currency: string
}) {
  if (hotels.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BedDouble aria-hidden="true" className="size-4 text-primary" />
        Where you&apos;re staying
      </h2>
      <ul className="mt-3 space-y-3">
        {hotels.map((hotel) => (
          <li key={hotel.id}>
            <p className="text-sm font-medium text-foreground">{hotel.name}</p>
            {hotel.address ? (
              <p className="text-xs text-muted-foreground">{hotel.address}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                hotel.nights ? `${hotel.nights} nights` : null,
                hotel.price_per_night
                  ? `${formatCurrency(Number(hotel.price_per_night), currency)} / night`
                  : null,
                hotel.rating ? `${Number(hotel.rating)}★` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TransportPanel({
  legs,
  currency,
}: {
  legs: TransportRow[]
  currency: string
}) {
  if (legs.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Plane aria-hidden="true" className="size-4 text-primary" />
        Getting there and around
      </h2>
      <ul className="mt-3 space-y-3">
        {legs.map((leg) => (
          <li key={leg.id}>
            <p className="text-sm font-medium text-foreground">
              {leg.from_location} → {leg.to_location}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {[
                leg.mode,
                leg.duration_minutes ? `${Math.round(leg.duration_minutes / 60)} hr` : null,
                Number(leg.cost) > 0
                  ? formatCurrency(Number(leg.cost), currency)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {leg.notes ? (
              <p className="text-xs text-muted-foreground">{leg.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
