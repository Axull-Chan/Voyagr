import type { Instrumentation } from "next"

/**
 * Next.js calls this for every error thrown while serving a request: in a Server
 * Component, a route handler, a server action or middleware. Without it a failed
 * page render leaves only an anonymous stack trace in a log that is gone in an
 * hour. With it, each failure is recorded with WHICH route and WHAT kind of
 * request it was.
 *
 * Node only: the reporter uses Node APIs, and the import is dynamic so the Edge
 * runtime never loads it.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { reportServerError } = await import("@/lib/monitoring/report-server")
  await reportServerError(error, {
    context: context.routeType, // "render" | "route" | "action" | "middleware"
    route: context.routePath || request.path,
  })
}
