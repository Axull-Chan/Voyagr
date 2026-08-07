/**
 * Failure vocabulary shared by every integration.
 *
 * Services branch on `kind` to decide whether to retry, fall back, or surface
 * something to the user, so it deliberately describes *what went wrong* rather
 * than mirroring HTTP status codes — a 401 from Mapbox and a missing env var
 * are the same problem from the caller's point of view.
 */
export type IntegrationErrorKind =
  /** No API key configured. Expected in development; not worth retrying. */
  | "not_configured"
  /** Provider said no: bad key, forbidden, or a malformed request. */
  | "unauthorized"
  /** 429 or the provider's own quota message. Retry later, not now. */
  | "rate_limited"
  /** Network fault, timeout, or 5xx. Worth retrying. */
  | "unavailable"
  /** 200 with a body we could not understand. Never worth retrying. */
  | "invalid_response"

export class IntegrationError extends Error {
  readonly kind: IntegrationErrorKind
  readonly provider: string
  readonly status?: number

  constructor(
    provider: string,
    kind: IntegrationErrorKind,
    message: string,
    options?: { status?: number; cause?: unknown }
  ) {
    super(message, { cause: options?.cause })
    this.name = "IntegrationError"
    this.provider = provider
    this.kind = kind
    this.status = options?.status
  }

  /** Only transient classes are worth a second attempt. */
  get isRetryable(): boolean {
    return this.kind === "unavailable" || this.kind === "rate_limited"
  }
}

export function isIntegrationError(error: unknown): error is IntegrationError {
  return error instanceof IntegrationError
}

/** Maps an HTTP status onto the vocabulary above. */
export function kindFromStatus(status: number): IntegrationErrorKind {
  if (status === 401 || status === 403) return "unauthorized"
  if (status === 429) return "rate_limited"
  if (status >= 500) return "unavailable"
  return "invalid_response"
}
