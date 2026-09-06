import { AiGenerationError, type AiProvider, type GenerateOptions } from "@/lib/ai/provider"
import {
  assignItemRefIds,
  buildChatPrompt,
  resolveChatOperations,
  type ItemRefs,
  type ModelChatResponse,
} from "@/lib/ai/providers/chat-edit-shared"
import { mockAiProvider } from "@/lib/ai/providers/mock-provider"
import {
  assembleItinerary,
  buildPrompt,
  hasGroundingData,
  selectCandidates,
  type Candidates,
  type ModelItinerary,
} from "@/lib/ai/providers/venue-grounded"
import type {
  ChatEditRequest,
  ChatEditResult,
  GeneratedItinerary,
  ItineraryRequest,
} from "@/lib/ai/types"
import { MEAL_TYPES, TIME_SLOTS, TRANSPORT_MODES, tripDurationDays } from "@/lib/trips/trip-domain"
import { isIntegrationError } from "@/integrations/core/errors"
import { createStructuredResponse, isOpenAiConfigured } from "@/integrations/openai/responses"

/**
 * The real itinerary generator — OpenAI's Responses API in Structured
 * Outputs' strict JSON-schema mode.
 *
 * The one rule everything else here serves: **the model never gets to state a
 * fact about a real place.** Coordinates, category, cuisine, cost tier — every
 * field that would assert something about a specific named venue is resolved
 * in `venue-grounded.ts`, afterward, from the exact `SourcedVenue` record the
 * venue was offered from. What the model contributes is arrangement and
 * prose. It cannot even *misname* a venue — `venueId` is constrained to an
 * `enum` of the real ids it was given, so strict mode itself rejects a
 * response that references anywhere else.
 *
 * Everything that isn't specific to OpenAI's request/response shape — the
 * prompt, the venue-resolution, weather/budget/packing — lives in
 * `venue-grounded.ts`, shared with `gemini-provider.ts`.
 */

/**
 * Builds the JSON Schema sent to OpenAI. `type: [x, "null"]` is JSON
 * Schema's own way to express "optional" under strict mode (every property
 * must be `required`, so nullability is how a field opts out of always
 * needing a value) — Gemini's own schema builder needs different syntax for
 * the same thing, since it speaks a different schema dialect.
 */
function buildSchema(
  attractionIds: string[],
  restaurantIds: string[],
  hotelIds: string[],
  dayCount: number
) {
  const activityIdSchema =
    attractionIds.length > 0
      ? { type: "string", enum: attractionIds }
      : { type: "string" } // No candidates: the day will simply have none — hasGroundingData should make this branch unreachable in practice.

  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "days", "hotelVenueId", "transportation", "warnings"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      days: {
        type: "array",
        minItems: dayCount,
        maxItems: dayCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["dayNumber", "summary", "activities", "restaurants"],
          properties: {
            dayNumber: { type: "integer", minimum: 1, maximum: dayCount },
            summary: { type: "string" },
            activities: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "timeSlot",
                  "venueId",
                  "title",
                  "description",
                  "startTime",
                  "durationMinutes",
                  "estimatedCost",
                ],
                properties: {
                  timeSlot: { type: "string", enum: [...TIME_SLOTS] },
                  venueId: activityIdSchema,
                  title: { type: "string" },
                  description: { type: "string" },
                  startTime: {
                    type: "string",
                    pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
                  },
                  durationMinutes: { type: "integer", minimum: 15, maximum: 480 },
                  estimatedCost: { type: "number", minimum: 0 },
                },
              },
            },
            restaurants: {
              type: "array",
              minItems: 0,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["mealType", "venueId"],
                properties: {
                  mealType: { type: "string", enum: [...MEAL_TYPES] },
                  venueId:
                    restaurantIds.length > 0
                      ? { type: "string", enum: restaurantIds }
                      : { type: "string" },
                },
              },
            },
          },
        },
      },
      hotelVenueId: {
        type: ["string", "null"],
        enum: [...hotelIds, null],
      },
      transportation: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "mode",
            "provider",
            "fromLocation",
            "toLocation",
            "durationMinutes",
            "cost",
            "notes",
            "dayNumber",
          ],
          properties: {
            mode: { type: "string", enum: [...TRANSPORT_MODES] },
            provider: { type: ["string", "null"] },
            fromLocation: { type: "string" },
            toLocation: { type: "string" },
            durationMinutes: { type: "integer", minimum: 0, maximum: 1440 },
            cost: { type: "number", minimum: 0 },
            notes: { type: ["string", "null"] },
            dayNumber: { type: ["integer", "null"], minimum: 1, maximum: dayCount },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  } as const
}

/**
 * Schema for one chat-edit turn (Phase 9). Same dialect rules as `buildSchema`
 * above (`type: [x, "null"]`, `additionalProperties: false`) — every field is
 * nullable because only a subset applies to any given `kind`, and strict mode
 * has no per-variant required set the way a `oneOf` would. `venueRef`/
 * `itemRef` enums use the same short synthetic tokens `selectCandidates`/
 * `assignItemRefIds` already produce, never a real id.
 */
