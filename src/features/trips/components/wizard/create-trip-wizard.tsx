"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { addDays } from "@/lib/trips/trip-domain"
import { Button } from "@/components/ui/button"
import { describeRemaining, type AiQuotaHint } from "@/lib/ai/usage-limits"
import { createTripAction } from "@/features/trips/actions/trip.actions"
import {
  createTripSchema,
  WIZARD_STEPS,
  type CreateTripInput,
} from "@/features/trips/schemas/trip.schemas"
import { useWizardDraft } from "@/features/trips/hooks/use-wizard-draft"
import { wizardStartValues, type TripPreset } from "@/lib/trips/trip-presets"
import { WizardProgress } from "@/features/trips/components/wizard/wizard-progress"
import {
  BudgetStep,
  DatesStep,
  DestinationStep,
  PreferencesStep,
} from "@/features/trips/components/wizard/wizard-steps"

const DRAFT_KEY = "voyagr:trip-wizard-draft"

function defaultValues(): CreateTripInput {
  const start = addDays(new Date().toISOString().slice(0, 10), 14)
  return {
    destination: "",
    startingCity: "",
    startDate: start,
    endDate: addDays(start, 4),
    travelers: 2,
    budget: null,
    currency: "USD",
    travelStyle: "balanced",
    interests: [],
    accommodation: "hotel",
    transportation: "public",
    notes: "",
  }
}

/**
 * The trip creation wizard.
 *
 * One form instance spans all four steps rather than a form per step, so the
 * user's answers survive navigating backwards and the final submit validates
 * the whole object at once. Stepping forward validates only the current step's
 * fields (see `WIZARD_STEPS[].fields`), which keeps a user from being blocked
 * by an error on a step they haven't seen yet.
 */
