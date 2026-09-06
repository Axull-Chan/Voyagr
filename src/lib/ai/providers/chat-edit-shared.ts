import type { Candidates } from "@/lib/ai/providers/venue-grounded"
import type {
  ChatEditRequest,
  ChatItineraryActivity,
  ChatItineraryRestaurant,
  ChatItinerarySnapshot,
  ChatOperation,
  SourcedVenue,
} from "@/lib/ai/types"
import { MEAL_TYPES, TIME_SLOTS } from "@/lib/trips/trip-domain"

/**
 * Shared between every "real model, grounded in real venues" provider that
 * proposes a chat edit — gemini and openai so far, the same pairing
 * `venue-grounded.ts` already serves for full-itinerary generation. Only
 * imports that file's existing exports; nothing here is added to it and no
 * existing caller there changes.
 */

// ---------------------------------------------------------------------------
// Synthetic ids for *existing* activities/restaurants a remove/move op might
// target — the same fix CLAUDE.md's Phase 4 already had to apply to venue
// ids (Gemini reliably 400s once a JSON-schema enum contains 2+ real, opaque
// ids together). A trip's real activity/restaurant UUIDs are exactly that
// shape, so this applies the fix pre-emptively rather than rediscovering the
// same bug against a different id.
// ---------------------------------------------------------------------------

export interface ItemRefs {
  activitiesByRef: Map<string, ChatItineraryActivity>
  restaurantsByRef: Map<string, ChatItineraryRestaurant>
}

function assignItemRefs<T>(items: T[], prefix: string): Map<string, T> {
  const map = new Map<string, T>()
  items.forEach((item, index) => map.set(`${prefix}${index + 1}`, item))
  return map
}

export function assignItemRefIds(snapshot: ChatItinerarySnapshot): ItemRefs {
  return {
    activitiesByRef: assignItemRefs(snapshot.activities, "act"),
    restaurantsByRef: assignItemRefs(snapshot.restaurants, "res"),
  }
}

// ---------------------------------------------------------------------------
// The shape every provider's model must produce.
//
// Deliberately thinner than `ChatOperation` — exactly the same split
// `ModelActivity`/`ModelRestaurant` use in venue-grounded.ts: the model picks
// *which* venue and writes prose about it, but never states a fact the venue
// itself already answers (name, coordinates, category, cuisine). Those are
// filled in by `resolveChatOperations` from the real `SourcedVenue`/existing
// row, never from this shape.
// ---------------------------------------------------------------------------

export type ModelChatOperationKind =
  | "add_activity"
  | "remove_activity"
  | "move_activity"
  | "add_restaurant"
  | "remove_restaurant"
  | "reword_day_summary"
  | "none"

export interface ModelChatOperation {
  kind: ModelChatOperationKind
  dayNumber: number | null
  timeSlot: string | null
  mealType: string | null
  /** A real venue's synthetic ref (add_activity → attractionsById,
   * add_restaurant → restaurantsById). */
  venueRef: string | null
  /** An existing item's synthetic ref (remove/move → activitiesByRef or
   * restaurantsByRef, depending on `kind`). */
  itemRef: string | null
  toDayNumber: number | null
  toTimeSlot: string | null
  title: string | null
  description: string | null
  startTime: string | null
  durationMinutes: number | null
  estimatedCost: number | null
  summary: string | null
}

