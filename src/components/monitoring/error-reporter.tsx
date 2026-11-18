"use client"

import { useEffect } from "react"

import { installGlobalErrorHandlers } from "@/lib/monitoring/report-client"

/**
 * Mounted once in the root layout. Renders nothing; it only listens for the errors
 * React's error boundaries cannot see (event handlers, timers, unawaited promises).
 */
export function ErrorReporter() {
  useEffect(() => installGlobalErrorHandlers(), [])
  return null
}
