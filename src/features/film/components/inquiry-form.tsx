"use client"

import { useId, useState } from "react"

import { cn } from "@/lib/utils"
import { filmLabel, filmSerif } from "@/features/film/film-typography"

const fields = [
  { name: "name", label: "Name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "destination", label: "Where to", type: "text", autoComplete: "off" },
] as const

/**
 * Showcase-only: submitting sets local state and nothing else. There is no
 * action, no endpoint and no network call — the page says so in plain text
 * above the button, because a form that looks like it collects real contact
 * details should never quietly discard them without telling the visitor.
 */
export function InquiryForm() {
  const formId = useId()
  const [sent, setSent] = useState(false)

  return (
    <section id="inquire" className="border-t border-film-line">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 sm:py-32 lg:grid-cols-2 lg:gap-24">
        <div>
          <p className={filmLabel}>Enquiries</p>
          <h2
            className={cn(
              filmSerif,
              "mt-4 text-4xl leading-[1.1] font-light text-balance text-film-ink sm:text-5xl"
            )}
          >
            Tell us the city. We&rsquo;ll find its blue hour.
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-film-muted">
            Voyagr plans the day around the twenty minutes that matter — the
            light, the walk, the table that&rsquo;s still free at eight.
          </p>
        </div>

        {sent ? (
          <div className="flex items-center border-t border-film-line pt-10 lg:border-t-0 lg:pt-0">
            <div>
              <p className={filmLabel}>Received</p>
              <p
                className={cn(
                  filmSerif,
                  "mt-4 text-3xl font-light text-film-ink"
                )}
              >
                Thank you — nothing was actually sent.
              </p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-film-muted">
                This is a fictional showcase, so the form stops here. No
                details left your browser.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className={cn(
                  filmLabel,
                  "mt-8 rounded-sm underline underline-offset-8 transition-colors hover:text-film-ink focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:outline-none"
                )}
              >
                Reset the form
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setSent(true)
            }}
            className="space-y-8"
          >
            {fields.map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={`${formId}-${field.name}`}
                  className={cn(filmLabel, "block")}
                >
                  {field.label}
                </label>
                <input
                  id={`${formId}-${field.name}`}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required
                  className="mt-3 w-full border-b border-film-line bg-transparent pb-3 text-lg text-film-ink transition-colors placeholder:text-film-muted focus:border-film-ink focus-visible:outline-none"
                />
              </div>
            ))}

            <div>
              <label
                htmlFor={`${formId}-message`}
                className={cn(filmLabel, "block")}
              >
                Anything else
              </label>
              <textarea
                id={`${formId}-message`}
                name="message"
                rows={3}
                className="mt-3 w-full resize-none border-b border-film-line bg-transparent pb-3 text-lg text-film-ink transition-colors focus:border-film-ink focus-visible:outline-none"
              />
            </div>

            <p className="text-xs leading-relaxed text-film-muted">
              A showcase form — submitting shows a confirmation and sends
              nothing anywhere.
            </p>

            <button
              type="submit"
              className={cn(
                filmLabel,
                "w-full rounded-none border border-film-line py-5 text-film-ink transition-colors hover:bg-film-ink hover:text-film-bg focus-visible:ring-2 focus-visible:ring-film-ink focus-visible:ring-offset-2 focus-visible:ring-offset-film-bg focus-visible:outline-none sm:w-auto sm:px-16"
              )}
            >
              Send enquiry
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
