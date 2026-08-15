import { IntegrationError } from "@/integrations/core/errors"
import { fetchJson } from "@/integrations/core/http"

/**
 * OpenAI's Responses API, constrained to Structured Outputs.
 *
 * This is the only shape this file supports — no chat history, no tools, no
 * streaming — because the one caller (`OpenAiProvider`) always wants exactly
 * one thing: a single JSON object matching a schema it supplies. Generation
 * genuinely runs 15–45s for an itinerary-sized response, well past the shared
 * client's 8s default, so every call here passes an explicit timeout.
 *
 * https://developers.openai.com/api/docs/guides/structured-outputs
 * https://developers.openai.com/api/docs/api-reference/responses/create
 */

const PROVIDER = "openai"
const BASE_URL = "https://api.openai.com/v1/responses"

/** Cheapest current model confirmed to support Structured Outputs on this
 * endpoint — see CLAUDE.md's Phase 4 notes for the pricing comparison this
 * was picked from. Override via `OPENAI_MODEL` without touching code. */
const DEFAULT_MODEL = "gpt-4o-mini"

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new IntegrationError(PROVIDER, "not_configured", "OPENAI_API_KEY is not set")
  }
  return key
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export interface StructuredRequest {
  system: string
  user: string
  /** Name for the schema — required by the API, not shown to the model. */
  schemaName: string
  /** Must have `additionalProperties: false` and every key in `required`. */
  schema: Record<string, unknown>
  timeoutMs?: number
  signal?: AbortSignal
}

interface ResponsesApiBody {
  id?: string
  status?: string
  output?: Array<{
    type?: string
    role?: string
    content?: Array<{ type?: string; text?: string }>
  }>
  usage?: { input_tokens?: number; output_tokens?: number }
  incomplete_details?: { reason?: string }
}

/**
 * Sends one structured-output request and returns the parsed JSON.
 *
 * Generic in `T` for caller convenience, but this only checks that the model
 * returned *some* object — it does not re-validate against the JSON Schema.
 * Structured Outputs' `strict: true` is what actually guarantees the shape;
 * trusting that rather than re-parsing defeats the point of asking for it.
 */
export async function createStructuredResponse<T>(
  request: StructuredRequest
): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = requireApiKey()
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL

  const body = await fetchJson<ResponsesApiBody>(PROVIDER, BASE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      model,
      input: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        },
      },
      max_output_tokens: 16_000,
    },
    timeoutMs: request.timeoutMs ?? 60_000,
    retries: 1,
    signal: request.signal,
  })

  if (body.status === "incomplete") {
    // Most commonly the token ceiling above was hit mid-object — a schema
    // this is strict about, truncated, cannot parse as valid JSON.
    throw new IntegrationError(
      PROVIDER,
      "invalid_response",
      `OpenAI response was cut off (${body.incomplete_details?.reason ?? "unknown reason"})`
    )
  }

  // `output` can carry more than one item (a reasoning model emits a
  // reasoning item before its message), so the message is found rather than
  // assumed to be first.
  const message = body.output?.find((item) => item.type === "message")
  const text = message?.content?.find((part) => part.type === "output_text")?.text

  if (!text) {
    throw new IntegrationError(
      PROVIDER,
      "invalid_response",
      "OpenAI response had no message content"
    )
  }

  let data: T
  try {
    data = JSON.parse(text) as T
  } catch (cause) {
    throw new IntegrationError(
      PROVIDER,
      "invalid_response",
      "OpenAI's response text was not valid JSON despite strict mode",
      { cause }
    )
  }

  return {
    data,
    usage: {
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    },
  }
}
