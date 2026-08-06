"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type DraftStatus = "idle" | "saving" | "saved"

const DEBOUNCE_MS = 600

/**
 * Auto-saves wizard progress so a refresh, a closed tab, or a mistaken back
 * navigation doesn't cost the user everything they typed.
 *
 * Storage is deliberately behind this hook rather than called inline from the
 * wizard: moving drafts server-side later (a `status='draft'` trip row synced
 * on an interval) means reimplementing `read`/`write`/`clear` here and nothing
 * in the UI changes.
 *
 * Restore happens in an effect rather than in `useState`'s initialiser because
 * localStorage doesn't exist during SSR — reading it lazily would make the
 * server and client render different markup and trip hydration.
 */
export function useWizardDraft<T>(storageKey: string) {
  const [status, setStatus] = useState<DraftStatus>("idle")
  const [restored, setRestored] = useState<T | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) setRestored(JSON.parse(raw) as T)
    } catch {
      // A corrupt or unreadable draft is not worth failing the page over —
      // the user simply starts from a blank wizard.
    } finally {
      setIsRestoring(false)
    }
  }, [storageKey])

  useEffect(() => {
    const timer = timerRef.current
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  const save = useCallback(
    (value: T) => {
      setStatus("saving")
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(value))
          setStatus("saved")
        } catch {
          // Private browsing and full quotas both land here. The wizard still
          // works; it just can't offer recovery, so say nothing rather than
          // claim a save that didn't happen.
          setStatus("idle")
        }
      }, DEBOUNCE_MS)
    },
    [storageKey]
  )

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Nothing to recover from — the draft simply outlives the session.
    }
    setStatus("idle")
  }, [storageKey])

  return { status, restored, isRestoring, save, clear }
}