export function CreateTripWizard({
  quotaHint = null,
  preset = null,
}: {
  /** "N trips left today", worked out by the page; null shows no caption. */
  quotaHint?: AiQuotaHint | null
  /** A starter chosen on the dashboard (`?preset=`); replaces any saved draft. */
  preset?: TripPreset["values"] | null
}) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Destructured because the hook returns a fresh object each render — using
  // `draft` itself as an effect dependency would resubscribe the watcher on
  // every keystroke, since saving sets state and triggers another render.
  const {
    status: draftStatus,
    restored,
    isRestoring,
    save: saveDraft,
    clear: clearDraft,
  } = useWizardDraft<Partial<CreateTripInput>>(DRAFT_KEY)

  const form = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: defaultValues(),
    mode: "onTouched",
  })
  const { control, formState, handleSubmit, reset, trigger, watch } = form

  // Restoring has to wait for the effect in useWizardDraft, so it happens here
  // rather than through `defaultValues` — see that hook for why. A preset wins
  // over a saved draft (see `wizardStartValues`): it's saved straight away so
  // it replaces the draft, and `?preset=` is dropped from the URL so a reload
  // keeps the traveller's later edits instead of re-applying the preset.
  useEffect(() => {
    if (isRestoring) return
    const start = wizardStartValues<CreateTripInput>(defaultValues(), restored, preset)
    if (start.source === "defaults") return
    reset(start.values, { keepDefaultValues: true })
    if (start.source === "preset") {
      saveDraft(start.values)
      router.replace("/trips/new", { scroll: false })
    }
    // `preset` comes from the URL once per visit; re-running on its identity
    // would re-apply it over the traveller's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, restored, reset])

  useEffect(() => {
    const subscription = watch((values) => saveDraft(values))
    return () => subscription.unsubscribe()
  }, [watch, saveDraft])

  const step = WIZARD_STEPS[stepIndex]
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1

  async function goNext() {
    if (!step) return
    const valid = await trigger([...step.fields], { shouldFocus: true })
    if (!valid) return
    setDirection(1)
    setStepIndex((index) => Math.min(index + 1, WIZARD_STEPS.length - 1))
  }

  function goBack() {
    setDirection(-1)
    setSubmitError(null)
    setStepIndex((index) => Math.max(index - 1, 0))
  }

  const onSubmit = handleSubmit((values) => {
    setSubmitError(null)
    startTransition(async () => {
      const result = await createTripAction(values)
      if (!result.ok) {
        setSubmitError(result.error)
        // Re-read the "N left" caption: a refusal means it was out of date.
        // Client state (the form, the step) survives a refresh. On success the
        // push below lands on a freshly rendered /trips/new next visit.
        router.refresh()
        return
      }
      clearDraft()
      router.push(`/trips/${result.tripId}`)
    })
  })

  // Slide direction is the only thing that changes between steps, so the
  // variants take it as a custom param rather than duplicating the object.
  const slide = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, x: direction * 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -24 },
      }

  return (
    // No Card. A form that *is* the page does not need a box drawn around it,
    // and "generic centered shadcn card" is precisely the composition this
    // stage exists to remove. Structure comes from a rule under the progress
    // header and another above the navigation — borders dividing, not
    // enclosing.
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <div className="mt-8 border-t border-border pt-8">
        <div className="space-y-1.5">
          <h2 className="text-destination text-foreground">{step?.title}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {step?.description}
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-7">
            {/* `mode="wait"` so the outgoing step finishes before the next
                arrives — overlapping them makes the card height jump. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step?.id}
                initial={slide.initial}
                animate={slide.animate}
                exit={slide.exit}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {stepIndex === 0 ? (
                  <DestinationStep control={control} errors={formState.errors} />
                ) : null}
                {stepIndex === 1 ? (
                  <DatesStep control={control} errors={formState.errors} />
                ) : null}
                {stepIndex === 2 ? (
                  <BudgetStep control={control} errors={formState.errors} />
                ) : null}
                {stepIndex === 3 ? (
                  <PreferencesStep control={control} errors={formState.errors} />
                ) : null}
              </motion.div>
            </AnimatePresence>

            {submitError ? (
              <p
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {submitError}
              </p>
            ) : null}

            {/* Back and Next sit at opposite edges so both fall under a
                thumb on a phone, and the draft note moves out of that row
                entirely rather than competing for width between them. */}
            <div className="mt-8 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={stepIndex === 0 || isPending}
                >
                  <ArrowLeft aria-hidden="true" />
                  Back
                </Button>

                {/* The keys matter. Without them React reuses one <button> for
                    both branches and flips its `type` to "submit" during the
                    very click that pressed Next on step 3 — and the browser,
                    reading the type afterwards, submits the form: a trip was
                    generated (spending quota) before step 4 was ever shown. */}
                {isLastStep ? (
                  <Button key="submit" type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2
                          aria-hidden="true"
                          className="animate-spin motion-reduce:animate-none"
                        />
                        Building your trip…
                      </>
                    ) : (
                      <>
                        <Sparkles aria-hidden="true" />
                        Create itinerary
                      </>
                    )}
                  </Button>
                ) : (
                  <Button key="next" type="button" onClick={goNext}>
                    Next
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-3">
                <p
                  aria-live="polite"
                  className={cn(
                    "text-caption text-muted-foreground transition-opacity",
                    draftStatus === "saved" ? "opacity-100" : "opacity-0"
                  )}
                >
                  Draft saved
                </p>
                {/* Under the submit button, on the step that has one. A hint
                    only (the server enforces the limit); absent when the
                    server couldn't work it out or nothing is limited. */}
                {isLastStep && quotaHint ? (
                  <p className="ml-auto text-right text-caption text-muted-foreground">
                    {describeRemaining("trip_generation", quotaHint)}
                  </p>
                ) : null}
              </div>
            </div>
        </form>
      </div>

      {restored && stepIndex === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check aria-hidden="true" className="size-3.5" />
          We restored your unfinished trip.
        </p>
      ) : null}
    </div>
  )
}
