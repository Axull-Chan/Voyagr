import { describe, expect, it } from "vitest"

import {
  ReportGate,
  classifyClientSeverity,
  isControlFlowError,
  isReportingEnabled,
  releaseId,
  serialiseError,
  settleWithin,
  shouldIgnoreClientError,
  toRpcArgs,
  type ErrorReport,
} from "@/lib/monitoring/error-model"

describe("serialiseError", () => {
  it("reads an ordinary Error", () => {
    const e = new TypeError("boom")
    const s = serialiseError(e)
    expect(s.name).toBe("TypeError")
    expect(s.message).toBe("boom")
    expect(s.stack).toContain("TypeError: boom")
    expect(s.digest).toBeNull()
  })

  it("folds an error's cause into the message, because the wrapper alone hides the real problem", () => {
    const inner = new Error("gemini timed out after 60000ms")
    const outer = new Error("We couldn't reach Gemini", { cause: inner })
    expect(serialiseError(outer).message).toBe(
      "We couldn't reach Gemini (caused by Error: gemini timed out after 60000ms)"
    )
    expect(serialiseError(new Error("x", { cause: "just text" })).message).toBe(
      "x (caused by just text)"
    )
    expect(serialiseError(new Error("x", { cause: { code: 7 } })).message).toBe(
      'x (caused by {"code":7})'
    )
  })

  it("carries Next's digest, which ties a generic error page to the server log", () => {
    const e = Object.assign(new Error("render failed"), { digest: "1234567890" })
    expect(serialiseError(e).digest).toBe("1234567890")
  })

  it("handles everything JavaScript lets code throw, never assuming an Error", () => {
    expect(serialiseError("a plain string")).toMatchObject({
      name: "NonError",
      message: "a plain string",
    })
    // The shape a database client returns: a plain object, not an Error.
    expect(serialiseError({ message: "relation does not exist", code: "42P01" })).toMatchObject({
      name: "NonError",
      message: "relation does not exist",
    })
    expect(serialiseError({ code: 7 }).message).toBe('{"code":7}')
    expect(serialiseError(undefined).message).toBe("undefined")
    expect(serialiseError(null).message).toBe("null")
    expect(serialiseError(42).message).toBe("42")
    expect(serialiseError("").message).toBe("(no message)")
    expect(serialiseError(new Error("")).message).toBe("(no message)")
  })

  it("survives an object that cannot be turned into JSON", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(serialiseError(circular).message).toBe("[unserialisable value]")
  })

  it("clips a pathological error before it leaves the process", () => {
    const s = serialiseError(new Error("x".repeat(100_000)))
    expect(s.message.length).toBeLessThanOrEqual(500)
    expect((s.stack ?? "").length).toBeLessThanOrEqual(4000)
  })
})

describe("isControlFlowError", () => {
  it("recognises the errors Next throws on purpose", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" })
    const notFound = Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" })
    const http = Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" })
    const dynamic = Object.assign(new Error("x"), { digest: "DYNAMIC_SERVER_USAGE" })
    for (const e of [redirect, notFound, http, dynamic]) expect(isControlFlowError(e)).toBe(true)
    expect(isControlFlowError(new Error("NEXT_REDIRECT"))).toBe(true)
  })

  it("does not swallow real errors that merely mention them", () => {
    expect(isControlFlowError(new Error("failed to NEXT_REDIRECT the user"))).toBe(false)
    expect(isControlFlowError(new Error("boom"))).toBe(false)
    expect(isControlFlowError(Object.assign(new Error("x"), { digest: "123456" }))).toBe(false)
    expect(isControlFlowError(null)).toBe(false)
    expect(isControlFlowError("some string")).toBe(false)
  })
})

