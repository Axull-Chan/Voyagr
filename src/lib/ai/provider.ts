import type { GeneratedItinerary, ItineraryRequest } from "@/lib/ai/types"

/**
 * Every provider the app could plausibly use. Listing them here rather than
 * accepting a bare string means a typo in `AI_PROVIDER` fails loudly at
 * startup instead of silently falling back.
 */
export const AI_PROVIDER_IDS = [
  "mock",
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "openrouter",
  "deepseek",
] as const

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

export interface GenerateOptions {
  /** Lets a caller abandon a slow generation without leaking the request. */
  signal?: AbortSignal
}

/**
 * The single surface a model has to implement.
 *
 * Adding a real provider means writing one of these and registering it — no
 * caller changes, because callers only ever hold this interface.
 */
export interface AiProvider {
  readonly id: AiProviderId
  readonly label: string
  /** False for providers that need an API key which isn't configured. */
  readonly isConfigured: boolean
  generateItinerary(
    request: ItineraryRequest,
    options?: GenerateOptions
  ): Promise<GeneratedItinerary>
}

/**
 * Thrown for any failure a caller might reasonably show to a user. `cause`
 * keeps the underlying error for logs without leaking it into the UI.
 */
export class AiGenerationError extends Error {
  readonly providerId: AiProviderId

  constructor(providerId: AiProviderId, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = "AiGenerationError"
    this.providerId = providerId
  }
}

export function isAiProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value)
}