function buildChatSchema(dayCount: number, candidates: Candidates, itemRefs: ItemRefs) {
  const venueRefs = [...candidates.attractionsById.keys(), ...candidates.restaurantsById.keys()]
  const itemRefIds = [...itemRefs.activitiesByRef.keys(), ...itemRefs.restaurantsByRef.keys()]

  return {
    type: "object",
    additionalProperties: false,
    required: ["reply", "operations"],
    properties: {
      reply: { type: "string" },
      operations: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind",
            "dayNumber",
            "timeSlot",
            "mealType",
            "venueRef",
            "itemRef",
            "toDayNumber",
            "toTimeSlot",
            "title",
            "description",
            "startTime",
            "durationMinutes",
            "estimatedCost",
            "summary",
          ],
          properties: {
            kind: {
              type: "string",
              enum: [
                "add_activity",
                "remove_activity",
                "move_activity",
                "add_restaurant",
                "remove_restaurant",
                "reword_day_summary",
                "none",
              ],
            },
            dayNumber: { type: ["integer", "null"], minimum: 1, maximum: dayCount },
            timeSlot: { type: ["string", "null"], enum: [...TIME_SLOTS, null] },
            mealType: { type: ["string", "null"], enum: [...MEAL_TYPES, null] },
            venueRef:
              venueRefs.length > 0
                ? { type: ["string", "null"], enum: [...venueRefs, null] }
                : { type: ["string", "null"] },
            itemRef:
              itemRefIds.length > 0
                ? { type: ["string", "null"], enum: [...itemRefIds, null] }
                : { type: ["string", "null"] },
            toDayNumber: { type: ["integer", "null"], minimum: 1, maximum: dayCount },
            toTimeSlot: { type: ["string", "null"], enum: [...TIME_SLOTS, null] },
            title: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            startTime: {
              type: ["string", "null"],
              pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
            },
            durationMinutes: { type: ["integer", "null"], minimum: 15, maximum: 480 },
            estimatedCost: { type: ["number", "null"], minimum: 0 },
            summary: { type: ["string", "null"] },
          },
        },
      },
    },
  } as const
}

export class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const
  readonly label = "OpenAI"

  get isConfigured(): boolean {
    return isOpenAiConfigured()
  }

  async generateItinerary(
    request: ItineraryRequest,
    options?: GenerateOptions
  ): Promise<GeneratedItinerary> {
    const sourced = request.sourced

    // Nothing real to ground activities in — the mock's example catalogue,
    // clearly labelled as approximate, is a more honest result than either
    // spending a real request on it or letting the model invent venues to
    // fill the gap. See mock-provider's own `isApproximate` path.
    if (!hasGroundingData(sourced)) {
      return mockAiProvider.generateItinerary(request, options)
    }
    // Narrowed by hasGroundingData above; TypeScript can't see through the
    // shared function, so this documents rather than changes anything.
    const groundedContext = sourced!

    const dayCount = tripDurationDays(request.startDate, request.endDate)
    const nights = Math.max(dayCount - 1, 1)
    const candidates = selectCandidates(groundedContext)

    const schema = buildSchema(
      [...candidates.attractionsById.keys()],
      [...candidates.restaurantsById.keys()],
      [...candidates.hotelsById.keys()],
      dayCount
    )
    const { system, user } = buildPrompt(request, groundedContext, dayCount, candidates)

    let model: ModelItinerary
    try {
      const result = await createStructuredResponse<ModelItinerary>({
        system,
        user,
        schemaName: "voyagr_itinerary",
        schema,
        signal: options?.signal,
      })
      model = result.data
    } catch (error) {
      if (isIntegrationError(error)) {
        throw new AiGenerationError(
          this.id,
          error.kind === "rate_limited"
            ? "OpenAI is rate-limiting us right now — try generating again in a moment."
            : "We couldn't reach OpenAI to build your itinerary.",
          error
        )
      }
      throw error
    }

    return assembleItinerary({
      model,
      request,
      sourced: groundedContext,
      dayCount,
      nights,
      candidates,
      providerId: this.id,
    })
  }

  async proposeItineraryEdit(
    request: ChatEditRequest,
    options?: GenerateOptions
  ): Promise<ChatEditResult> {
    // Unlike generateItinerary, an empty/missing sourced context does not
    // fall back to the mock — remove/move/reword operations need no
    // grounding at all, so an empty candidate pool just means the prompt
    // instructs the model to skip add operations this turn.
    const candidates: Candidates = request.sourced
      ? selectCandidates(request.sourced)
      : { attractionsById: new Map(), restaurantsById: new Map(), hotelsById: new Map() }
    const itemRefs = assignItemRefIds(request.itinerary)
    const dayCount = request.itinerary.days.length

    const schema = buildChatSchema(dayCount, candidates, itemRefs)
    const { system, user } = buildChatPrompt(request, candidates, itemRefs)

    let model: ModelChatResponse
    try {
      const result = await createStructuredResponse<ModelChatResponse>({
        system,
        user,
        schemaName: "voyagr_chat_edit",
        schema,
        signal: options?.signal,
      })
      model = result.data
    } catch (error) {
      if (isIntegrationError(error)) {
        throw new AiGenerationError(
          this.id,
          error.kind === "rate_limited"
            ? "OpenAI is rate-limiting us right now — try again in a moment."
            : "We couldn't reach OpenAI to look at your itinerary.",
          error
        )
      }
      throw error
    }

    const { reply, operations, warnings } = resolveChatOperations(model, candidates, itemRefs, dayCount)
    return { reply, operations, providerId: this.id, warnings }
  }
}

export const openAiProvider: AiProvider = new OpenAiProvider()
