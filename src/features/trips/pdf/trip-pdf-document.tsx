import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type { TripPdfModel } from "@/features/trips/pdf/trip-pdf-model"

/**
 * Draws a `TripPdfModel`. All decisions about wording live in the model; this
 * file is layout only.
 *
 * Fonts are the PDF standard ones — Helvetica for text, Times for headings (the
 * app's headings are Fraunces, a serif) — because they cost nothing to embed and
 * need no font files in the deployment. The trade-off, handled by `toPdfText` in
 * the model, is that they draw only the Windows-1252 character set.
 *
 * Pages are white, not the app's paper tone: this is meant to be printed, and a
 * tinted background wastes ink and prints unevenly.
 */

// Pine Blue and ink from DESIGN.md's light theme, tuned for print contrast.
const INK = "#1e2019"
const MUTED = "#5b6058"
const RULE = "#d8d5cf"
const ACCENT = "#244f54"
const ACCENT_SOFT = "#587b7f"
const PAPER_TINT = "#f8f6f4"
const NOTICE_RULE = "#c9a62c"

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 64,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.4,
    color: INK,
  },

  // Header
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: ACCENT_SOFT,
    marginBottom: 6,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 26,
    lineHeight: 1.15,
    color: ACCENT,
  },
  destination: { fontSize: 12, color: MUTED, marginTop: 4 },
  statusNote: {
    marginTop: 6,
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: MUTED,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: RULE,
  },
  fact: { marginRight: 26, marginBottom: 4 },
  factLabel: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: MUTED,
  },
  factValue: { fontSize: 10.5, marginTop: 1 },

  notice: {
    marginTop: 14,
    padding: 9,
    backgroundColor: PAPER_TINT,
    borderLeftWidth: 2.5,
    borderLeftColor: NOTICE_RULE,
    fontSize: 8.5,
    color: MUTED,
  },

  // Sections
  section: { marginTop: 22 },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 15,
    color: ACCENT,
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
  },

  // Days
  day: { marginBottom: 14 },
  dayHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: ACCENT,
  },
  weather: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 8.5,
    color: MUTED,
    marginTop: 1,
  },
  summary: { marginTop: 4, color: INK },
  row: {
    flexDirection: "row",
    paddingTop: 5,
    marginTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
  },
  rowWhen: { width: 74, fontSize: 8.5, color: MUTED },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: "Helvetica-Bold" },
  rowDetail: { fontSize: 8.5, color: MUTED, marginTop: 1 },
  rowCost: { width: 62, textAlign: "right", fontSize: 8.5, color: MUTED },
  mealLabel: { width: 74, fontSize: 8.5, color: ACCENT_SOFT },
  dayCost: {
    marginTop: 5,
    textAlign: "right",
    fontSize: 8.5,
    color: MUTED,
  },
  empty: { fontSize: 9, color: MUTED, fontFamily: "Helvetica-Oblique" },

  // Stays, transport
  item: { marginBottom: 7 },
  itemTitle: { fontFamily: "Helvetica-Bold" },
  itemFacts: { fontSize: 8.5, color: MUTED, marginTop: 1 },
  example: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Oblique",
    color: "#8a6d12",
    marginTop: 1,
  },

  // Budget table
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  tableHead: { fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: MUTED },
  cellLabel: { flex: 1 },
  cellNum: { width: 90, textAlign: "right" },
  tableTotal: { fontFamily: "Helvetica-Bold" },
  warning: {
    marginTop: 8,
    padding: 8,
    backgroundColor: PAPER_TINT,
    borderLeftWidth: 2.5,
    borderLeftColor: NOTICE_RULE,
    fontSize: 8.5,
    color: INK,
  },
  subhead: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: ACCENT,
    marginTop: 14,
    marginBottom: 4,
  },

  // Packing
  packGroup: { marginBottom: 9 },
  packTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: ACCENT_SOFT, marginBottom: 2 },
  packItem: { flexDirection: "row", alignItems: "center", paddingVertical: 1.5 },
  box: {
    width: 7,
    height: 7,
    borderWidth: 0.75,
    borderColor: MUTED,
    marginRight: 7,
  },
  boxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  packChecked: { color: MUTED, textDecoration: "line-through" },

  notes: { color: INK },

  // Footer
  footer: {
    position: "absolute",
    bottom: 26,
    left: 46,
    right: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 6,
  },
})

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={s.section}>
      {/* Keeps a heading from being stranded at the foot of a page with its
          content on the next. */}
      <Text style={s.sectionTitle} minPresenceAhead={70}>
        {title}
      </Text>
      {children}
    </View>
  )
}

