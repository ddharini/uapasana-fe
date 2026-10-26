import { EVENT, MANDALS, NO_MANDAL } from "@/config/event"

import { isPresentOn, travelOf, wantsBed } from "./stay"
import {
  TRAVEL_MODES,
  type Registration,
  type RegistrationStatus,
  type TravelMode,
} from "./types"

/**
 * The numbers on the overview, computed from the full registration list.
 *
 * Cancelled registrations are left out of every headcount: they are kept for
 * the record, but nobody is cooking or making beds for them. Once the backend
 * exists this becomes one aggregate endpoint; the shape stays the same.
 */
export function summarize(registrations: Registration[]) {
  const active = registrations.filter((r) => r.status !== "cancelled")
  const people = active.flatMap((r) => r.members)

  const byStatus = Object.fromEntries(
    (
      [
        "confirmed",
        "checked_in",
        "cancelled",
      ] as RegistrationStatus[]
    ).map((status) => [
      status,
      registrations.filter((r) => r.status === status).length,
    ])
  ) as Record<RegistrationStatus, number>

  /** Who is on site each event day, and who needs a bed that night. */
  const days = EVENT.days.map((day) => {
    const present = active.flatMap((r) =>
      r.members
        .filter((m) => isPresentOn(m, day))
        .map((m) => ({ member: m, registration: r }))
    )
    return {
      day,
      total: present.length,
      male: present.filter((p) => p.member.gender === "male").length,
      female: present.filter((p) => p.member.gender === "female").length,
      arriving: active
        .flatMap((r) => r.members)
        .filter((m) => m.arrival.date === day).length,
      leaving: active
        .flatMap((r) => r.members)
        .filter((m) => m.departure.date === day).length,
      // Staying the night means they are still here the next morning.
      overnight: present.filter(
        (p) =>
          // A child under 5 shares a parent's bed.
          wantsBed(p.registration, p.member) &&
          p.member.age >= 5 &&
          p.member.departure.date > day
      ).length,
    }
  })

  const mandals = [...MANDALS, NO_MANDAL]
    .map((mandal) => {
      const inMandal = active.filter((r) => r.mandal === mandal)
      return {
        mandal,
        registrations: inMandal.length,
        people: inMandal.reduce((sum, r) => sum + r.members.length, 0),
      }
    })
    .filter((row) => row.registrations > 0)
    .sort((a, b) => b.people - a.people)

  // Each person's way here: their own when the party travels separately.
  const travellers = active.flatMap((r) =>
    r.members.map((m) => travelOf(r, m))
  )
  const travel = (Object.keys(TRAVEL_MODES) as TravelMode[])
    // Counted per person, so nobody is "travelling separately" on their own.
    .filter((mode) => mode !== "separate")
    .map((mode) => ({
      mode,
      people: travellers.filter((t) => t.mode === mode).length,
    }))
    .sort((a, b) => b.people - a.people)

  return {
    registrations: registrations.length,
    activeRegistrations: active.length,
    byStatus,
    people: people.length,
    male: people.filter((m) => m.gender === "male").length,
    female: people.filter((m) => m.gender === "female").length,
    children: people.filter((m) => m.age < 12).length,
    seniors: people.filter((m) => m.age >= 60).length,
    needsAssistance: people.filter((m) => m.needsAssistance).length,
    // People who sleep over at least one night; a same-day visitor in the
    // party needs no bed.
    needsAccommodation: active
      .flatMap((r) => r.members.filter((m) => wantsBed(r, m)))
      .filter((m) => m.departure.date > m.arrival.date).length,
    needsPickup: travellers.filter((t) => t.needsPickup).length,
    needsDrop: travellers.filter((t) => t.needsDrop).length,
    vehicles: active.reduce((sum, r) => sum + (r.travel.vehicleCount ?? 0), 0),
    days,
    mandals,
    travel,
  }
}

export type Summary = ReturnType<typeof summarize>
