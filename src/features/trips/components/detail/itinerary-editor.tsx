"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { WizardField } from "@/features/trips/components/wizard/wizard-field"
import {
  addActivityAction,
  deleteActivityAction,
  moveActivityAction,
  updateActivityAction,
} from "@/features/trips/actions/itinerary.actions"
import {
  activityFieldsSchema,
  type ActivityFields,
} from "@/features/trips/schemas/itinerary.schemas"
import { useDialogTriggerOrigin } from "@/hooks/use-dialog-trigger-origin"
import { useIsMobile } from "@/hooks/use-mobile"
import { TIME_SLOTS } from "@/lib/trips/trip-domain"

/**
 * Hand-editing a trip's itinerary: add, change, remove and reorder activities.
 *
 * One provider holds a single add/edit dialog and a single "remove?" confirmation for
 * the whole day-by-day list, and the small components below (`AddActivityButton`,
 * `ActivityControls`) open them. The timeline itself stays a server component — it
 * only drops these leaves in — so none of its rendering moves to the browser.
 *
 * Every change goes through a server action that re-checks the trip and the activity
 * on the server; hiding these controls (see `editable`) is a courtesy, never the
 * access control.
 */

/** The activity fields the editor needs; a plain subset of the database row. */
export interface EditableActivity {
  id: string
  title: string
  time_slot: string | null
  start_time: string | null
  duration_minutes: number | null
  estimated_cost: number | null
  location_name: string | null
  description: string | null
}

type Target =
  | { mode: "add"; dayId: string; dayNumber: number }
  | { mode: "edit"; activity: EditableActivity; dayNumber: number }

interface EditorContextValue {
  editable: boolean
  isPending: boolean
  openAdd: (event: React.SyntheticEvent<Element>, dayId: string, dayNumber: number) => void
  openEdit: (
    event: React.SyntheticEvent<Element>,
    activity: EditableActivity,
    dayNumber: number
  ) => void
  askRemove: (activity: EditableActivity, dayNumber: number) => void
  move: (activityId: string, direction: "up" | "down") => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

interface FormState {
  title: string
  timeSlot: string
  startTime: string
  duration: string
  cost: string
  locationName: string
  description: string
}

const EMPTY_FORM: FormState = {
  title: "",
  timeSlot: "morning",
  startTime: "",
  duration: "",
  cost: "",
  locationName: "",
  description: "",
}

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
}

function formFrom(activity: EditableActivity): FormState {
  return {
    title: activity.title,
    // An activity with no usable slot is edited as the first one, so saving the
    // form always files it under a time of day the timeline can show.
    timeSlot: TIME_SLOTS.includes(activity.time_slot as (typeof TIME_SLOTS)[number])
      ? (activity.time_slot as string)
      : "morning",
    // Postgres `time` arrives as HH:MM:SS; the input wants HH:MM.
    startTime: activity.start_time ? activity.start_time.slice(0, 5) : "",
    duration: activity.duration_minutes ? String(activity.duration_minutes) : "",
    cost:
      activity.estimated_cost === null ? "" : String(Number(activity.estimated_cost)),
    locationName: activity.location_name ?? "",
    description: activity.description ?? "",
  }
}

/** A blank number or time box is `null`, not 0 or "", which the schema would reject. */
function fieldsFrom(form: FormState): unknown {
  return {
    title: form.title,
    timeSlot: form.timeSlot,
    startTime: form.startTime === "" ? null : form.startTime,
    durationMinutes: form.duration.trim() === "" ? null : Number(form.duration),
    estimatedCost: form.cost.trim() === "" ? null : Number(form.cost),
    locationName: form.locationName,
    description: form.description,
  }
}

