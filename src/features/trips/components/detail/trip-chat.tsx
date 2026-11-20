"use client"

import { useEffect, useState, useTransition } from "react"
import { MessageCircle, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ChatOperation } from "@/lib/ai"
import { describeRemaining, type AiQuotaHint } from "@/lib/ai/usage-limits"
import { describeOperation } from "@/features/trips/services/chat-operation-text"
import {
  REPLAN_PROPOSAL_EVENT,
  SUPERSEDED_NOTE,
  type ReplanProposalDetail,
} from "@/features/trips/components/detail/replan-events"
import {
  applyChatOperationsAction,
  sendChatMessageAction,
} from "@/features/trips/actions/chat.actions"
import type { TripChatMessageRow } from "@/features/trips/queries/trip-chat"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  operations: ChatOperation[] | null
  appliedAt: string | null
}

const EXAMPLE_PROMPTS = [
  "Add a museum on day 2 morning",
  "Remove the hike on day 3",
  "Move dinner to day 2 instead",
]

function toChatMessage(row: TripChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    operations: (row.proposed_operations as ChatOperation[] | null) ?? null,
    appliedAt: row.applied_at,
  }
}


/**
 * The trip assistant: a floating trigger + slide-over chat for proposing
 * itinerary edits (Phase 9). Mounted as a sibling to the page's main grid,
 * outside `Reveal`/`RevealItem` — it's persistent chrome, not scroll-
 * triggered content.
 *
 * `initialMessages` seeds state once on mount and is never resynced from
 * later prop changes: both server actions below return everything this
 * component needs directly, so its own re-render never depends on the
 * page's `revalidatePath` refresh (which would otherwise blow away an open
 * sheet or an unsent draft the moment the rest of the page updates).
 */
export function TripChat({
  tripId,
  currency,
  initialMessages,
  hasItinerary,
  initialQuota = null,
}: {
  tripId: string
  currency: string
  initialMessages: TripChatMessageRow[]
  hasItinerary: boolean
  /** "N messages left today" as of page load; null shows no caption. */
  initialQuota?: AiQuotaHint | null
}) {
  const [open, setOpen] = useState(false)
  // Seeded once, like `messages`; afterwards each send returns the fresh number,
  // so it stays right without leaning on the page refreshing. A hint only —
  // the server enforces the limit.
  const [quota, setQuota] = useState<AiQuotaHint | null>(initialQuota)
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages.map(toChatMessage))
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(() => new Set())

  // A replan button elsewhere on the page hands its proposal over here: retire
  // the day's previous pending replan, append the new one, and open the panel
  // so it can be reviewed and applied like any other proposal.
  useEffect(() => {
    function onProposal(event: Event) {
      const { proposal, supersededIds } = (event as CustomEvent<ReplanProposalDetail>).detail
      setMessages((prev) => [
        ...prev.map((m) =>
          supersededIds.includes(m.id) ? { ...m, operations: null, content: `${m.content}${SUPERSEDED_NOTE}` } : m
        ),
        { id: proposal.id, role: "assistant", content: proposal.content, operations: proposal.operations, appliedAt: null },
      ])
      setOpen(true)
    }
    window.addEventListener(REPLAN_PROPOSAL_EVENT, onProposal)
    return () => window.removeEventListener(REPLAN_PROPOSAL_EVENT, onProposal)
  }, [])
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()

  if (!hasItinerary) return null

  function handleSend(text: string) {
    const message = text.trim()
    if (!message) return
    setDraft("")
    const optimisticId = `pending-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: "user", content: message, operations: null, appliedAt: null },
    ])

    startTransition(async () => {
      const result = await sendChatMessageAction({ tripId, message })
      // Keep the caption in step, but only with a real number: a null here
      // means the lookup failed, and the previous figure is better than none.
      if (result.quota) setQuota(result.quota)
      if (!result.ok) {
        toast.error(result.error)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        return
      }
      setMessages((prev) => [
        ...prev.map((m) => (m.id === optimisticId ? { ...m, id: result.userMessageId } : m)),
        {
          id: result.assistantMessageId,
          role: "assistant",
          content: result.reply,
          operations: result.operations.length > 0 ? result.operations : null,
          appliedAt: null,
        },
      ])
    })
  }

  function handleApply(message: ChatMessage) {
    startTransition(async () => {
      const result = await applyChatOperationsAction({ tripId, messageId: message.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, appliedAt: new Date().toISOString() } : m))
      )
      toast.success(
        result.skipped.length > 0
          ? `Applied ${result.appliedCount} change${result.appliedCount === 1 ? "" : "s"}, ${result.skipped.length} skipped.`
          : "Applied to your itinerary."
      )
    })
  }

  function handleDiscard(messageId: string) {
    setDiscardedIds((prev) => new Set(prev).add(messageId))
  }

  return (
    <>
      <Button
        size="icon-lg"
        aria-label="Open trip assistant"
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden="true" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Trip assistant</SheetTitle>
            <SheetDescription>
              Describe a change and review it before it&apos;s applied.
            </SheetDescription>
            {quota ? (
              <p className="text-caption text-muted-foreground">
                {describeRemaining("chat_message", quota)}
              </p>
            ) : null}
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {messages.length === 0 ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  Try something like:
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setDraft(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => {
              const discarded = discardedIds.has(message.id)
              const showProposal = message.operations && message.operations.length > 0 && !discarded

              return (
                <div
                  key={message.id}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div className={message.role === "user" ? "max-w-[85%]" : "max-w-full"}>
                    {message.role === "user" ? (
                      <p className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {message.content}
                      </p>
                    ) : (
                      <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
                    )}

                    {showProposal ? (
                      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {message.operations?.map((op, index) => (
                            <li key={index}>{describeOperation(op, currency)}</li>
                          ))}
                        </ul>
                        {message.appliedAt ? (
                          <p className="text-xs font-semibold text-primary">Applied</p>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleApply(message)}
                            >
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleDiscard(message.id)}
                            >
                              Discard
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : discarded ? (
                      <p className="mt-1 text-xs text-muted-foreground">Discarded</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <SheetFooter className="border-t border-border pt-4">
            <form
              className="flex w-full gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                handleSend(draft)
              }}
            >
              <label htmlFor="trip-chat-input" className="sr-only">
                Message the trip assistant
              </label>
              <Textarea
                id="trip-chat-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    handleSend(draft)
                  }
                }}
                placeholder="Describe a change…"
                className="min-h-10 flex-1"
                disabled={isPending}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={isPending || !draft.trim()}
              >
                <Send aria-hidden="true" />
              </Button>
            </form>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
