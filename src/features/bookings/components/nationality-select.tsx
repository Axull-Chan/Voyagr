"use client"

import { useEffect, useMemo } from "react"

import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { countryOptions } from "@/lib/bookings/countries"

const STORAGE_KEY = "voyagr:guest-nationality"

/**
 * The lead guest's nationality, which hotel rates and taxes depend on. The last
 * choice is remembered on this device only (localStorage; never sent anywhere
 * but the rate search).
 */
export function NationalitySelect({
  id,
  value,
  onChange,
  error,
}: {
  id: string
  value: string
  onChange: (code: string) => void
  error?: string | null
}) {
  const options = useMemo(() => countryOptions(), [])

  useEffect(() => {
    if (value) return
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved && /^[A-Z]{2}$/.test(saved)) onChange(saved)
    } catch {
      // Storage blocked: the traveller just picks again.
    }
    // Only on mount: restoring later would overwrite a deliberate change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choose(code: string) {
    onChange(code)
    try {
      window.localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }

  const describedBy = error ? `${id}-error` : `${id}-hint`
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Guest nationality</Label>
      <Select
        id={id}
        value={value}
        onChange={(e) => choose(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required
      >
        <option value="" disabled>
          Choose a country
        </option>
        {options.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </Select>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          Hotels price some rates by the guest&apos;s nationality.
        </p>
      )}
    </div>
  )
}
