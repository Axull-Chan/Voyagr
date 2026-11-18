import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }))

/** A fresh copy of the module per test: its throttle is module-level state. */
async function load() {
  vi.resetModules()
  return import("@/lib/monitoring/report-client")
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ error: null })
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubGlobal("window", {
    location: { pathname: "/trips/abc" },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal("navigator", { userAgent: "TestBrowser/1.0" })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const on = () => vi.stubEnv("NEXT_PUBLIC_ERROR_REPORTING", "on")

describe("reportClientError", () => {
  it("still writes to the developer console, but sends nothing while reporting is off", async () => {
    const { reportClientError } = await load()
    await reportClientError(new Error("boom"), { context: "error-boundary" })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("sends the report with the page and the browser when reporting is on", async () => {
    on()
    const { reportClientError } = await load()
    await reportClientError(new TypeError("Cannot read properties of undefined"), {
      context: "error-boundary",
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(fn).toBe("report_error")
    expect(args).toMatchObject({
      p_source: "client",
      p_severity: "error",
      p_context: "error-boundary",
      p_name: "TypeError",
      p_message: "Cannot read properties of undefined",
      p_route: "/trips/abc",
      p_user_agent: "TestBrowser/1.0",
    })
    // Every argument present, as null when empty (see toRpcArgs for why).
    expect(Object.keys(args)).toHaveLength(10)
    expect(Object.values(args)).not.toContain(undefined)
  })

  it("does not re-report a server error, which onRequestError already recorded with its real message", async () => {
    on()
    const { reportClientError } = await load()
    const fromServer = Object.assign(
      new Error("An error occurred in the Server Components render. The specific message is omitted in production builds."),
      { digest: "2198323246" }
    )
    await reportClientError(fromServer, { context: "error-boundary" })
    expect(rpc).not.toHaveBeenCalled()
    // It still reaches the developer console.
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it("drops noise that says nothing about our code, without even logging it", async () => {
    on()
    const { reportClientError } = await load()
    await reportClientError(new Error("ResizeObserver loop completed with undelivered notifications."), { context: "c" })
    await reportClientError("Script error.", { context: "c" })
    const ext = new Error("boom")
    ext.stack = "Error: boom\n    at x (chrome-extension://abc/inject.js:1:1)"
    await reportClientError(ext, { context: "c" })
    expect(rpc).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("files a dropped connection as a warning", async () => {
    on()
    const { reportClientError } = await load()
    await reportClientError(new TypeError("Failed to fetch"), { context: "window.onerror" })
    expect((rpc.mock.calls[0] as unknown[])[1]).toMatchObject({ p_severity: "warning" })
  })

  it("sends a repeating problem once, so a render loop cannot flood the database", async () => {
    on()
    const { reportClientError } = await load()
    for (let i = 0; i < 50; i++) {
      await reportClientError(new Error("same failure"), { context: "error-boundary" })
    }
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("stops at ten distinct problems per page load", async () => {
    on()
    const { reportClientError } = await load()
    for (let i = 0; i < 25; i++) {
      await reportClientError(new Error(`distinct failure ${i}`), { context: "c" })
    }
    expect(rpc).toHaveBeenCalledTimes(10)
  })

  it("never throws, whatever the network does", async () => {
    on()
    const { reportClientError } = await load()
    rpc.mockRejectedValueOnce(new Error("offline"))
    await expect(reportClientError(new Error("a"), { context: "c" })).resolves.toBeUndefined()
    rpc.mockImplementationOnce(() => {
      throw new Error("sync failure")
    })
    await expect(reportClientError(new Error("b"), { context: "c" })).resolves.toBeUndefined()
  })
})

describe("installGlobalErrorHandlers", () => {
  it("listens for the errors React's boundaries cannot see, and can be removed", async () => {
    on()
    const { installGlobalErrorHandlers } = await load()
    const win = window as unknown as {
      addEventListener: ReturnType<typeof vi.fn>
      removeEventListener: ReturnType<typeof vi.fn>
    }

    const remove = installGlobalErrorHandlers()
    const events = win.addEventListener.mock.calls.map((c) => c[0])
    expect(events).toEqual(["error", "unhandledrejection"])

    remove()
    expect(win.removeEventListener.mock.calls.map((c) => c[0])).toEqual(["error", "unhandledrejection"])
    // The very handlers that were added are the ones removed.
    expect(win.removeEventListener.mock.calls[0]![1]).toBe(win.addEventListener.mock.calls[0]![1])
  })

  it("reports an uncaught error and an unhandled promise rejection", async () => {
    on()
    const { installGlobalErrorHandlers } = await load()
    const win = window as unknown as { addEventListener: ReturnType<typeof vi.fn> }
    installGlobalErrorHandlers()
    const handlers = Object.fromEntries(
      win.addEventListener.mock.calls.map((c) => [c[0] as string, c[1] as (e: unknown) => void])
    )

    handlers.error!({ error: new Error("click handler blew up"), message: "ignored when error is set" })
    handlers.unhandledrejection!({ reason: new Error("nobody awaited this") })
    await new Promise((r) => setTimeout(r, 0))

    const sent = rpc.mock.calls.map((c) => c[1] as Record<string, unknown>)
    expect(sent.map((a) => a.p_message)).toEqual(["click handler blew up", "nobody awaited this"])
    expect(sent.map((a) => a.p_context)).toEqual(["window.onerror", "unhandledrejection"])
  })

  it("falls back to the message when the browser gives no error object", async () => {
    on()
    const { installGlobalErrorHandlers } = await load()
    const win = window as unknown as { addEventListener: ReturnType<typeof vi.fn> }
    installGlobalErrorHandlers()
    const onError = win.addEventListener.mock.calls.find((c) => c[0] === "error")![1] as (e: unknown) => void
    onError({ error: null, message: "Uncaught SyntaxError: Unexpected token" })
    await new Promise((r) => setTimeout(r, 0))
    expect((rpc.mock.calls[0] as unknown[])[1]).toMatchObject({
      p_message: "Uncaught SyntaxError: Unexpected token",
    })
  })
})
