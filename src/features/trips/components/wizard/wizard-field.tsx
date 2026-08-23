"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

interface WizardFieldProps {
  label: string
  hint?: string
  error?: string
  /** Set for grouped controls (toggles), where there is no single input to point a <label> at. */
  asFieldset?: boolean
  className?: string
  children: (ids: { controlId: string; describedBy: string | undefined }) => React.ReactNode
}

/**
 * One labelled field: label, optional hint, control, and error.
 *
 * The control is a render prop so this component can hand down the generated
 * ids — that's what wires `aria-describedby` to the hint and error text, which
 * is the part hand-rolled forms usually miss. Groups of toggles render as a
 * `fieldset`/`legend` instead of a `label`, because a `<label>` may only point
 * at one control and would leave the rest of the group unnamed.
 */
export function WizardField({
  label,
  hint,
  error,
  asFieldset = false,
  className,
  children,
}: WizardFieldProps) {
  const id = useId()
  const controlId = `${id}-control`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  const heading = asFieldset ? (
    <legend className="flex items-center gap-2 text-sm leading-none font-medium">{label}</legend>
  ) : (
    <Label htmlFor={controlId}>{label}</Label>
  )

  const body = (
    <>
      <div className="space-y-1.5">
        {heading}
        {hint ? (
          <p id={hintId} className="text-caption text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>

      {children({ controlId, describedBy })}

      {error ? (
        // `role="alert"` so the message is announced when it appears rather
        // than only being found if the user happens to navigate back to it.
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </>
  )

  return asFieldset ? (
    <fieldset className={cn("space-y-2", className)}>{body}</fieldset>
  ) : (
    <div className={cn("space-y-2", className)}>{body}</div>
  )
}