export interface ModelChatResponse {
  reply: string
  operations: ModelChatOperation[]
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function venueLines(byId: Map<string, SourcedVenue>): string {
  if (byId.size === 0) return "(none available)"
  return [...byId.entries()]
    .map(([refId, v]) => `- id: ${refId} | name: "${v.name}" | kinds: ${v.kinds.join(",") || "unknown"}`)
    .join("\n")
}

function itineraryLines(snapshot: ChatItinerarySnapshot, itemRefs: ItemRefs): string {
  const activityRefById = new Map(
    [...itemRefs.activitiesByRef.entries()].map(([ref, a]) => [a.id, ref])
  )
  const restaurantRefById = new Map(
    [...itemRefs.restaurantsByRef.entries()].map(([ref, r]) => [r.id, ref])
  )

  return snapshot.days
    .map((day) => {
      const activities = snapshot.activities.filter((a) => a.dayNumber === day.dayNumber)
      const restaurants = snapshot.restaurants.filter((r) => r.dayNumber === day.dayNumber)
      const activityLines = activities
        .map(
          (a) =>
            `  - id: ${activityRefById.get(a.id)} | ${a.timeSlot ?? "unscheduled"} | "${a.title}"${a.locationName ? ` at ${a.locationName}` : ""}`
        )
        .join("\n")
      const restaurantLines = restaurants
        .map((r) => `  - id: ${restaurantRefById.get(r.id)} | ${r.mealType ?? "meal"} | "${r.name}"`)
        .join("\n")
      return [
        `Day ${day.dayNumber}${day.date ? ` (${day.date})` : ""}: ${day.summary ?? "(no summary)"}`,
        activities.length > 0 ? activityLines : "  (no activities)",
        restaurants.length > 0 ? restaurantLines : "  (no restaurants)",
      ].join("\n")
    })
    .join("\n\n")
}

function historyLines(history: ChatEditRequest["history"]): string {
  if (history.length === 0) return "(no earlier messages)"
  return history
    .slice(-6)
    .map((turn) => `${turn.role === "user" ? "Traveller" : "Assistant"}: ${turn.content}`)
    .join("\n")
}

export const CHAT_EDIT_SYSTEM_PROMPT = [
  "You are Voyagr's trip assistant. A traveller is asking you to change an itinerary that already exists.",
  "You must never invent a place. If you propose adding an activity or a restaurant, it must reference a venue by its exact id from the candidate list you are given — never a name, never a place not in that list.",
  "If the candidate list for what they're asking about is empty, or nothing in it fits, propose no add operation and say so honestly in your reply rather than inventing one.",
  "You have no real price or rating data for restaurants or activities — never claim one option is cheaper, better-rated, or more authentic than another as a fact. You may say it's a different option.",
  "Propose at most a few operations for one message — this is a small, reviewable edit, not a rewrite of the trip.",
  "If the message isn't a request to change anything (a question, small talk, unclear), reply conversationally and propose zero operations.",
  "Write short, warm, specific replies — a sentence or two, not a report.",
].join(" ")

export function buildChatPrompt(
  request: ChatEditRequest,
  candidates: Candidates,
  itemRefs: ItemRefs
): { system: string; user: string } {
  const dayCount = request.itinerary.days.length

  const user = `
Destination: ${request.itinerary.destination}
Trip currency: ${request.itinerary.currency}
Day count: ${dayCount}

Current itinerary:
${itineraryLines(request.itinerary, itemRefs)}

Candidate activities/attractions you may add from (by id only):
${venueLines(candidates.attractionsById)}

Candidate restaurants you may add from (by id only):
${venueLines(candidates.restaurantsById)}

Recent conversation:
${historyLines(request.history)}

Traveller's new message: "${request.message}"
`.trim()

  return { system: CHAT_EDIT_SYSTEM_PROMPT, user }
}

// ---------------------------------------------------------------------------
// Response mapping — the boundary where the model's choice combines with
// real data it was never trusted to state itself. Anything unresolvable is
// dropped with a warning, same `if (!x) { warnings.push(...); continue }`
// idiom `assembleItinerary` uses in venue-grounded.ts.
// ---------------------------------------------------------------------------

function asTimeSlot(value: string | null): (typeof TIME_SLOTS)[number] {
  return (TIME_SLOTS as readonly string[]).includes(value ?? "")
    ? (value as (typeof TIME_SLOTS)[number])
    : "morning"
}

function asMealType(value: string | null): (typeof MEAL_TYPES)[number] {
  return (MEAL_TYPES as readonly string[]).includes(value ?? "")
    ? (value as (typeof MEAL_TYPES)[number])
    : "lunch"
}

function inRange(value: number | null, dayCount: number): value is number {
  return value !== null && value >= 1 && value <= dayCount
}

export function resolveChatOperations(
  model: ModelChatResponse,
  candidates: Candidates,
  itemRefs: ItemRefs,
  dayCount: number
): { reply: string; operations: ChatOperation[]; warnings: string[] } {
  const warnings: string[] = []
  const operations: ChatOperation[] = []

  for (const op of model.operations) {
    switch (op.kind) {
      case "add_activity": {
        const venue = op.venueRef ? candidates.attractionsById.get(op.venueRef) : undefined
        if (!venue || !inRange(op.dayNumber, dayCount)) {
          warnings.push("Dropped a proposed activity that referenced an unknown venue or day.")
          continue
        }
        operations.push({
          kind: "add_activity",
          dayNumber: op.dayNumber,
          timeSlot: asTimeSlot(op.timeSlot),
          title: op.title?.trim() || `Visit ${venue.name}`,
          description: op.description?.trim() ?? "",
          locationName: venue.name,
          lat: venue.latitude,
          lng: venue.longitude,
          startTime: /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(op.startTime ?? "")
            ? (op.startTime as string)
            : "10:00",
          durationMinutes: Math.min(480, Math.max(15, op.durationMinutes ?? 90)),
          estimatedCost: Math.max(0, op.estimatedCost ?? 0),
          category: venue.kinds[0] ?? "interesting_places",
        })
        break
      }
      case "add_restaurant": {
        const venue = op.venueRef ? candidates.restaurantsById.get(op.venueRef) : undefined
        if (!venue || !inRange(op.dayNumber, dayCount)) {
          warnings.push("Dropped a proposed restaurant that referenced an unknown venue or day.")
          continue
        }
        operations.push({
          kind: "add_restaurant",
          dayNumber: op.dayNumber,
          mealType: asMealType(op.mealType),
          name: venue.name,
          cuisine: venue.kinds.includes("cafes") ? "Café" : "Local",
          lat: venue.latitude,
          lng: venue.longitude,
        })
        break
      }
      case "remove_activity": {
        const item = op.itemRef ? itemRefs.activitiesByRef.get(op.itemRef) : undefined
        if (!item) {
          warnings.push("Dropped a proposed removal that referenced an activity no longer on the trip.")
          continue
        }
        operations.push({ kind: "remove_activity", activityId: item.id, label: item.title })
        break
      }
      case "remove_restaurant": {
        const item = op.itemRef ? itemRefs.restaurantsByRef.get(op.itemRef) : undefined
        if (!item) {
          warnings.push("Dropped a proposed removal that referenced a restaurant no longer on the trip.")
          continue
        }
        operations.push({ kind: "remove_restaurant", restaurantId: item.id, label: item.name })
        break
      }
      case "move_activity": {
        const item = op.itemRef ? itemRefs.activitiesByRef.get(op.itemRef) : undefined
        if (!item || !inRange(op.toDayNumber, dayCount)) {
          warnings.push("Dropped a proposed move that referenced an unknown activity or day.")
          continue
        }
        operations.push({
          kind: "move_activity",
          activityId: item.id,
          label: item.title,
          toDayNumber: op.toDayNumber,
          toTimeSlot: asTimeSlot(op.toTimeSlot),
        })
        break
      }
      case "reword_day_summary": {
        if (!inRange(op.dayNumber, dayCount) || !op.summary?.trim()) {
          warnings.push("Dropped a proposed day summary with no text or an unknown day.")
          continue
        }
        operations.push({ kind: "reword_day_summary", dayNumber: op.dayNumber, summary: op.summary.trim() })
        break
      }
      case "none":
        break
    }
  }

  return { reply: model.reply, operations, warnings }
}
