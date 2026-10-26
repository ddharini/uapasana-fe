import {
  comingByText,
  formatIndiaFlight,
  formatStay,
  journeyHomeText,
} from "@/features/registrations/format"
import {
  flightsOf,
  hasOwnFlights,
  isSevak,
  wantsBed,
} from "@/features/registrations/stay"
import {
  GENDERS,
  REGISTRATION_TYPES,
  TRAVEL_MODES,
  type IndiaFlight,
  type Member,
  type PersonTravel,
} from "@/features/registrations/types"
import { formatMobile } from "@/lib/phone"
import { formatTime } from "@/lib/time"

import type { RegistrationDetails } from "./api"

/**
 * What a log entry changed, in words: one line per field, with the value
 * before and after. Worked out here from the two snapshots the server keeps,
 * so older entries read the same way as new ones.
 */
export type ChangeLine = {
  /** "Arrival", or "Ravi Patel · Age" for one person's detail. */
  label: string
  /** Missing for someone added. */
  before?: string
  /** Missing for someone removed. */
  after?: string
}

const yesNo = (value: boolean | undefined) => (value ? "Yes" : "No")
const orDash = (value: string | undefined | null) => value || "—"

/** "Yes · Sun 24 Jan, 6:30 am · AI 144", or "No". */
const airport = (needed: boolean | undefined, flight?: IndiaFlight) =>
  needed
    ? ["Yes", flight && formatIndiaFlight(flight)].filter(Boolean).join(" · ")
    : "No"

