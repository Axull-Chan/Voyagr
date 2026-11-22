import { IntegrationError } from "@/integrations/core/errors"
import { buildUrl, fetchJson } from "@/integrations/core/http"
import { geminiModels } from "@/lib/config/providers"

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
// Model ids come from geminiModels(): GEMINI_MODEL, else the stable GA default,
// plus an optional GEMINI_FALLBACK_MODEL.

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
  const { primary, fallback } = geminiModels()

  // With a fallback, each model gets one attempt (two 60 s attempts still fit
  // the pages' 150 s limit); without one, the primary keeps its usual retry.
  const call = (model: string, retries: number) =>
    requestModel(model, apiKey, request, retries)
  let body: GenerateContentBody
  if (!fallback) {
    body = await call(primary, 1)
  } else {
    try {
      body = await call(primary, 0)
    } catch (error) {
      // Only a busy or unreachable model is worth trying another for: a timeout,
      // a 5xx (e.g. 503 "high demand") or a network fault. A bad request, a bad
      // key or a rate limit would fail the same way on the fallback.
      if (!(error instanceof IntegrationError) || error.kind !== "unavailable") throw error
      body = await call(fallback, 0)
    }
  }

  return parseGenerateContent<T>(body)
}

/** One generateContent request against `model`. */
async function requestModel(
  model: string,
  apiKey: string,
  request: StructuredRequest,
  retries: number
): Promise<GenerateContentBody> {
  const url = buildUrl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { key: apiKey }
  )

  return fetchJson<GenerateContentBody>(PROVIDER, url, {
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
    retries,
    signal: request.signal,
  })
}

function parseGenerateContent<T>(
  body: GenerateContentBody
): { data: T; usage: { inputTokens: number; outputTokens: number } } {
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
