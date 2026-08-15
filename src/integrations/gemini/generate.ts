import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"

/**
 * Gemini's `generateContent`, constrained to schema-controlled JSON output.
 *
 * Deliberately parallel to `integrations/openai/responses.ts` — same public
 * shape (`createStructuredResponse(system, user, schema) -> {data, usage}`)
 * so `venue-grounded.ts` never has to know which model actually answered.
 * What differs is entirely Google's own API conventions:
 *  - the key is a query parameter, not a bearer header;
 *  - the system prompt is a separate top-level `systemInstruction`, not a
 *    role inside `contents`;
 *  - the schema dialect is OpenAPI 3.0's (`nullable: true` on a scalar
 *    `type`), not JSON Schema's (`type: [x, "null"]`) — see
 *    `gemini-provider.ts`'s own `buildSchema` for where that's handled.
 *
 * https://ai.google.dev/api/generate-content
 */

const PROVIDER = "gemini"
const DEFAULT_MODEL = "gemini-3.6-flash"

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new IntegrationError(PROVIDER, "not_configured", "GEMINI_API_KEY is not set")
  }
  return key
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export interface StructuredRequest {
  system: string
  user: string
  /** Must use `nullable: true` rather than `type: [x, "null"]` for optional
   * fields — Gemini's schema is an OpenAPI 3.0 subset, not JSON Schema. */
  schema: Record<string, unknown>
  timeoutMs?: number
  signal?: AbortSignal
}

interface GenerateContentBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  promptFeedback?: { blockReason?: string }
}

export async function createStructuredResponse<T>(
  request: StructuredRequest
): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = requireApiKey()
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  const url = buildUrl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { key: apiKey }
  )

  const body = await fetchJson<GenerateContentBody>(PROVIDER, url, {
    method: "POST",
    body: {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: request.schema,
        maxOutputTokens: 16_000,
      },
    },
    timeoutMs: request.timeoutMs ?? 60_000,
    retries: 1,
    signal: request.signal,
  })

  if (body.promptFeedback?.blockReason) {
    // Gemini's own safety filters, not a transport failure — retrying
    // wouldn't change a blocked prompt's outcome.
    throw new IntegrationError(
      PROVIDER,
      "invalid_response",
      `Gemini blocked the request (${body.promptFeedback.blockReason})`
    )
  }

  const candidate = body.candidates?.[0]
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new IntegrationError(
      PROVIDER,
      "invalid_response",
      "Gemini's response was cut off at the token limit"
    )
  }

  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("")
  if (!text) {
    throw new IntegrationError(PROVIDER, "invalid_response", "Gemini response had no text content")
  }

  let data: T
  try {
    data = JSON.parse(text) as T
  } catch (cause) {
    throw new IntegrationError(
      PROVIDER,
      "invalid_response",
      "Gemini's response text was not valid JSON despite a response schema",
      { cause }
    )
  }

  return {
    data,
    usage: {
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}
