import { describe, expect, it } from "vitest"

import {
  CHANGEOVER_BUFFER_MINUTES,
  LONG_DAY_MINUTES,
  MAX_COMFORTABLE_STOPS,
  MAX_WALKING_LEG_KM,
  STREET_FACTOR,
  analyzeDay,
  dayTotalsText,
  estimateLeg,
  haversineKm,
  legText,
  legUpdates,
  legsInOrder,
  orderByProximity,
  orderWithinSlots,
  pathKm,
  planDayRoute,
  sortStopsByTime,
  tripStartPoint,
  type GeoPoint,
  type RouteStop,
} from "@/lib/trips/feasibility"

// Real Lisbon points from the live run, plus far-apart districts.
const P = {
  hotel: { lat: 38.7097, lng: -9.1377 }, // Vincci Baixa
  baixa: { lat: 38.7101, lng: -9.137 },
  statue: { lat: 38.7075, lng: -9.1365 },
  arco: { lat: 38.7084, lng: -9.1368 },
  belem: { lat: 38.6916, lng: -9.216 },
  alfama: { lat: 38.7139, lng: -9.13 },
  parque: { lat: 38.768, lng: -9.094 },
  lxFactory: { lat: 38.7036, lng: -9.1788 },
} satisfies Record<string, GeoPoint>

const stop = (
  id: string,
  point: GeoPoint | null,
  timeSlot: string | null,
  startTime: string | null,
  durationMinutes: number | null,
  sortOrder = 0
): RouteStop => ({
  id,
  title: id,
  timeSlot,
  startTime,
  durationMinutes,
  lat: point?.lat ?? null,
  lng: point?.lng ?? null,
  sortOrder,
})

describe("haversineKm", () => {
  it("matches a known distance (London - Paris, ~343.5 km)", () => {
    const km = haversineKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 })
    expect(km).toBeGreaterThan(343)
    expect(km).toBeLessThan(345)
  })

  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(P.baixa, P.baixa)).toBe(0)
    expect(haversineKm(P.baixa, P.belem)).toBeCloseTo(haversineKm(P.belem, P.baixa), 10)
  })
})

describe("estimateLeg", () => {
  it("walks a short leg, applying the street factor and a 5 min floor", () => {
    const leg = estimateLeg(P.baixa, P.statue)
    expect(leg.mode).toBe("walk")
    expect(leg.km).toBeCloseTo(Math.round(haversineKm(P.baixa, P.statue) * STREET_FACTOR * 10) / 10, 5)
    expect(leg.minutes).toBe(5)
  })

  it("rides a long leg by the trip's preference", () => {
    const straight = haversineKm(P.baixa, P.belem)
    const street = straight * STREET_FACTOR
    expect(estimateLeg(P.baixa, P.belem, "public")).toEqual({
      km: Math.round(street * 10) / 10,
      minutes: Math.round(10 + (street / 18) * 60),
      mode: "public",
    })
    expect(estimateLeg(P.baixa, P.belem, "rideshare").minutes).toBe(Math.round(5 + (street / 25) * 60))
    expect(estimateLeg(P.baixa, P.belem, "car").mode).toBe("car")
    // "mixed" and unknown fall back to public transport.
    expect(estimateLeg(P.baixa, P.belem, "mixed").mode).toBe("public")
    expect(estimateLeg(P.baixa, P.belem, null).mode).toBe("public")
  })

  it("never rides for a walking-only trip", () => {
    const leg = estimateLeg(P.baixa, P.belem, "walk")
    expect(leg.mode).toBe("walk")
    expect(leg.minutes).toBe(Math.round(((haversineKm(P.baixa, P.belem) * STREET_FACTOR) / 4.5) * 60))
  })

  it("turns 1 km in a straight line into an estimated 1.3 km, 17 min on foot", () => {
    // Pinned in absolute numbers, independent of the constants, so changing
    // the street factor or walking speed has to be deliberate.
    const from = { lat: 38.7, lng: -9.14 }
    const oneKmNorth = { lat: 38.7 + 1 / haversineKm(from, { lat: 39.7, lng: -9.14 }), lng: -9.14 }
    expect(estimateLeg(from, oneKmNorth, "walk")).toEqual({ km: 1.3, minutes: 17, mode: "walk" })
  })

  it("walks up to the walking threshold and rides just beyond it", () => {
    // Points due north of each other, so street km is easy to pin.
    const from = { lat: 38.7, lng: -9.14 }
    const kmPerDegree = haversineKm(from, { lat: 39.7, lng: -9.14 })
    const at = (streetKm: number) => ({ lat: 38.7 + streetKm / STREET_FACTOR / kmPerDegree, lng: -9.14 })
    expect(estimateLeg(from, at(MAX_WALKING_LEG_KM - 0.01), "public").mode).toBe("walk")
    expect(estimateLeg(from, at(MAX_WALKING_LEG_KM + 0.05), "public").mode).toBe("public")
  })
})