/** "Train · 12009 Shatabdi Exp · pickup · drop: Flight · 6E 2132": one person's own travel, or "—". */
const ownTravel = (t: PersonTravel | undefined) =>
  t
    ? [
        comingByText(t),
        t.needsPickup && "pickup",
        t.needsDrop && `drop: ${journeyHomeText(t)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "—"

/** "Male, 34 yrs, Son" — how someone added or removed is described. */
const describe = (m: Member) =>
  [GENDERS[m.gender], `${m.age} yrs`, m.relation].filter(Boolean).join(", ")

const youthConvention = (answer: boolean | undefined | null) =>
  answer == null ? "—" : answer ? "Yes" : "No"

const assistance = (m: Member) =>
  m.needsAssistance
    ? m.assistanceNote
      ? `Yes · ${m.assistanceNote}`
      : "Yes"
    : "No"

/** Every detail of one person that changed. */
function memberLines(
  before: Member,
  after: Member,
  beds: { before: RegistrationDetails; after: RegistrationDetails }
): ChangeLine[] {
  const fields: [string, string, string][] = [
    ["Name", before.fullName, after.fullName],
    ["Gender", GENDERS[before.gender], GENDERS[after.gender]],
    ["Age", String(before.age), String(after.age)],
    [
      "Mobile",
      orDash(before.mobile && formatMobile(before.mobile)),
      orDash(after.mobile && formatMobile(after.mobile)),
    ],
    ["Relation", orDash(before.relation), orDash(after.relation)],
    ["Needs assistance", assistance(before), assistance(after)],
    [
      "Youth Convention",
      youthConvention(before.attendsYouthConvention),
      youthConvention(after.attendsYouthConvention),
    ],
    ["Arrival", formatStay(before.arrival), formatStay(after.arrival)],
    ["Departure", formatStay(before.departure), formatStay(after.departure)],
    [
      "Needs a bed",
      yesNo(wantsBed(beds.before, before)),
      yesNo(wantsBed(beds.after, after)),
    ],
    [
      "Swayam Sevak, arriving early for seva",
      yesNo(isSevak(beds.before, before)),
      yesNo(isSevak(beds.after, after)),
    ],
    // Only while the party travels separately; otherwise the party's travel says it.
    ["Travel", ownTravel(before.travel), ownTravel(after.travel)],
  ]
  // Airport flights per person once either side has them per person; while
  // the party shares them, describeChange says it once for everyone.
  if (hasOwnFlights(beds.before) || hasOwnFlights(beds.after)) {
    const i0 = flightsOf(beds.before, before)
    const i1 = flightsOf(beds.after, after)
    fields.push(
      [
        "Ahmedabad airport pickup",
        airport(i0?.needsPickup, i0?.arrival),
        airport(i1?.needsPickup, i1?.arrival),
      ],
      [
        "Flight out of Ahmedabad",
        orDash(i0?.departure && formatIndiaFlight(i0.departure)),
        orDash(i1?.departure && formatIndiaFlight(i1.departure)),
      ]
    )
  }
  return fields
    .filter(([, a, b]) => a !== b)
    .map(([field, a, b]) => ({
      label: `${after.fullName} · ${field}`,
      before: a,
      after: b,
    }))
}

export function describeChange(
  before: RegistrationDetails,
  after: RegistrationDetails
): ChangeLine[] {
  const lines: ChangeLine[] = []
  const add = (label: string, a: string, b: string) => {
    if (a !== b) lines.push({ label, before: a, after: b })
  }

  add("Type", REGISTRATION_TYPES[before.type], REGISTRATION_TYPES[after.type])
  add("Family name", orDash(before.groupName), orDash(after.groupName))
  add("Mandal", before.mandal, after.mandal)
  add("Arrival", formatStay(before.arrival), formatStay(after.arrival))
  add("Departure", formatStay(before.departure), formatStay(after.departure))

  const t0 = before.travel
  const t1 = after.travel
  add("Travel", TRAVEL_MODES[t0.mode], TRAVEL_MODES[t1.mode])
  // Someone in a party travelling separately may bring the vehicles.
  const vehicles = (t: typeof t0) =>
    t.mode === "personal_vehicle" || t.vehicleCount
      ? String(t.vehicleCount ?? 1)
      : "—"
  add("Vehicles", vehicles(t0), vehicles(t1))
  add(
    "Vehicle numbers",
    orDash(t0.vehicleNumbers?.join(", ")),
    orDash(t1.vehicleNumbers?.join(", "))
  )
  add("Travel details", orDash(t0.reference), orDash(t1.reference))
  add("Station", orDash(t0.station), orDash(t1.station))
  add(
    "Pickup arrival time",
    orDash(t0.arrivalTime && formatTime(t0.arrivalTime)),
    orDash(t1.arrivalTime && formatTime(t1.arrivalTime))
  )
  add("Pickup in Ahmedabad", yesNo(t0.needsPickup), yesNo(t1.needsPickup))
  add(
    "Leaving by",
    orDash(t0.departureMode && TRAVEL_MODES[t0.departureMode]),
    orDash(t1.departureMode && TRAVEL_MODES[t1.departureMode])
  )
  add(
    "Journey home",
    orDash(t0.departureReference),
    orDash(t1.departureReference)
  )
  add("Leaving from", orDash(t0.departureStation), orDash(t1.departureStation))
  add(
    "Journey home time",
    orDash(t0.departureTime && formatTime(t0.departureTime)),
    orDash(t1.departureTime && formatTime(t1.departureTime))
  )
  add("Drop to station or airport", yesNo(t0.needsDrop), yesNo(t1.needsDrop))

  // The party's flights, while it shares them; each person's are in memberLines.
  if (!hasOwnFlights(before) && !hasOwnFlights(after)) {
    const i0 = before.indiaTravel
    const i1 = after.indiaTravel
    add(
      "Ahmedabad airport pickup",
      airport(i0?.needsPickup, i0?.arrival),
      airport(i1?.needsPickup, i1?.arrival)
    )
    add(
      "Flight out of Ahmedabad",
      orDash(i0?.departure && formatIndiaFlight(i0.departure)),
      orDash(i1?.departure && formatIndiaFlight(i1.departure))
    )
  }

  // People, matched on their id, which edits keep.
  const was = new Map(before.members.map((m) => [m.id, m]))
  const now = new Set(after.members.map((m) => m.id))
  for (const m of before.members) {
    if (!now.has(m.id)) {
      lines.push({ label: `Removed ${m.fullName}`, before: describe(m) })
    }
  }
  for (const m of after.members) {
    const old = was.get(m.id)
    if (!old) lines.push({ label: `Added ${m.fullName}`, after: describe(m) })
    else lines.push(...memberLines(old, m, { before, after }))
  }

  add("Notes", orDash(before.notes), orDash(after.notes))
  return lines
}
