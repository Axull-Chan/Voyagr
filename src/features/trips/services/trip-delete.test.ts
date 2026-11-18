import { describe, expect, it } from "vitest"

import { deleteBlockedReason, tripDeletionCopy } from "./trip-delete"

describe("deleteBlockedReason", () => {
  it("refuses a trip that is still generating, with a message to show", () => {
    expect(deleteBlockedReason("generating")).toMatch(/still being generated/i)
  })

  it.each(["draft", "ready", "archived"])("allows a %s trip", (status) => {
    expect(deleteBlockedReason(status)).toBeNull()
  })
})

describe("tripDeletionCopy", () => {
  it("names the trip", () => {
    expect(tripDeletionCopy("Lisbon in spring").description).toContain(
      "Lisbon in spring"
    )
  })

  it("says everything that is deleted, and that it cannot be undone", () => {
    const { description } = tripDeletionCopy("Anything")
    for (const part of ["itinerary", "expenses", "packing list", "chat history"]) {
      expect(description).toContain(part)
    }
    expect(description).toMatch(/permanently/i)
    expect(description).toMatch(/can't be undone/i)
  })

  it("trims the title and does not quote a blank one", () => {
    expect(tripDeletionCopy("  Rome  ").description).toMatch(/^.Rome. will/)
    expect(tripDeletionCopy("   ").description).toMatch(/^This trip will/)
  })

  it("tells the reader Favorites survive, matching on delete set null", () => {
    expect(tripDeletionCopy("x").reassurance).toMatch(/Favorites are kept/)
  })
})
