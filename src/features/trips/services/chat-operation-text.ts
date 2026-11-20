import type { ChatOperation } from "@/lib/ai/types"
import { formatCurrency } from "@/lib/trips/trip-domain"

/** One proposed operation as a line of the chat panel's preview. */
export function describeOperation(op: ChatOperation, currency: string): string {
  switch (op.kind) {
    case "add_activity":
      return `Add: ${op.title} — Day ${op.dayNumber}, ${op.timeSlot}${
        op.estimatedCost > 0 ? `, est. ${formatCurrency(op.estimatedCost, currency)}` : ""
      }`
    case "add_restaurant":
      return `Add: ${op.name} — Day ${op.dayNumber}, ${op.mealType}`
    case "remove_activity":
      return `Remove: ${op.label}`
    case "remove_restaurant":
      return `Remove: ${op.label}`
    case "move_activity": {
      const at = op.toStartTime ? ` at ${op.toStartTime.slice(0, 5)}` : ""
      // A same-day, same-slot move with a new time is a retime: say so.
      return op.expectedDayNumber === op.toDayNumber && op.expectedTimeSlot === op.toTimeSlot && at
        ? `Retime: ${op.label} — Day ${op.toDayNumber}, ${op.toTimeSlot}${at}`
        : `Move: ${op.label} — Day ${op.toDayNumber}, ${op.toTimeSlot}${at}`
    }
    case "reword_day_summary":
      return `Reword day ${op.dayNumber}'s summary`
  }
}