export function ItineraryEditorProvider({
  tripId,
  currency,
  editable,
  children,
}: {
  tripId: string
  currency: string
  /** False while the trip is generating or archived; the controls simply don't render. */
  editable: boolean
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const { origin, captureOrigin } = useDialogTriggerOrigin()
  const [isPending, startTransition] = useTransition()

  const [target, setTarget] = useState<Target | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const [removing, setRemoving] = useState<{
    activity: EditableActivity
    dayNumber: number
  } | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const cancelRemoveRef = useRef<HTMLButtonElement>(null)

  const openAdd = useCallback(
    (event: React.SyntheticEvent<Element>, dayId: string, dayNumber: number) => {
      captureOrigin(event)
      setForm(EMPTY_FORM)
      setFormError(null)
      setTarget({ mode: "add", dayId, dayNumber })
    },
    [captureOrigin]
  )

  const openEdit = useCallback(
    (event: React.SyntheticEvent<Element>, activity: EditableActivity, dayNumber: number) => {
      captureOrigin(event)
      setForm(formFrom(activity))
      setFormError(null)
      setTarget({ mode: "edit", activity, dayNumber })
    },
    [captureOrigin]
  )

  const askRemove = useCallback((activity: EditableActivity, dayNumber: number) => {
    setRemoveError(null)
    setRemoving({ activity, dayNumber })
  }, [])

  const move = useCallback(
    (activityId: string, direction: "up" | "down") => {
      startTransition(async () => {
        const result = await moveActivityAction({ tripId, activityId, direction })
        if (!result.ok) toast.error(result.error)
      })
    },
    [tripId]
  )

  function closeForm() {
    setTarget(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!target) return

    // The same schema the server uses, so a mistake is explained here without a
    // round trip. The server still validates — this is not the only check.
    const parsed = activityFieldsSchema.safeParse(fieldsFrom(form))
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Please check the activity details.")
      return
    }
    const fields: ActivityFields = parsed.data
    setFormError(null)

    startTransition(async () => {
      const result =
        target.mode === "edit"
          ? await updateActivityAction({ tripId, activityId: target.activity.id, ...fields })
          : await addActivityAction({ tripId, dayId: target.dayId, ...fields })

      if (!result.ok) {
        setFormError(result.error)
        return
      }
      toast.success(target.mode === "edit" ? "Activity updated." : "Activity added.")
      closeForm()
    })
  }

  function confirmRemove() {
    if (!removing) return
    setRemoveError(null)
    startTransition(async () => {
      const result = await deleteActivityAction({
        tripId,
        activityId: removing.activity.id,
      })
      if (!result.ok) {
        setRemoveError(result.error)
        return
      }
      toast.success("Activity removed.")
      setRemoving(null)
    })
  }

  const value = useMemo<EditorContextValue>(
    () => ({ editable, isPending, openAdd, openEdit, askRemove, move }),
    [editable, isPending, openAdd, openEdit, askRemove, move]
  )

  const title =
    target?.mode === "edit"
      ? "Edit activity"
      : target
        ? `Add to Day ${target.dayNumber}`
        : ""
  const description =
    target?.mode === "edit"
      ? `Day ${target.dayNumber}`
      : "Plan it yourself — nothing here is generated."

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const activityForm = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <WizardField label="What's the plan?">
        {({ controlId, describedBy }) => (
          <Input
            id={controlId}
            aria-describedby={describedBy}
            value={form.title}
            onChange={set("title")}
            maxLength={120}
            placeholder="Walk the old town"
            autoComplete="off"
            required
          />
        )}
      </WizardField>

      <div className="grid grid-cols-2 gap-3">
        <WizardField label="Time of day">
          {({ controlId }) => (
            <Select id={controlId} value={form.timeSlot} onChange={set("timeSlot")}>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {SLOT_LABEL[slot]}
                </option>
              ))}
            </Select>
          )}
        </WizardField>
        <WizardField label="Starts at" hint="Optional">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              type="time"
              value={form.startTime}
              onChange={set("startTime")}
            />
          )}
        </WizardField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <WizardField label="Minutes" hint="Optional">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              type="number"
              inputMode="numeric"
              min={5}
              max={1440}
              step={5}
              value={form.duration}
              onChange={set("duration")}
            />
          )}
        </WizardField>
        <WizardField label={`Cost (${currency})`} hint="Optional">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.cost}
              onChange={set("cost")}
            />
          )}
        </WizardField>
      </div>

      <WizardField label="Where" hint="Optional — a name only; it isn't placed on the map">
        {({ controlId, describedBy }) => (
          <Input
            id={controlId}
            aria-describedby={describedBy}
            value={form.locationName}
            onChange={set("locationName")}
            maxLength={120}
            autoComplete="off"
          />
        )}
      </WizardField>

      <WizardField label="Notes" hint="Optional">
        {({ controlId, describedBy }) => (
          <Textarea
            id={controlId}
            aria-describedby={describedBy}
            value={form.description}
            onChange={set("description")}
            maxLength={500}
            rows={3}
          />
        )}
      </WizardField>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : target?.mode === "edit" ? "Save changes" : "Add activity"}
        </Button>
      </div>
    </form>
  )

  return (
    <EditorContext.Provider value={value}>
      {children}

      {isMobile ? (
        <Sheet
          open={target !== null}
          onOpenChange={(open) => {
            if (!open && !isPending) closeForm()
          }}
        >
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="max-h-[75dvh] overflow-y-auto px-4 pb-4">{activityForm}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={target !== null}
          onOpenChange={(open) => {
            if (!open && !isPending) closeForm()
          }}
        >
          <DialogContent origin={origin}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {activityForm}
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setRemoving(null)
        }}
      >
        <DialogContent initialFocus={cancelRemoveRef} showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>Remove this activity?</DialogTitle>
            <DialogDescription className="break-words">
              {removing
                ? `“${removing.activity.title}” will be removed from Day ${removing.dayNumber}. This can’t be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {removeError ? (
            <p role="alert" className="text-sm text-destructive">
              {removeError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              ref={cancelRemoveRef}
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setRemoving(null)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmRemove}
            >
              {isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorContext.Provider>
  )
}

/** Opens the add dialog for one day. Renders nothing when the itinerary can't be edited. */
export function AddActivityButton({
  dayId,
  dayNumber,
  className,
}: {
  dayId: string
  dayNumber: number
  className?: string
}) {
  const editor = useContext(EditorContext)
  if (!editor?.editable) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      disabled={editor.isPending}
      onClick={(event) => editor.openAdd(event, dayId, dayNumber)}
    >
      <Plus aria-hidden="true" />
      Add activity
    </Button>
  )
}

/**
 * Move earlier / later, edit and remove for one activity. Always visible (touch
 * devices have no hover) but quiet: muted icons, no boxes. Renders nothing when the
 * itinerary can't be edited.
 */
export function ActivityControls({
  activity,
  dayNumber,
  canMoveUp,
  canMoveDown,
}: {
  activity: EditableActivity
  dayNumber: number
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const editor = useContext(EditorContext)
  if (!editor?.editable) return null
  const { isPending } = editor
  const name = activity.title

  return (
    <div className="-ml-2 mt-1.5 flex items-center text-muted-foreground">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Move “${name}” earlier`}
        disabled={!canMoveUp || isPending}
        onClick={() => editor.move(activity.id, "up")}
      >
        <ArrowUp aria-hidden="true" className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Move “${name}” later`}
        disabled={!canMoveDown || isPending}
        onClick={() => editor.move(activity.id, "down")}
      >
        <ArrowDown aria-hidden="true" className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Edit “${name}”`}
        disabled={isPending}
        onClick={(event) => editor.openEdit(event, activity, dayNumber)}
      >
        <Pencil aria-hidden="true" className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Remove “${name}”`}
        disabled={isPending}
        onClick={() => editor.askRemove(activity, dayNumber)}
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
      </Button>
    </div>
  )
}
