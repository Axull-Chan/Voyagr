import { FlaskConical } from "lucide-react"

/**
 * Always visible on the booking screens while booking runs in sandbox mode
 * (the only mode this build allows — see `bookingConfig`). Not dismissible:
 * the point is that nobody mistakes a test booking for a real one.
 */
export function SandboxNotice({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={`border-notice-border bg-notice text-notice-foreground flex items-start gap-2 rounded-sm border px-3 py-2 text-sm ${className ?? ""}`}
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Test mode.</strong> Bookings are simulated and nothing is charged.
      </span>
    </p>
  )
}
