import { EVENT, TIME_SLOTS, type TimeSlot } from "@/config/event"

import type {
  IndiaTravel,
  Member,
  PersonTravel,
  Registration,
  StayPoint,
  TravelMode,
} from "./types"

const SLOT_ORDER = Object.keys(TIME_SLOTS) as TimeSlot[]

/** Orders two stay points: negative when `a` comes first. Dates are ISO, so they compare as strings. */
export function compareStay(a: StayPoint, b: StayPoint) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)
}

/** Whether the member is at the venue at any point on the given day. */
export function isPresentOn(
  member: Pick<Member, "arrival" | "departure">,
  day: string
) {
  return member.arrival.date <= day && member.departure.date >= day
}

/** Nights between arrival and departure. Leaving the same day it arrived is zero nights. */
export function nightsBetween(arrival: StayPoint, departure: StayPoint) {
  const ms =
    Date.parse(`${departure.date}T00:00:00Z`) -
    Date.parse(`${arrival.date}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** Event days this registration's party covers, counting anyone in it. */
export function eventDaysCovered(registration: Registration) {
  return EVENT.days.filter((day) =>
    registration.members.some((member) => isPresentOn(member, day))
  ).length
}

/**
 * Two answers to "will you take the meal?" that disagree. Missing on either
 * side (saved before it was asked, or no meal in that slot) is not a
 * disagreement.
 */
const mealsDiffer = (a: StayPoint, b: StayPoint) =>
  a.meal != null && b.meal != null && a.meal !== b.meal

/**
 * True when at least one member's dates differ from the booking's — or their
 * meal answers do. Same days, different meals is still a split schedule:
 * treated as shared, the edit form opened on the party's answer alone and
 * saving put it on everyone.
 */
export function hasSplitSchedule(registration: Registration) {
  return registration.members.some(
    (member) =>
      compareStay(member.arrival, registration.arrival) !== 0 ||
      compareStay(member.departure, registration.departure) !== 0 ||
      mealsDiffer(member.arrival, registration.arrival) ||
      mealsDiffer(member.departure, registration.departure)
  )
}

/**
 * Whether this person asked for a bed. `accommodationRequired` on the
 * registration means "anyone in the party"; each person's own answer is on
 * them (the server fills it in for registrations from before it existed).
 */
export function wantsBed(
  registration: Pick<Registration, "accommodationRequired">,
  member: Pick<Member, "needsAccommodation">
) {
  return (
    registration.accommodationRequired && member.needsAccommodation !== false
  )
}

/**
 * Whether the party lands in and flies out of India on different days, so
 * each person has their own airport flights (`Member.indiaTravel`).
 */
export const hasOwnFlights = (registration: Pick<Registration, "members">) =>
  registration.members.some((member) => !!member.indiaTravel)

/**
 * This person's Ahmedabad airport pickup and flight out: their own when the
 * party's differ, else the party's. Never read `registration.indiaTravel`
 * for a person directly — on a split party it carries no flights, only
 * whether anyone needs a pickup.
 */
export function flightsOf(
  registration: Pick<Registration, "members" | "indiaTravel">,
  member: Pick<Member, "indiaTravel">
) {
  return hasOwnFlights(registration)
    ? member.indiaTravel
    : registration.indiaTravel
}

/**
 * The registration's airport flights for a screen that shows them once:
 * the party's, or — when they differ — each person's who has any, named.
 */
export function airportFlights(
  registration: Pick<Registration, "members" | "indiaTravel">
): { who?: string; flights: IndiaTravel }[] {
  if (!hasOwnFlights(registration)) {
    return registration.indiaTravel
      ? [{ flights: registration.indiaTravel }]
      : []
  }
  return registration.members.flatMap((member) =>
    member.indiaTravel
      ? [{ who: member.fullName, flights: member.indiaTravel }]
      : []
  )
}

/**
 * Whether this person is arriving early for seva as a Swayam Sevak.
 * `earlySeva` on the registration means "anyone in the party"; it was first
 * asked once for the whole party, so where a person has no answer of their
 * own (the server sends one for every registration now) it covers them.
 */
export function isSevak(
  registration: Pick<Registration, "earlySeva">,
  member: Pick<Member, "earlySeva">
) {
  return member.earlySeva ?? !!registration.earlySeva
}

/** "Yes", "No", or "2 of 4" when only some of the party asked for a bed. */
export function accommodationSummary(registration: Registration) {
  const wanting = registration.members.filter((m) =>
    wantsBed(registration, m)
  ).length
  if (wanting === 0) return "No"
  return wanting === registration.members.length
    ? "Yes"
    : `${wanting} of ${registration.members.length}`
}

/**
 * How this person travels: their own when the party travels separately, else
 * the party's. Vehicles are only ever on the registration's `travel`.
 */
export function travelOf(
  registration: Pick<Registration, "travel">,
  member: Pick<Member, "travel">
): PersonTravel {
  return member.travel ?? registration.travel
}

/** Every way the party travels: the one mode, or each person's when they travel separately. */
export function travelModesOf(registration: Registration): TravelMode[] {
  return [
    ...new Set(registration.members.map((m) => travelOf(registration, m).mode)),
  ]
}
