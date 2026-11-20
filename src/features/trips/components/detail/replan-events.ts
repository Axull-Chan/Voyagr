import type { ChatOperation } from "@/lib/ai/types"

/**
 * How a replan button hands its proposal to the chat panel. The two are
 * siblings across a server-component boundary (the day timeline is rendered
 * on the server; the chat is a client island), so a page-level browser event
 * is the smallest bridge: the button dispatches, the panel appends the message
 * and opens.
 */
export const REPLAN_PROPOSAL_EVENT = "voyagr:replan-proposal"

export interface ReplanProposalDetail {
  proposal: { id: string; content: string; operations: ChatOperation[] }
  /** Earlier pending replans for the same day, no longer applicable. */
  supersededIds: string[]
}

/** Appended to a superseded proposal's text, matching what the server stores. */
export const SUPERSEDED_NOTE = " (Replaced by a newer suggestion.)"