describe("orderByProximity", () => {
  const a = { id: "parque", ...P.parque }
  const b = { id: "lx", ...P.lxFactory }
  const c = { id: "alfama", ...P.alfama }
  const d = { id: "belem", ...P.belem }

  it("finds the shortest route for a small day (checked against every order)", () => {
    const zigzag = [a, b, c, d]
    const km = (list: typeof zigzag) => pathKm(list.map((s) => ({ lat: s.lat, lng: s.lng })), P.baixa)
    const permutations = (list: typeof zigzag): (typeof zigzag)[] =>
      list.length <= 1
        ? [list]
        : list.flatMap((first, i) =>
            permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [first, ...rest])
          )
    const best = Math.min(...permutations(zigzag).map(km))
    const ordered = orderByProximity(zigzag, P.baixa)
    expect(km(ordered)).toBeCloseTo(best, 6)
    expect(km(ordered)).toBeLessThan(km(zigzag))
  })

  it("stays within a whisker of the best route beyond the exact limit", () => {
    // 9 stops on a ring: the heuristic path must still beat the scrambled input.
    const ring = Array.from({ length: 9 }, (_, i) => ({
      id: `r${i}`,
      lat: 38.72 + 0.03 * Math.sin((i * 4 * Math.PI) / 9),
      lng: -9.14 + 0.03 * Math.cos((i * 4 * Math.PI) / 9),
    }))
    const km = (list: typeof ring) => pathKm(list, P.baixa)
    const ordered = orderByProximity(ring, P.baixa)
    expect(ordered).toHaveLength(9)
    expect(new Set(ordered.map((s) => s.id)).size).toBe(9)
    expect(km(ordered)).toBeLessThan(km(ring))
  })

  it("is deterministic", () => {
    expect(orderByProximity([a, b, c, d], P.baixa)).toEqual(orderByProximity([a, b, c, d], P.baixa))
  })

  it("keeps the first stop first when there is no start point", () => {
    expect(orderByProximity([b, a, c, d], null)[0]!.id).toBe("lx")
  })

  it("appends stops with no location in their original order", () => {
    const x = { id: "x", lat: null, lng: null }
    const y = { id: "y", lat: null, lng: null }
    expect(orderByProximity([x, a, y, c], P.baixa).map((s) => s.id)).toEqual(["alfama", "parque", "x", "y"])
  })
})

describe("orderWithinSlots", () => {
  it("never moves a stop out of its slot", () => {
    const stops = [
      { id: "evening-far", slot: "evening", ...P.belem },
      { id: "morning-far", slot: "morning", ...P.parque },
      { id: "morning-near", slot: "morning", ...P.statue },
      { id: "afternoon", slot: "afternoon", ...P.alfama },
    ]
    expect(orderWithinSlots(stops, (s) => s.slot, P.hotel).map((s) => s.id)).toEqual([
      "morning-near",
      "morning-far",
      "afternoon",
      "evening-far",
    ])
  })
})

