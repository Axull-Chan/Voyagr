import type {
  ActivityRow,
  ExpenseRow,
  TripDetail,
} from "@/features/trips/queries/trip-detail"
import { toPdfText } from "@/features/trips/pdf/pdf-text"
import { convert, type ConversionTable } from "@/services/currency-service"
import {
  BUDGET_CATEGORIES,
  MEAL_TYPES,
  formatCurrency,
  tripDurationDays,
} from "@/lib/trips/trip-domain"

/**
 * The trip, shaped for a printed page.
 *
 * Everything the PDF says is decided here, as plain data, and the document
 * component only draws it. That split is what makes the document's *wording* —
 * which is where the honesty rules live — unit-testable without rendering a PDF.
 *
 * Rules carried over from the web app, and why they matter more on paper:
 *  - A modelled number is labelled "est."; a placeholder is called an example.
 *    A printed page has no hover state and is passed around without its context,
 *    so a caveat that lives only in the UI would be lost.
 *  - Ratings are never printed (nothing in this app sources a real one).
 *  - A total that silently leaves something out is worse than none, so spend that
 *    could not be converted is counted and named, not skipped.
 *
 * Every string is passed through `toPdfText`, so nothing downstream can emit a
 * character the PDF fonts would draw as the wrong glyph.
 */

export interface PdfActivity {
  when: string
  title: string
  detail: string | null
  cost: string | null
}

export interface PdfMeal {
  meal: string
  name: string
  cuisine: string | null
}

export interface PdfDay {
  heading: string
  summary: string | null
  weather: string | null
  activities: PdfActivity[]
  meals: PdfMeal[]
  dayCost: string | null
}

export interface PdfStay {
  name: string
  address: string | null
  facts: string | null
  isExample: boolean
}

export interface PdfLeg {
  route: string
  facts: string | null
}

export interface PdfBudgetRow {
  label: string
  planned: string
  spent: string
}

export interface PdfBudget {
  rows: PdfBudgetRow[]
  plannedTotal: string
  spentTotal: string
  /** The overall budget the traveller set, when they set one. */
  budgetTotal: string | null
  remaining: string | null
  /** Spend that could not be counted, stated plainly. Null when nothing was skipped. */
  warning: string | null
}

export interface PdfExpense {
  date: string
  category: string
  description: string | null
  amount: string
}

export interface PdfPackingGroup {
  category: string
  items: { text: string; checked: boolean }[]
}

export interface TripPdfModel {
  title: string
  destination: string
  dateRange: string
  facts: { label: string; value: string }[]
  statusNote: string | null
  days: PdfDay[]
  stays: PdfStay[]
  transport: PdfLeg[]
  budget: PdfBudget | null
  expenses: PdfExpense[]
  packing: PdfPackingGroup[]
  packingSummary: string | null
  notes: string | null
  generatedOn: string
  /** The standing caveat printed on the first page. */
  notice: string
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const DAY_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

function parseIso(date: string): Date | null {
  const d = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "Dates not set"
  const s = parseIso(start)
  if (!s) return "Dates not set"
  const from = LONG_DATE.format(s)
  const e = end ? parseIso(end) : null
  return e ? `${from} - ${LONG_DATE.format(e)}` : from
}

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
}

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  BUDGET_CATEGORIES.map((c) => [c.value, c.label])
)

const MODE_LABEL: Record<string, string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  car: "Car",
  ferry: "Ferry",
  metro: "Metro",
  walk: "Walk",
  rideshare: "Taxi / rideshare",
}

