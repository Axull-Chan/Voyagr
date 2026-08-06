"use client"

import { useRef } from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface Option<T extends string> {
  value: T
  label: string
  hint?: string
}

interface SingleProps<T extends string> {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  describedBy?: string
  multiple?: false
}

interface MultipleProps<T extends string> {
  options: readonly Option<T>[]
  value: readonly T[]
  onChange: (value: T[]) => void
  describedBy?: string
  multiple: true
}

type OptionToggleGroupProps<T extends string> = SingleProps<T> | MultipleProps<T>

/**
 * Selectable options as buttons rather than native radio/checkbox inputs.
 *
 * These carry a label plus a hint line and need a card-like hit area, which a
 * styled `<input type="radio">` fights against.
 *
 * Taking the presentation freedom means owing the keyboard contract that
 * `role="radio"` promises, which is *not* what plain buttons do by default: a
 * native radio group is a single tab stop that you move within using the arrow
 * keys, whereas buttons are each their own tab stop and ignore arrows.
 * Announcing "radio" without that behaviour is worse than not announcing it,
 * so the single-select variant implements roving tabindex plus arrow/Home/End
 * handling here. Checkbox groups are left alone — each checkbox being its own
 * tab stop is the correct native behaviour there.
 *
 * Buttons are `type="button"` on purpose: inside a form an unspecified type
 * defaults to `submit`, and picking "Relaxed" would submit the wizard.
 */
export function OptionToggleGroup<T extends string>(
  props: OptionToggleGroupProps<T>
) {
  const { options, describedBy } = props
  const isMultiple = props.multiple === true
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  function isSelected(option: T) {
    return isMultiple
      ? (props as MultipleProps<T>).value.includes(option)
      : (props as SingleProps<T>).value === option
  }

  function handleSelect(option: T) {
    if (isMultiple) {
      const current = (props as MultipleProps<T>).value
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option]
      ;(props as MultipleProps<T>).onChange(next)
      return
    }
    ;(props as SingleProps<T>).onChange(option)
  }

  /** Arrow keys both move focus and select, which is what native radios do. */
  function moveTo(index: number) {
    const wrapped = (index + options.length) % options.length
    const option = options[wrapped]
    if (!option) return
    buttonsRef.current[wrapped]?.focus()
    handleSelect(option.value)
  }

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (isMultiple) return
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault()
        moveTo(index + 1)
        break
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault()
        moveTo(index - 1)
        break
      case "Home":
        event.preventDefault()
        moveTo(0)
        break
      case "End":
        event.preventDefault()
        moveTo(options.length - 1)
        break
    }
  }

  // The group keeps one tab stop: whichever option is selected, or the first
  // when nothing is yet.
  const selectedIndex = options.findIndex((option) => isSelected(option.value))
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0

  return (
    <div
      role={isMultiple ? "group" : "radiogroup"}
      aria-describedby={describedBy}
      className="grid gap-2 sm:grid-cols-2"
    >
      {options.map((option, index) => {
        const selected = isSelected(option.value)
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonsRef.current[index] = node
            }}
            type="button"
            role={isMultiple ? "checkbox" : "radio"}
            aria-checked={selected}
            tabIndex={isMultiple ? undefined : index === tabbableIndex ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected
                ? "border-primary bg-primary/5"
                : "border-input hover:border-foreground/25 hover:bg-muted/50"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input"
              )}
            >
              {selected ? <Check className="size-2.5" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {option.label}
              </span>
              {option.hint ? (
                <span className="block text-xs text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
