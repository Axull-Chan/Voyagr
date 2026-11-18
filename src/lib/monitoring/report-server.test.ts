import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { reportServerError, type ReportClient } from "@/lib/monitoring/report-server"

function fakeClient(rpc: (...args: unknown[]) => unknown) {
  const spy = vi.fn(rpc)
  return { client: { rpc: spy } as unknown as ReportClient, rpc: spy }
}

let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const parse = (spy: ReturnType<typeof vi.spyOn>) => JSON.parse(spy.mock.calls[0]![0] as string)

describe("the log line", () => {
  it("is always written as one line of JSON, even with durable reporting off", async () => {
    const { client, rpc } = fakeClient(async () => ({}))
    await reportServerError(new TypeError("boom"), {
      context: "route:tripPdf",
      route: "/trips/[id]/export/pdf",
      client,
      enabled: false,
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = parse(errorSpy)
    expect(line).toMatchObject({
      event: "app_error",
      source: "server",
      severity: "error",
      context: "route:tripPdf",
      name: "TypeError",
      message: "boom",
      route: "/trips/[id]/export/pdf",
    })
    expect(line.stack).toContain("TypeError: boom")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("logs a warning through console.warn, so severity survives into the log", async () => {
    await reportServerError(new Error("weather down"), {
      context: "service:Weather",
      severity: "warning",
      client: null,
      enabled: false,
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(parse(warnSpy)).toMatchObject({ severity: "warning", context: "service:Weather" })
  })

  it("stamps the release from the commit id", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "86fc1967ce95f0ad670484c1c03dace7b2455e81")
    await reportServerError(new Error("x"), { context: "c", client: null, enabled: false })
    expect(parse(errorSpy).release).toBe("86fc196")
  })
})

describe("the durable record", () => {
  it("is sent through report_error with every argument present", async () => {
    const { client, rpc } = fakeClient(async () => ({ error: null }))
    await reportServerError(new Error("boom"), { context: "action:createTrip", client, enabled: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(fn).toBe("report_error")
    expect(Object.keys(args).sort()).toEqual([
      "p_context", "p_digest", "p_message", "p_name", "p_release", "p_route",
      "p_severity", "p_source", "p_stack", "p_user_agent",
    ])
    expect(args).toMatchObject({
      p_source: "server",
      p_severity: "error",
      p_context: "action:createTrip",
      p_message: "boom",
      p_route: null,
      p_user_agent: null,
    })
  })

  it("is skipped when reporting is off, and when there is no client to send with", async () => {
    const off = fakeClient(async () => ({}))
    await reportServerError(new Error("x"), { context: "c", client: off.client, enabled: false })
    expect(off.rpc).not.toHaveBeenCalled()

    await expect(
      reportServerError(new Error("x"), { context: "c", client: null, enabled: true })
    ).resolves.toBeUndefined()
  })

  it("is off by default — local development and previews must not write to the real record", async () => {
    const { client, rpc } = fakeClient(async () => ({}))
    // No `enabled` option and no NEXT_PUBLIC_ERROR_REPORTING in the environment.
    await reportServerError(new Error("x"), { context: "c", client })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("is on when the environment says so", async () => {
    vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING", "on")
    const { client, rpc } = fakeClient(async () => ({}))
    await reportServerError(new Error("x"), { context: "c", client })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("ignores redirect() and notFound(), which are thrown on purpose", async () => {
    const { client, rpc } = fakeClient(async () => ({}))
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" })
    await reportServerError(redirect, { context: "c", client, enabled: true })
    await reportServerError(Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" }), {
      context: "c", client, enabled: true,
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("reports things that were not Errors", async () => {
    const { client, rpc } = fakeClient(async () => ({}))
    await reportServerError({ message: "relation does not exist" }, { context: "c", client, enabled: true })
    expect((rpc.mock.calls[0] as unknown[])[1]).toMatchObject({ p_message: "relation does not exist" })
  })
})

describe("never makes the original problem worse", () => {
  it("does not throw when the database call rejects", async () => {
    const { client } = fakeClient(async () => {
      throw new Error("connection reset")
    })
    await expect(
      reportServerError(new Error("x"), { context: "c", client, enabled: true })
    ).resolves.toBeUndefined()
  })

  it("does not throw when the database call throws synchronously", async () => {
    const { client } = fakeClient(() => {
      throw new Error("sync failure")
    })
    await expect(
      reportServerError(new Error("x"), { context: "c", client, enabled: true })
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled() // the original line, plus a note about the failure
  })

  it("gives up on a database call that hangs rather than holding up the request", async () => {
    const { client } = fakeClient(() => new Promise(() => {}))
    const started = Date.now()
    await reportServerError(new Error("x"), { context: "c", client, enabled: true, timeoutMs: 60 })
    expect(Date.now() - started).toBeLessThan(1500)
  })

  it("survives an error object that is hostile to serialisation", async () => {
    const hostile = {
      get message(): string {
        throw new Error("getter exploded")
      },
    }
    await expect(
      reportServerError(hostile, { context: "c", client: null, enabled: false })
    ).resolves.toBeUndefined()
  })
})