function ActivityRow({ activity }: { activity: TripPdfModel["days"][number]["activities"][number] }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.rowWhen}>{activity.when}</Text>
      <View style={s.rowMain}>
        <Text style={s.rowTitle}>{activity.title}</Text>
        {activity.detail ? <Text style={s.rowDetail}>{activity.detail}</Text> : null}
      </View>
      <Text style={s.rowCost}>{activity.cost ?? ""}</Text>
    </View>
  )
}

export function TripPdfDocument({ model }: { model: TripPdfModel }) {
  return (
    <Document
      title={`${model.title} - Voyagr`}
      author="Voyagr"
      subject={`Trip plan for ${model.destination}`}
      creator="Voyagr"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View>
          <Text style={s.eyebrow}>Voyagr  ·  Trip plan</Text>
          <Text style={s.title}>{model.title}</Text>
          <Text style={s.destination}>{model.destination}</Text>
          {model.statusNote ? (
            <Text style={s.statusNote}>{model.statusNote}</Text>
          ) : null}
          <View style={s.facts}>
            {model.facts.map((fact) => (
              <View key={fact.label} style={s.fact}>
                <Text style={s.factLabel}>{fact.label}</Text>
                <Text style={s.factValue}>{fact.value}</Text>
              </View>
            ))}
          </View>
          <Text style={s.notice}>{model.notice}</Text>
        </View>

        {/* Day by day */}
        <Section title="Day by day">
          {model.days.length === 0 ? (
            <Text style={s.empty}>No itinerary has been generated for this trip yet.</Text>
          ) : (
            model.days.map((day) => {
              const [firstActivity, ...otherActivities] = day.activities
              return (
                <View key={day.heading} style={s.day}>
                  {/* The heading, weather, summary and the first activity are one
                      unbreakable block, so a day can never start at the foot of a
                      page with all of its content on the next. A `minPresenceAhead`
                  hint was tried first and was satisfied by the summary alone. */}
                  <View wrap={false}>
                    <Text style={s.dayHeading}>{day.heading}</Text>
                    {day.weather ? <Text style={s.weather}>{day.weather}</Text> : null}
                    {day.summary ? <Text style={s.summary}>{day.summary}</Text> : null}
                    {firstActivity ? <ActivityRow activity={firstActivity} /> : null}
                  </View>

                  {otherActivities.map((a, i) => (
                    <ActivityRow key={`a${i}`} activity={a} />
                  ))}

                  {day.meals.map((m, i) => (
                    <View key={`m${i}`} style={s.row} wrap={false}>
                      <Text style={s.mealLabel}>{m.meal}</Text>
                      <View style={s.rowMain}>
                        <Text>
                          <Text style={s.rowTitle}>{m.name}</Text>
                          {m.cuisine ? (
                            <Text style={{ color: MUTED }}>{`   ${m.cuisine}`}</Text>
                          ) : null}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {day.activities.length === 0 && day.meals.length === 0 ? (
                    <Text style={[s.empty, { marginTop: 5 }]}>Nothing scheduled.</Text>
                  ) : null}
                  {day.dayCost ? (
                    <Text style={s.dayCost}>Estimated cost for the day: {day.dayCost}</Text>
                  ) : null}
                </View>
              )
            })
          )}
        </Section>

        {/* Stays */}
        {model.stays.length > 0 ? (
          <Section title="Where you are staying">
            {model.stays.map((stay, i) => (
              <View key={`s${i}`} style={s.item} wrap={false}>
                <Text style={s.itemTitle}>{stay.name}</Text>
                {stay.address ? <Text style={s.itemFacts}>{stay.address}</Text> : null}
                {stay.facts ? <Text style={s.itemFacts}>{stay.facts}</Text> : null}
                {stay.isExample ? (
                  <Text style={s.example}>
                    An example stay for budgeting - not a real listing.
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {/* Transport */}
        {model.transport.length > 0 ? (
          <Section title="Getting around">
            {model.transport.map((leg, i) => (
              <View key={`t${i}`} style={s.item} wrap={false}>
                <Text style={s.itemTitle}>{leg.route}</Text>
                {leg.facts ? <Text style={s.itemFacts}>{leg.facts}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {/* Budget */}
        {model.budget ? (
          <Section title="Budget">
            <View style={s.tableRow}>
              <Text style={[s.cellLabel, s.tableHead]}>Category</Text>
              <Text style={[s.cellNum, s.tableHead]}>Planned</Text>
              <Text style={[s.cellNum, s.tableHead]}>Spent</Text>
            </View>
            {model.budget.rows.map((row) => (
              <View key={row.label} style={s.tableRow} wrap={false}>
                <Text style={s.cellLabel}>{row.label}</Text>
                <Text style={s.cellNum}>{row.planned}</Text>
                <Text style={s.cellNum}>{row.spent}</Text>
              </View>
            ))}
            <View style={[s.tableRow, s.tableTotal]} wrap={false}>
              <Text style={s.cellLabel}>Total</Text>
              <Text style={s.cellNum}>{model.budget.plannedTotal}</Text>
              <Text style={s.cellNum}>{model.budget.spentTotal}</Text>
            </View>
            {model.budget.budgetTotal ? (
              <Text style={[s.itemFacts, { marginTop: 6 }]}>
                Your budget: {model.budget.budgetTotal}
                {model.budget.remaining ? `   ·   Remaining: ${model.budget.remaining}` : ""}
              </Text>
            ) : null}
            {model.budget.warning ? (
              <Text style={s.warning}>{model.budget.warning}</Text>
            ) : null}

            {model.expenses.length > 0 ? (
              <View>
                <Text style={s.subhead}>Expenses logged</Text>
                {model.expenses.map((e, i) => (
                  <View key={`e${i}`} style={s.tableRow} wrap={false}>
                    <Text style={{ width: 54, color: MUTED }}>{e.date}</Text>
                    <Text style={{ width: 92 }}>{e.category}</Text>
                    <Text style={[s.cellLabel, { color: MUTED }]}>{e.description ?? ""}</Text>
                    <Text style={{ width: 130, textAlign: "right" }}>{e.amount}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* Packing */}
        {model.packing.length > 0 ? (
          <Section title={model.packingSummary ? `Packing list  ·  ${model.packingSummary}` : "Packing list"}>
            {model.packing.map((group) => (
              <View key={group.category} style={s.packGroup} wrap={false}>
                <Text style={s.packTitle}>{group.category}</Text>
                {group.items.map((item, i) => (
                  <View key={`${group.category}${i}`} style={s.packItem}>
                    <View style={item.checked ? [s.box, s.boxChecked] : s.box} />
                    <Text style={item.checked ? s.packChecked : undefined}>{item.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </Section>
        ) : null}

        {/* Notes */}
        {model.notes ? (
          <Section title="Your notes">
            <Text style={s.notes}>{model.notes}</Text>
          </Section>
        ) : null}

        {/* Footer, repeated on every page. */}
        <View style={s.footer} fixed>
          <Text>
            Voyagr  ·  {model.title}  ·  Created {model.generatedOn}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