describe("shouldIgnoreClientError", () => {
  const e = (over: Partial<{ name: string; message: string; stack: string | null }>) => ({
    name: "Error",
    message: "x",
    stack: null,
    ...over,
  })

  it.each([
    ["a ResizeObserver complaint", e({ message: "ResizeObserver loop completed with undelivered notifications." })],
    ["an opaque cross-origin error", e({ message: "Script error." })],
    ["an aborted request", e({ name: "AbortError", message: "The user aborted a request." })],
    ["a non-Error rejection wrapper", e({ message: "Non-Error promise rejection captured with value: 5" })],
    ["a Chrome extension frame", e({ message: "boom", stack: "at x (chrome-extension://abc/inject.js:1:1)" })],
    ["a Firefox extension frame", e({ message: "boom", stack: "at x (moz-extension://abc/inject.js:1:1)" })],
  ])("drops %s", (_label, err) => {
    expect(shouldIgnoreClientError(err)).toBe(true)
  })

  it("keeps errors from our own code", () => {
    expect(shouldIgnoreClientError(e({ message: "Cannot read properties of undefined", stack: "at TripMap (https://voyagr.app/_next/static/chunks/x.js:1:1)" }))).toBe(false)
    expect(shouldIgnoreClientError(e({ message: "Script error in our handler" }))).toBe(false)
  })
})

describe("classifyClientSeverity", () => {
  it("treats a dropped connection as a warning and everything else as an error", () => {
    for (const m of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "Network request failed"]) {
      expect(classifyClientSeverity(m)).toBe("warning")
    }
    expect(classifyClientSeverity("Cannot read properties of undefined")).toBe("error")
  })
})

describe("ReportGate", () => {
  it("lets each distinct problem through once", () => {
    const gate = new ReportGate(10)
    expect(gate.allow("a")).toBe(true)
    expect(gate.allow("a")).toBe(false)
    expect(gate.allow("b")).toBe(true)
  })

  it("stops after the cap, so a render loop cannot become a flood of requests", () => {
    const gate = new ReportGate(3)
    const results = ["a", "b", "c", "d", "e"].map((k) => gate.allow(k))
    expect(results).toEqual([true, true, true, false, false])
    // And a problem that was let through stays suppressed after the cap.
    expect(gate.allow("a")).toBe(false)
  })
})

describe("plumbing", () => {
  it("is off unless explicitly on", () => {
    expect(isReportingEnabled("on")).toBe(true)
    for (const v of [undefined, "", "off", "true", "1", "ON", "yes"]) {
      expect(isReportingEnabled(v)).toBe(false)
    }
  })

  it("shortens a commit id", () => {
    expect(releaseId("86fc1967ce95f0ad670484c1c03dace7b2455e81")).toBe("86fc196")
    expect(releaseId(undefined)).toBeNull()
    expect(releaseId("")).toBeNull()
  })

  it("sends EVERY argument, as an explicit null when empty", () => {
    // Regression guard. report_error declares no defaults, and PostgREST finds a
    // function by the names of the arguments sent. `undefined` is dropped when the
    // body becomes JSON, so a missing argument makes it look for a function that
    // does not exist and the report fails with a 404 instead of being recorded.
    const sparse: ErrorReport = {
      source: "server", severity: "error", context: "route", name: "Error",
      message: "m", stack: null, route: null, digest: null, release: null, userAgent: null,
    }
    const args = toRpcArgs(sparse)
    const json = JSON.parse(JSON.stringify(args))
    expect(Object.keys(json).sort()).toEqual([
      "p_context", "p_digest", "p_message", "p_name", "p_release", "p_route",
      "p_severity", "p_source", "p_stack", "p_user_agent",
    ])
    expect(json.p_stack).toBeNull()
    expect(json.p_route).toBeNull()
    expect(Object.values(args)).not.toContain(undefined)
  })
})

describe("settleWithin", () => {
  it("returns as soon as the work finishes", async () => {
    const started = Date.now()
    await settleWithin(Promise.resolve("done"), 5000)
    expect(Date.now() - started).toBeLessThan(500)
  })

  it("gives up on work that hangs, instead of holding up the request", async () => {
    const started = Date.now()
    await settleWithin(new Promise(() => {}), 50)
    const waited = Date.now() - started
    expect(waited).toBeGreaterThanOrEqual(40)
    expect(waited).toBeLessThan(1000)
  })

  it("never rejects, whatever the work does", async () => {
    await expect(settleWithin(Promise.reject(new Error("boom")), 100)).resolves.toBeUndefined()
  })
})