describe("planDayRoute (generation)", () => {
  type Item = { id: string; timeSlot: "morning" | "afternoon" | "evening"; startTime: string; durationMinutes: number; lat: number; lng: number }
  const item = (id: string, timeSlot: Item["timeSlot"], startTime: string, durationMinutes: number, p: GeoPoint): Item => ({
    id,
    timeSlot,
    startTime,
    durationMinutes,
    ...p,
  })

  it("reorders within a slot and re-times the stop that no longer fits", () => {
    const plan = planDayRoute(
      [item("belem", "morning", "09:30", 60, P.belem), item("statue", "morning", "10:00", 30, P.statue)],
      { start: P.hotel, transport: "public" }
    )
    expect(plan.map((p) => p.item.id)).toEqual(["statue", "belem"])
    // The morning still starts at 09:30 (the slot's first time stays first);
    // Belem waits for the statue to end, plus travel and a buffer.
    expect(plan[0]!.startTime).toBe("09:30")
    const leg = plan[1]!.leg!
    const earliest = 9 * 60 + 30 + 30 + leg.minutes + CHANGEOVER_BUFFER_MINUTES
    const rounded = Math.ceil(earliest / 5) * 5
    expect(plan[1]!.startTime).toBe(
      `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`
    )
    expect(leg.mode).toBe("public")
    expect(plan[0]!.leg!.mode).toBe("walk")
  })

  it("keeps a later own time that already leaves room", () => {
    const plan = planDayRoute(
      [item("arco", "morning", "09:30", 60, P.arco), item("statue", "morning", "11:15", 30, P.statue)],
      { start: P.hotel }
    )
    expect(plan.map((p) => p.startTime)).toEqual(["09:30", "11:15"])
  })

  it("keeps every stop in its slot and every time inside its slot", () => {
    const plan = planDayRoute(
      [
        item("evening", "evening", "10:00", 90, P.alfama), // own time contradicts its slot
        item("morning", "morning", "09:30", 600, P.statue), // runs very long
        item("afternoon", "afternoon", "14:00", 60, P.belem),
      ],
      { start: P.hotel }
    )
    expect(plan.map((p) => p.item.timeSlot)).toEqual(["morning", "afternoon", "evening"])
    const [m, a, e] = plan.map((p) => p.startTime)
    expect(m! < "12:00").toBe(true)
    expect(a! >= "12:00" && a! < "17:00").toBe(true)
    expect(e! >= "17:00").toBe(true)
  })

  it("measures the first leg from the start point", () => {
    const plan = planDayRoute([item("statue", "morning", "10:00", 30, P.statue)], { start: P.hotel })
    expect(plan[0]!.leg).toEqual(estimateLeg(P.hotel, P.statue))
  })
})

