import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { reportServerError } = vi.hoisted(() => ({ reportServerError: vi.fn() }))
vi.mock("@/lib/monitoring/report-server", () => ({ reportServerError }))

import { onRequestError } from "@/instrumentation"

const request = { path: "/trips/abc", method: "GET", headers: {} }
const context = {
  routerKind: "App Router" as const,
  routePath: "/trips/[id]",
  routeType: "render" as const,
  renderSource: "react-server-components" as const,
  revalidateReason: undefined,
}

beforeEach(() => {
  reportServerError.mockReset()
  reportServerError.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe("onRequestError", () => {
  it("records which route failed and what kind of request it was", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    const error = new Error("render failed")
    await onRequestError(error, request, context)
    expect(reportServerError).toHaveBeenCalledWith(error, {
      context: "render",
      route: "/trips/[id]",
    })
  })

  it("distinguishes a route handler and a server action from a page render", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    await onRequestError(new Error("x"), request, { ...context, routeType: "route" })
    await onRequestError(new Error("y"), request, { ...context, routeType: "action" })
    expect(reportServerError.mock.calls.map((c) => (c[1] as { context: string }).context)).toEqual([
      "route",
      "action",
    ])
  })

  it("falls back to the request path when the route pattern is unknown", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    await onRequestError(new Error("x"), request, { ...context, routePath: "" })
    expect((reportServerError.mock.calls[0] as unknown[])[1]).toMatchObject({ route: "/trips/abc" })
  })

  it("does nothing outside the Node runtime, where the reporter's APIs do not exist", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")
    await onRequestError(new Error("x"), request, context)
    expect(reportServerError).not.toHaveBeenCalled()
  })
})
