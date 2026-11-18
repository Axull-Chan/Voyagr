"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deleteTripAction,
  duplicateTripAction,
  renameTripAction,
  setTripArchivedAction,
} from "@/features/trips/actions/trip-management.actions"
import {
  deleteBlockedReason,
  tripDeletionCopy,
} from "@/features/trips/services/trip-delete"

interface TripActionsMenuProps {
  tripId: string
  title: string
  status: string
}

/**
 * Rename, duplicate, archive/restore, export and delete for one trip.
 *
 * Everything goes through server actions that enforce ownership themselves;
 * this component only decides what to offer and reports the outcome. Archive is
 * reversible and so asks for no confirmation — the menu flips to "Restore" and
 * the toast says what happened. A trip still being generated offers none of
 * archive, duplicate or delete, since all three are refused server-side for the
 * same reason and a menu item that can only fail is worse than no item.
 *
 * Delete is the one irreversible action, so it asks first. The dialog puts
 * initial focus on Cancel (an accidental Enter must not destroy a trip), locks
 * itself while the request is in flight, and stays open and disabled after
 * success until the redirect lands, so the button can't be pressed twice.
 */
export function TripActionsMenu({
  tripId,
  title,
  status,
}: TripActionsMenuProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [renameOpen, setRenameOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  const isArchived = status === "archived"
  const isGenerating = status === "generating"
  const deletion = tripDeletionCopy(title)

  function openRename() {
    // Start from the saved title each time, not from an abandoned edit.
    setDraftTitle(title)
    setRenameError(null)
    setRenameOpen(true)
  }

  function submitRename(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await renameTripAction({ tripId, title: draftTitle })
      if (!result.ok) {
        setRenameError(result.error)
        return
      }
      setRenameOpen(false)
      toast.success("Trip renamed.")
      router.refresh()
    })
  }

  function toggleArchive() {
    startTransition(async () => {
      const result = await setTripArchivedAction(tripId, !isArchived)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(isArchived ? "Trip restored." : "Trip archived.")
      router.refresh()
    })
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateTripAction(tripId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Trip duplicated.")
      router.push(`/trips/${result.tripId}`)
    })
  }

  function openDelete() {
    setDeleteError(null)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    // Same rule the server enforces, checked first so the message is immediate.
    const blocked = deleteBlockedReason(status)
    if (blocked) {
      setDeleteError(blocked)
      return
    }
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteTripAction(tripId)
      if (!result.ok) {
        setDeleteError(result.error)
        return
      }
      // Stay disabled until navigation unmounts this; `isPending` alone drops
      // back to false the moment the action resolves.
      setDeleted(true)
      toast.success("Trip deleted.")
      router.replace("/trips")
    })
  }

  function exportTrip() {
    // The route answers with `Content-Disposition: attachment`, so this saves
    // a file rather than navigating away from the page.
    window.location.assign(`/trips/${tripId}/export`)
  }

  function downloadPdf() {
    // Same mechanism as the JSON export; the PDF is built on request.
    window.location.assign(`/trips/${tripId}/export/pdf`)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          aria-label="Trip actions"
          disabled={isPending}
          className="inline-flex size-9 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:size-11"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={openRename}>
            <Pencil aria-hidden="true" /> Rename
          </DropdownMenuItem>
          {isGenerating ? null : (
            <DropdownMenuItem onClick={duplicate}>
              <Copy aria-hidden="true" /> Duplicate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={downloadPdf}>
            <FileText aria-hidden="true" /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportTrip}>
            <Download aria-hidden="true" /> Export as JSON
          </DropdownMenuItem>
          {isGenerating ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleArchive}>
                {isArchived ? (
                  <>
                    <ArchiveRestore aria-hidden="true" /> Restore
                  </>
                ) : (
                  <>
                    <Archive aria-hidden="true" /> Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={openDelete}>
                <Trash2 aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={submitRename} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Rename trip</DialogTitle>
              <DialogDescription>
                This only changes the name you see — nothing else about the trip.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="rename-trip-title">Trip name</Label>
              <Input
                id="rename-trip-title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                maxLength={120}
                autoComplete="off"
                autoFocus
                aria-invalid={renameError ? true : undefined}
                aria-describedby={
                  renameError ? "rename-trip-error" : undefined
                }
              />
              {renameError ? (
                <p
                  id="rename-trip-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {renameError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          // No dismissing (Esc, overlay, X) while the request is in flight or
          // once it has succeeded: the outcome is already decided.
          if (!open && (isPending || deleted)) return
          setDeleteOpen(open)
        }}
      >
        <DialogContent
          initialFocus={cancelDeleteRef}
          finalFocus={triggerRef}
          showCloseButton={!isPending && !deleted}
        >
          <DialogHeader>
            <DialogTitle>{deletion.title}</DialogTitle>
            <DialogDescription className="break-words">
              {deletion.description}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deletion.reassurance}
          </p>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              ref={cancelDeleteRef}
              type="button"
              variant="outline"
              disabled={isPending || deleted}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || deleted}
              onClick={confirmDelete}
            >
              {isPending || deleted
                ? deletion.pendingLabel
                : deletion.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