function title(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function money(amount: number | string | null, currency: string): string | null {
  if (amount === null || amount === "") return null
  const n = Number(amount)
  return Number.isFinite(n) ? formatCurrency(n, currency) : null
}

function durationLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** "09:00:00" -> "09:00". */
function clock(time: string | null): string | null {
  if (!time) return null
  const m = /^(\d{2}):(\d{2})/.exec(time)
  return m ? `${m[1]}:${m[2]}` : null
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * The stored weather snapshot, with the same provenance wording the web page
 * uses. This is what was recorded when the trip was planned, not a live
 * forecast — a printed page cannot refresh, so it says so.
 */
function weatherLine(day: TripDetail["days"][number]): string | null {
  const w = day.weather
  if (!w) return null

  // Beyond the forecast horizon the row carries a condition ("Forecast not yet
  // available") and no numbers: say that and nothing else.
  if (w.source === "unavailable") return w.condition

  const parts = [
    w.condition,
    w.temp_high_c !== null && w.temp_low_c !== null
      ? `${Math.round(Number(w.temp_high_c))}° / ${Math.round(Number(w.temp_low_c))}°C`
      : null,
    w.precipitation_chance !== null
      ? `${w.precipitation_chance}% chance of rain`
      : null,
  ].filter(Boolean)

  const provenance =
    w.source === "open-meteo"
      ? "forecast at time of planning"
      : "typical weather, not a forecast"

  return `${parts.join("  ·  ")}  (${provenance})`
}

function activityDetail(a: ActivityRow): string | null {
  const bits: string[] = []
  if (a.location_name && a.location_name !== a.title) bits.push(a.location_name)
  const duration = durationLabel(a.duration_minutes)
  if (duration) bits.push(duration)

  // Travel figures are straight-line estimates between the real venues — see
  // CLAUDE.md, Phase 4 — so they carry "est.".
  if (a.travel_time_minutes && a.travel_time_minutes > 0) {
    bits.push(`est. ${a.travel_time_minutes} min travel`)
  }
  const head = bits.join("  ·  ")
  const description = a.description?.trim()
  if (head && description) return `${head}\n${description}`
  return head || description || null
}

function buildDays(detail: TripDetail): PdfDay[] {
  const { trip } = detail
  return detail.days.map((day) => {
    const date = day.date ? parseIso(day.date) : null
    const heading = date
      ? `Day ${day.dayNumber}  ·  ${DAY_DATE.format(date)}`
      : `Day ${day.dayNumber}`

    const activities: PdfActivity[] = day.activities.map((a) => {
      const when =
        [SLOT_LABEL[a.time_slot ?? ""] ?? null, clock(a.start_time)]
          .filter(Boolean)
          .join("  ") || ""
      const cost =
        a.estimated_cost !== null && Number(a.estimated_cost) > 0
          ? `est. ${money(a.estimated_cost, trip.currency)}`
          : null
      return { when, title: a.title, detail: activityDetail(a), cost }
    })

    // Breakfast, lunch, dinner — not insertion order.
    const meals: PdfMeal[] = [...day.restaurants]
      .sort(
        (a, b) =>
          MEAL_TYPES.indexOf((a.meal_type ?? "lunch") as (typeof MEAL_TYPES)[number]) -
          MEAL_TYPES.indexOf((b.meal_type ?? "lunch") as (typeof MEAL_TYPES)[number])
      )
      .map((r) => ({
        meal: MEAL_LABEL[r.meal_type ?? ""] ?? "Meal",
        name: r.name,
        cuisine: r.cuisine,
      }))

    // The document labels this "Estimated cost for the day", so the figure
    // itself carries no second "est.".
    const dayCost =
      day.dailyCost !== null && Number(day.dailyCost) > 0
        ? money(day.dailyCost, trip.currency)
        : null

    return {
      heading,
      summary: day.summary,
      weather: weatherLine(day),
      activities,
      meals,
      dayCost,
    }
  })
}

function buildStays(detail: TripDetail): PdfStay[] {
  const { trip } = detail
  return detail.hotels.map((hotel) => {
    const facts = [
      hotel.nights ? `${hotel.nights} nights` : null,
      // Estimated even for a real listing: the rate is modelled from a cost
      // index, not quoted by the hotel.
      hotel.price_per_night
        ? `est. ${money(hotel.price_per_night, trip.currency)} / night`
        : null,
    ]
      .filter(Boolean)
      .join("  ·  ")
    return {
      name: hotel.name,
      address: hotel.address,
      facts: facts || null,
      isExample: hotel.source === "mock",
    }
  })
}

function buildTransport(detail: TripDetail): PdfLeg[] {
  const { trip } = detail
  return detail.transportation.map((leg) => {
    const duration = durationLabel(leg.duration_minutes)
    const facts = [
      leg.provider,
      duration ? `est. ${duration}` : null,
      leg.cost ? `est. ${money(leg.cost, trip.currency)}` : null,
      leg.notes,
    ]
      .filter(Boolean)
      .join("  ·  ")
    return {
      route: `${MODE_LABEL[leg.mode] ?? title(leg.mode)}: ${leg.from_location} to ${leg.to_location}`,
      facts: facts || null,
    }
  })
}

function buildBudget(
  detail: TripDetail,
  rates: ConversionTable
): { budget: PdfBudget | null; expenses: PdfExpense[] } {
  const { trip, budget, expenses } = detail
  const currency = trip.currency

  const plannedTotal = budget.reduce((s, r) => s + Number(r.planned_amount), 0)

  // Spend, in the trip's currency. An expense in a currency with no usable rate
  // is NOT converted and NOT silently zeroed into the total: it is counted here
  // and named in the warning, so the printed figure can't pass as complete.
  const spentByCategory = new Map<string, number>()
  let spentTotal = 0
  const skipped = new Map<string, number>() // currency -> how many expenses
  for (const e of expenses) {
    const converted = convert(Number(e.amount), e.currency, currency, rates)
    if (converted === null) {
      skipped.set(e.currency, (skipped.get(e.currency) ?? 0) + 1)
      continue
    }
    spentTotal += converted
    spentByCategory.set(e.category, (spentByCategory.get(e.category) ?? 0) + converted)
  }

  const skippedCount = [...skipped.values()].reduce((a, b) => a + b, 0)
  const warning =
    skippedCount > 0
      ? `${skippedCount} expense${skippedCount === 1 ? "" : "s"} in ${[...skipped.keys()].join(", ")} could not be converted to ${currency} (no exchange rate was available) and ${skippedCount === 1 ? "is" : "are"} not counted in "Spent".`
      : null

  const expenseRows: PdfExpense[] = expenses.map((e: ExpenseRow) => {
    const own = money(e.amount, e.currency) ?? ""
    const converted = convert(Number(e.amount), e.currency, currency, rates)
    const amount =
      e.currency !== currency && converted !== null
        ? `${own} (= ${formatCurrency(converted, currency)})`
        : own
    const d = parseIso(e.expense_date)
    return {
      date: d ? DAY_DATE.format(d) : e.expense_date,
      category: CATEGORY_LABEL[e.category] ?? title(e.category),
      description: e.description,
      amount,
    }
  })

  // No budget rows, no expenses and no overall budget: nothing worth a page.
  if (budget.length === 0 && expenses.length === 0 && trip.budget === null) {
    return { budget: null, expenses: expenseRows }
  }

  // One row per category that has anything in it; an all-zero category is noise.
  const rows: PdfBudgetRow[] = BUDGET_CATEGORIES.flatMap((cat) => {
    const planned = Number(budget.find((r) => r.category === cat.value)?.planned_amount ?? 0)
    const spent = spentByCategory.get(cat.value) ?? 0
    if (planned === 0 && spent === 0) return []
    return [
      {
        label: cat.label,
        planned: formatCurrency(planned, currency),
        spent: formatCurrency(spent, currency),
      },
    ]
  })

  const budgetTotal = trip.budget !== null ? Number(trip.budget) : null
  return {
    budget: {
      rows,
      plannedTotal: formatCurrency(plannedTotal, currency),
      spentTotal: formatCurrency(spentTotal, currency),
      budgetTotal: budgetTotal !== null ? formatCurrency(budgetTotal, currency) : null,
      remaining:
        budgetTotal !== null
          ? formatCurrency(budgetTotal - spentTotal, currency)
          : null,
      warning,
    },
    expenses: expenseRows,
  }
}

function buildPacking(detail: TripDetail): {
  groups: PdfPackingGroup[]
  summary: string | null
} {
  const items = detail.packing
  if (items.length === 0) return { groups: [], summary: null }

  const groups = new Map<string, PdfPackingGroup>()
  for (const item of items) {
    const key = item.category?.trim() || "Other"
    const group = groups.get(key) ?? { category: key, items: [] }
    group.items.push({ text: item.item, checked: item.is_checked })
    groups.set(key, group)
  }
  const packed = items.filter((i) => i.is_checked).length
  return {
    groups: [...groups.values()],
    summary: `${packed} of ${items.length} packed`,
  }
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export const PDF_NOTICE =
  "This itinerary was planned with AI. Check opening hours, prices and any bookings before you travel. " +
  'Figures marked "est." are estimates, not quotes, and anything marked "example" is a placeholder rather than a real business.'

export function buildTripPdfModel(
  detail: TripDetail,
  rates: ConversionTable,
  generatedAt: Date = new Date()
): TripPdfModel {
  const { trip } = detail
  const nights = Math.max(
    tripDurationDays(trip.start_date ?? "", trip.end_date ?? "") - 1,
    0
  )

  const facts = [
    { label: "Dates", value: formatRange(trip.start_date, trip.end_date) },
    nights > 0
      ? { label: "Length", value: `${nights} night${nights === 1 ? "" : "s"}` }
      : null,
    {
      label: "Travellers",
      value: `${trip.travelers} traveller${trip.travelers === 1 ? "" : "s"}`,
    },
    trip.budget !== null
      ? { label: "Budget", value: formatCurrency(Number(trip.budget), trip.currency) }
      : null,
  ].filter((f): f is { label: string; value: string } => f !== null)

  const { budget, expenses } = buildBudget(detail, rates)
  const packing = buildPacking(detail)

  const model: TripPdfModel = {
    title: trip.title,
    destination: trip.destination,
    dateRange: formatRange(trip.start_date, trip.end_date),
    facts,
    statusNote:
      trip.status === "archived"
        ? "Archived trip"
        : trip.status === "draft"
          ? "Draft - the itinerary has not been generated yet"
          : null,
    days: buildDays(detail),
    stays: buildStays(detail),
    transport: buildTransport(detail),
    budget,
    expenses,
    packing: packing.groups,
    packingSummary: packing.summary,
    notes: trip.additional_notes?.trim() || null,
    generatedOn: LONG_DATE.format(generatedAt),
    notice: PDF_NOTICE,
  }

  return sanitiseModel(model)
}

/**
 * Every string in the model goes through `toPdfText`. Done once, over the whole
 * tree, rather than at each field above — a field added later is then covered
 * without anyone having to remember.
 */
function sanitiseModel<T>(value: T): T {
  if (typeof value === "string") return toPdfText(value) as unknown as T
  if (Array.isArray(value)) return value.map(sanitiseModel) as unknown as T
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitiseModel(v)])
    ) as T
  }
  return value
}
