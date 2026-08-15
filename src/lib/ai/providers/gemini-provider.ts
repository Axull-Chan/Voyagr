import { AiGenerationError, type AiProvider, type GenerateOptions } from "@/lib/ai/provider"
import { mockAiProvider } from "@/lib/ai/providers/mock-provider"
import {
  assembleItinerary,
  buildPrompt,
  hasGroundingData,
  selectCandidates,
  type ModelItinerary,
} from "@/lib/ai/providers/venue-grounded"
import type { GeneratedItinerary, ItineraryRequest } from "@/lib/ai/types"
import { MEAL_TYPES, TIME_SLOTS, TRANSPORT_MODES, tripDurationDays } from "@/lib/trips/trip-domain"
import { isIntegrationError } from "@/integrations/core/errors"
import { createStructuredResponse, isGeminiConfigured } from "@/integrations/gemini/generate"

/**
 * The real itinerary generator — Gemini's `generateContent` with a
 * schema-controlled response.
 *
 * Same guarantee as `openai-provider.ts`, same shared mapping logic in
 * `venue-grounded.ts` — every venue reference is constrained to an `enum` of
 * the real candidate ids, so the model cannot reference a place that doesn't
 * exist. The only thing genuinely specific to this file is `buildSchema`'s
 * dialect: Gemini's `responseSchema` is a subset of the OpenAPI 3.0 Schema
 * Object, which expresses "this field may be null" with a separate
 * `nullable: true` flag on a single scalar `type`, not JSON Schema's
 * `type: [x, "null"]` array form OpenAI's schema uses for the same thing.
 * Copying the OpenAI schema verbatim would silently mistype every nullable
 * field here.
 *
 * `additionalProperties` is also absent on purpose, not an oversight — a live
 * request with it present failed with `Unknown name "additionalProperties"...
 * Cannot find field`, so Gemini's subset doesn't include that keyword at all.
 * Harmless to drop: `required` plus an exhaustive `properties` list is what
 * actually constrains valid data, and the mapping code in `venue-grounded.ts`
 * only ever reads named fields, so a stray extra key would just be ignored,
 * not trusted.
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
      : { type: "string" } // hasGroundingData should make this branch unreachable in practice.

  return {
    type: "object",
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
      hotelVenueId:
        hotelIds.length > 0
          ? { type: "string", enum: hotelIds, nullable: true }
          : { type: "string", nullable: true },
      transportation: {
        type: "array",
        items: {
          type: "object",
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
            provider: { type: "string", nullable: true },
            fromLocation: { type: "string" },
            toLocation: { type: "string" },
            durationMinutes: { type: "integer", minimum: 0, maximum: 1440 },
            cost: { type: "number", minimum: 0 },
            notes: { type: "string", nullable: true },
            dayNumber: { type: "integer", nullable: true, minimum: 1, maximum: dayCount },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  } as const
}

export class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const
  readonly label = "Gemini"

  get isConfigured(): boolean {
    return isGeminiConfigured()
  }

  async generateItinerary(
    request: ItineraryRequest,
    options?: GenerateOptions
  ): Promise<GeneratedItinerary> {
    const sourced = request.sourced

    if (!hasGroundingData(sourced)) {
      return mockAiProvider.generateItinerary(request, options)
    }
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
        schema,
        signal: options?.signal,
      })
      model = result.data
    } catch (error) {
      if (isIntegrationError(error)) {
        throw new AiGenerationError(
          this.id,
          error.kind === "rate_limited"
            ? "Gemini is rate-limiting us right now — try generating again in a moment."
            : "We couldn't reach Gemini to build your itinerary.",
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
}

export const geminiProvider: AiProvider = new GeminiProvider()
