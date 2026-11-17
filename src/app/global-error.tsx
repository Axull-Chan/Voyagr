"use client"

import { useEffect } from "react"

import { reportClientError } from "@/lib/monitoring/report-client"

/**
 * The last line of defence: an error in the ROOT LAYOUT itself, which `error.tsx`
 * cannot catch because it sits inside that layout. When this renders, the layout —
 * and with it the app's fonts, theme and stylesheet — is gone, so it must supply
 * its own <html> and <body> and cannot rely on any class name. Hence inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    void reportClientError(error, { context: "global-error" })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1e2019",
          background: "#f8f6f4",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Something went wrong</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#5b6058" }}>
          An unexpected error occurred. You can try again.
        </p>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#5b6058" }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            padding: "0.6rem 1.1rem",
            fontSize: "0.875rem",
            color: "#fff",
            background: "#244f54",
            border: 0,
            borderRadius: "2px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
