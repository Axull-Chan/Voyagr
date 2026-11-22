import { AI_NOTICE, type DataSourceGroup } from "@/lib/attribution"

/**
 * The foot of the trip page: the AI disclosure, then a linked credit for each
 * data source this trip actually uses (Open-Meteo CC BY 4.0, OpenTripMap and
 * OpenStreetMap ODbL, Unsplash). A server component; nothing interactive.
 */
export function TripSources({
  groups,
  showAiNotice,
}: {
  groups: DataSourceGroup[]
  showAiNotice: boolean
}) {
  if (!showAiNotice && groups.length === 0) return null
  return (
    <footer className="mt-14 space-y-1.5 border-t border-border pt-5 text-xs text-muted-foreground sm:mt-16">
      {showAiNotice ? <p>{AI_NOTICE}</p> : null}
      {groups.length > 0 ? (
        <p>
          Data sources:{" "}
          {groups.map((group, groupIndex) => (
            <span key={group.heading}>
              {groupIndex > 0 ? " · " : null}
              {group.heading}:{" "}
              {group.credits.map((credit, index) => (
                <span key={credit.label}>
                  {index > 0 ? ", " : null}
                  {credit.href ? (
                    <a
                      href={credit.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {credit.label}
                    </a>
                  ) : (
                    credit.label
                  )}
                </span>
              ))}
            </span>
          ))}
        </p>
      ) : null}
    </footer>
  )
}