describe("analyzeDay", () => {
  // Lisbon day 1 as generated, from the real hotel.
  const lisbonDay1 = [
    stop("baixa", P.baixa, "morning", "09:30:00", 90, 0),
    stop("statue", P.statue, "morning", "11:15:00", 30, 1),
    stop("arco", P.arco, "afternoon", "14:30:00", 60, 2),
  ]

  it("finds a real, nearby day comfortable", () => {
    const f = analyzeDay(lisbonDay1, { start: P.hotel, transport: "public" })
    expect(f.status).toBe("comfortable")
    expect(f.issues).toEqual([])
    expect(f.totals.stops).toBe(3)
    expect(f.totals.activityMinutes).toBe(180)
    expect(Object.values(f.legs).every((leg) => leg?.mode === "walk")).toBe(true)
  })

  it("flags a stop that starts before the previous one ends", () => {
    const f = analyzeDay(
      [stop("a", P.baixa, "morning", "10:00", 90), stop("b", P.statue, "morning", "11:00", 30)],
      { start: P.hotel }
    )
    expect(f.status).toBe("tight")
    expect(f.issues[0]).toMatchObject({ kind: "overlap", severity: "tight", stopIds: ["a", "b"] })
    expect(f.issues[0]!.message).toContain("starts at 11:00, before \"a\" ends (11:30)")
  })

  it("flags a gap shorter than the travel time, and not one equal to it", () => {
    const leg = estimateLeg(P.baixa, P.belem, "public")
    const at = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
    const day = (gap: number) => [
      stop("a", P.baixa, "morning", "09:00", 60),
      stop("b", P.belem, "morning", at(10 * 60 + gap), 60),
    ]
    const tight = analyzeDay(day(leg.minutes - 1), { start: P.hotel, transport: "public" })
    expect(tight.status).toBe("tight")
    expect(tight.issues[0]).toMatchObject({ kind: "tight-gap" })
    expect(tight.issues[0]!.message).toContain("by public transport")
    expect(analyzeDay(day(leg.minutes), { start: P.hotel, transport: "public" }).status).toBe("comfortable")
  })

  it("flags too much walking on a walking-only trip", () => {
    const f = analyzeDay(
      [
        stop("a", P.belem, "morning", null, null),
        stop("b", P.parque, "afternoon", null, null),
      ],
      { start: P.hotel, transport: "walk" }
    )
    expect(f.status).toBe("busy")
    expect(f.issues.map((i) => i.kind)).toContain("long-walk")
    expect(f.totals.ridingKm).toBe(0)
  })

  it("flags a day over the long-day limit, not one at it", () => {
    const over = analyzeDay([stop("a", P.baixa, "morning", "09:00", LONG_DAY_MINUTES)], { start: P.baixa })
    expect(over.issues.map((i) => i.kind)).toContain("long-day")
    const at = analyzeDay([stop("a", P.baixa, "morning", "09:00", LONG_DAY_MINUTES - 5)], { start: P.baixa })
    expect(at.issues.map((i) => i.kind)).not.toContain("long-day")
  })

  it(`flags more than ${MAX_COMFORTABLE_STOPS} stops, not exactly that many`, () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => stop(`s${i}`, P.baixa, "afternoon", null, null, i))
    expect(analyzeDay(many(MAX_COMFORTABLE_STOPS), { start: P.baixa }).status).toBe("comfortable")
    const f = analyzeDay(many(MAX_COMFORTABLE_STOPS + 1), { start: P.baixa })
    expect(f.status).toBe("busy")
    expect(f.issues.filter((i) => i.severity !== "info").map((i) => i.kind)).toEqual(["too-many-stops"])
  })

  it("flags a route that doubles back within a slot", () => {
    const f = analyzeDay(
      [
        // West, back east, then west again; Alfama -> LX -> Belem is far shorter.
        stop("belem", P.belem, "morning", null, null, 0),
        stop("alfama", P.alfama, "morning", null, null, 1),
        stop("lx", P.lxFactory, "morning", null, null, 2),
      ],
      { start: P.baixa, transport: "public" }
    )
    expect(f.issues.map((i) => i.kind)).toContain("zigzag")
    expect(f.status).toBe("busy")
  })

  it("does not call a slot-respecting route a zigzag", () => {
    // Far apart, but each slot has one stop, so no better order exists.
    const f = analyzeDay(
      [
        stop("parque", P.parque, "morning", null, null),
        stop("belem", P.belem, "afternoon", null, null),
        stop("alfama", P.alfama, "evening", null, null),
      ],
      { start: P.baixa, transport: "public" }
    )
    expect(f.issues.map((i) => i.kind)).not.toContain("zigzag")
  })

  it("reports missing data as info and never guesses", () => {
    const f = analyzeDay(
      [stop("nowhere", null, "morning", null, null), stop("somewhere", P.baixa, "morning", "10:00", 60)],
      { start: null }
    )
    // Timed stops sort first, so the issues come from "nowhere", in that order.
    expect(f.issues.map((i) => [i.kind, i.severity])).toEqual([
      ["missing-location", "info"],
      ["missing-time", "info"],
    ])
    // Nothing could be measured: no start, one located stop, one timed stop.
    expect(f.status).toBe("unknown")
    expect(f.legs).toEqual({ nowhere: null, somewhere: null })
  })

  it("has no leg into the first stop without a start point", () => {
    const f = analyzeDay(lisbonDay1, { start: null })
    expect(f.legs.baixa).toBeNull()
    expect(f.legs.statue).not.toBeNull()
  })

  it("analyses in time order, whatever order the rows come in", () => {
    const shuffled = [lisbonDay1[2]!, lisbonDay1[0]!, lisbonDay1[1]!]
    expect(analyzeDay(shuffled, { start: P.hotel })).toEqual(analyzeDay(lisbonDay1, { start: P.hotel }))
  })
})

