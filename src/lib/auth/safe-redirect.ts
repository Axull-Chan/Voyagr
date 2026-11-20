/**
 * Where to send someone after they sign in, from a value an attacker can write.
 *
 * `/auth/callback?next=` and `/login?redirectTo=` both arrive in links, so
 * anyone can mint one. The callback used to build `${origin}${next}`, and a
 * `next` of `@evil.example` made that `https://<site>@evil.example` — a URL
 * whose host is evil.example, reached straight after a successful sign-in.
 *
 * Only a same-site path is accepted, and the check is deliberately stricter
 * than browsers need: anything unusual falls back to the default rather than
 * being repaired, because a legitimate caller never sends one.
 */

export const DEFAULT_AFTER_SIGN_IN = "/dashboard"

const MAX_LENGTH = 2048
/** Characters with no business in our own paths and every role in tricks. */
const FORBIDDEN = /[\\@\s\u0000-\u001f\u007f]/u
const PROBE_ORIGIN = "https://voyagr.invalid"

function isSafe(path: string): boolean {
  if (path.length === 0 || path.length > MAX_LENGTH) return false
  // Exactly one leading slash: `//host` and `/\host` are protocol-relative.
  if (!path.startsWith("/") || path.startsWith("//")) return false
  if (FORBIDDEN.test(path) || path.includes("://")) return false
  // Resolving against a fixed origin must leave the origin unchanged.
  try {
    const resolved = new URL(path, PROBE_ORIGIN)
    return resolved.origin === PROBE_ORIGIN && !resolved.pathname.startsWith("//")
  } catch {
    return false
  }
}

/**
 * `value` if it is a safe same-site path, else `fallback`.
 *
 * The value is also checked once percent-decoded, so an encoded `//`, `\` or
 * `@` (`/%2F%2Fevil.example`, `/%5Cevil.example`) is refused too, in case
 * anything downstream decodes before redirecting.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_SIGN_IN
): string {
  if (typeof value !== "string" || !isSafe(value)) return fallback
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return fallback
  }
  return isSafe(decoded) ? value : fallback
}

/**
 * The message for an `?error=` code on the login page. Only known codes map to
 * text; anything else shows nothing, so a link cannot put arbitrary words on
 * our page.
 */
export function authErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "auth-callback-failed":
      return "We couldn't finish signing you in. The link may have expired or already been used. Please log in again, or request a new link."
    default:
      return null
  }
}
