"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
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
  duplicateTripAction,
  renameTripAction,
  setTripArchivedAction,
} from "@/features/trips/actions/trip-management.actions"

interface TripActionsMenuProps {
  tripId: string
  title: string
  status: string
}

/**
 * Rename, duplicate, archive/restore and export for one trip.
 *
 * Everything goes through server actions that enforce ownership themselves;
 * this component only decides what to offer and reports the outcome. Archive is
 * reversible and so asks for no confirmation — the menu flips to "Restore" and
 * the toast says what happened. A trip still being generated offers neither
 * archive nor duplicate, since both are refused server-side for the same reason
 * and a menu item that can only fail is worse than no item.
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

  const isArchived = status === "archived"
  const isGenerating = status === "generating"

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

  function exportTrip() {
    // The route answers with `Content-Disposition: attachment`, so this saves
    // a file rather than navigating away from the page.
    window.location.assign(`/trips/${tripId}/export`)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
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
    </>
  )
}