describe("sortStopsByTime and legsInOrder", () => {
  it("sorts by slot, then time, then position; untimed last in a slot", () => {
    const rows = [
      stop("pm", null, "afternoon", "13:00", 60, 0),
      stop("untimed", null, "morning", null, 60, 1),
      stop("late", null, "morning", "11:00", 60, 2),
      stop("early", null, "morning", "09:00", 60, 3),
    ]
    expect(sortStopsByTime(rows).map((r) => r.id)).toEqual(["early", "late", "untimed", "pm"])
  })

  it("measures past a stop with no location from the last located one", () => {
    const legs = legsInOrder(
      [{ lat: P.baixa.lat, lng: P.baixa.lng }, { lat: null, lng: null }, { lat: P.statue.lat, lng: P.statue.lng }],
      null
    )
    expect(legs[0]).toBeNull()
    expect(legs[1]).toBeNull()
    expect(legs[2]).toEqual(estimateLeg(P.baixa, P.statue))
  })
})

describe("legUpdates (post-edit resync)", () => {
  const row = (s: RouteStop, travel: number | null, km: number | string | null) => ({
    ...s,
    travel_time_minutes: travel,
    walking_distance_km: km,
  })

  it("rewrites stale legs after a move and leaves correct ones alone", () => {
    const first = estimateLeg(P.hotel, P.baixa, "public")
    const rows = [
      row(stop("baixa", P.baixa, "morning", "09:30", 90, 0), first.minutes, String(first.km)),
      // Moved to after Baixa, but still carries its old leg from somewhere else.
      row(stop("belem", P.belem, "morning", "11:30", 60, 1), 5, 0.3),
    ]
    const correct = estimateLeg(P.baixa, P.belem, "public")
    expect(legUpdates(rows, { start: P.hotel, transport: "public" })).toEqual([
      { id: "belem", travelTimeMinutes: correct.minutes, walkingDistanceKm: correct.km },
    ])
  })

  it("leaves the first stop alone when there is no start point", () => {
    const rows = [
      row(stop("baixa", P.baixa, "morning", "09:30", 90, 0), 12, 0.9),
      row(stop("statue", P.statue, "morning", "11:15", 30, 1), 999, 9),
    ]
    const updates = legUpdates(rows, { start: null })
    expect(updates.map((u) => u.id)).toEqual(["statue"])
  })

  it("clears the leg of a stop with no location", () => {
    const rows = [row(stop("nowhere", null, "morning", "09:30", 60, 0), 12, 0.9)]
    expect(legUpdates(rows, { start: P.hotel })).toEqual([
      { id: "nowhere", travelTimeMinutes: null, walkingDistanceKm: null },
    ])
  })
})

describe("tripStartPoint", () => {
  it("uses the primary real stay, never an example one", () => {
    expect(
      tripStartPoint([
        { lat: 1, lng: 1, is_primary: true, source: "mock" },
        { lat: 2, lng: 2, is_primary: false, source: "opentripmap" },
        { lat: 3, lng: 3, is_primary: true, source: "opentripmap" },
      ])
    ).toEqual({ lat: 3, lng: 3 })
    expect(tripStartPoint([{ lat: 1, lng: 1, is_primary: true, source: "mock" }])).toBeNull()
    expect(tripStartPoint([{ lat: null, lng: null, is_primary: true, source: "opentripmap" }])).toBeNull()
  })
})

describe("wording", () => {
  it("labels every number as an estimate and names the mode", () => {
    expect(legText({ km: 1.2, minutes: 16, mode: "walk" })).toBe("est. 1.2 km · ~16 min on foot")
    expect(legText({ km: 9.1, minutes: 75, mode: "public" })).toBe("est. 9.1 km · ~1 h 15 min by public transport")
  })

  it("summarises a day's travel, or nothing when there is none", () => {
    const f = analyzeDay(
      [stop("a", P.baixa, "morning", "09:00", 60), stop("b", P.belem, "afternoon", "14:00", 60)],
      { start: P.hotel, transport: "public" }
    )
    expect(dayTotalsText(f)).toMatch(/^est\. [\d.]+ km on foot · est\. [\d.]+ km riding · ~\d+ min getting around$/)
    expect(dayTotalsText(analyzeDay([], { start: null }))).toBeNull()
  })
})
