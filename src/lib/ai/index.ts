import {
  AI_PROVIDER_IDS,
  AiGenerationError,
  isAiProviderId,
  type AiProvider,
  type AiProviderId,
} from "@/lib/ai/provider"
import { geminiProvider } from "@/lib/ai/providers/gemini-provider"
import { mockAiProvider } from "@/lib/ai/providers/mock-provider"
import { openAiProvider } from "@/lib/ai/providers/openai-provider"

export { AiGenerationError, AI_PROVIDER_IDS, isAiProviderId }
export type { AiProvider, AiProviderId }
export type * from "@/lib/ai/types"

/**
 * The provider registry — the one place that knows which implementations
 * exist.
 *
 * Real providers get added here and nowhere else: callers resolve through
 * `getAiProvider()` and only ever hold the `AiProvider` interface, so adding
 * OpenAI or Anthropic later is a new file plus one line in this map. Entries
 * are lazy so a provider's SDK is only imported if it is actually selected.
 */
const registry: Partial<Record<AiProviderId, () => AiProvider>> = {
  mock: () => mockAiProvider,
  openai: () => openAiProvider,
  gemini: () => geminiProvider,
  // anthropic: () => new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }),
}

/**
 * Which provider to use, from `AI_PROVIDER`. Unset means mock; set to
 * something unrecognised is a configuration mistake and throws rather than
 * quietly serving mock data in production.
 */
export function resolveProviderId(
  raw: string | undefined = process.env.AI_PROVIDER
): AiProviderId {
  if (!raw) return "mock"
  const value = raw.trim().toLowerCase()
  if (!isAiProviderId(value)) {
    throw new Error(
      `Unknown AI_PROVIDER "${raw}". Expected one of: ${AI_PROVIDER_IDS.join(", ")}.`
    )
  }
  return value
}

export function getAiProvider(id: AiProviderId = resolveProviderId()): AiProvider {
  const factory = registry[id]
  if (!factory) {
    throw new Error(
      `AI provider "${id}" is not implemented yet. Implemented: ${Object.keys(registry).join(", ")}.`
    )
  }
  const provider = factory()
  if (!provider.isConfigured) {
    throw new Error(
      `AI provider "${id}" is missing its configuration (likely an API key).`
    )
  }
  return provider
}
