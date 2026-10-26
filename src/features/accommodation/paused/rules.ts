// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import { STAY_DATES, formatStayDate } from "@/config/event"
import { wantsBed } from "@/features/registrations/stay"
import type { Member, Registration } from "@/features/registrations/types"

import {
  floorLabel,
  type AccommodationData,
  type Allotment,
  type NoticeState,
  type Place,
  type Room,
} from "./types"

/**
 * Who sleeps where, worked out from the registrations and the allotments.
 *
 * `roomProblem` mirrors the server's (upasana-be src/lib/accommodation.ts),
 * which checks it again on every allotment; here it decides which rooms the
 * allot dialog offers, and what the screens flag as needing attention.
 */

/**
 * Nights someone can need a bed: every stay date but the last. A night is
 * named by its evening's date.
 */
export const NIGHTS: readonly string[] = STAY_DATES.slice(0, -1)

/** The nights someone sleeps over: from their arrival day up to, not including, the day they leave. */
export function nightsOf(member: Pick<Member, "arrival" | "departure">) {
  return NIGHTS.filter(
    (night) => night >= member.arrival.date && night < member.departure.date
  )
}

/** "Fri 29 Jan" */
export function formatNight(night: string) {
  return formatStayDate(night).split(" · ")[0]
}

/** "29 Jan → 2 Feb · 4 nights" */
export function formatNights(member: Pick<Member, "arrival" | "departure">) {
  const count = nightsOf(member).length
  const day = (iso: string) => formatNight(iso).split(" ").slice(1).join(" ")
  return `${day(member.arrival.date)} → ${day(member.departure.date)} · ${
    count === 0 ? "no night" : `${count} ${count === 1 ? "night" : "nights"}`
  }`
}

/**
 * Children younger than this share a parent's bed: they get a room, so
 * everyone knows where they sleep, but no bed of their own.
 */
export const SHARES_BED_UNDER = 5

/**
 * Children younger than this may sleep in a gents or ladies room of the
 * other gender, with a grown-up from their own registration.
 */
export const WITH_PARENT_UNDER = 12

const ADULT_AGE = 18

/** Whether someone takes a bed of their own. */
export const takesBed = (member: Pick<Member, "age">) =>
  member.age >= SHARES_BED_UNDER

/** Beds plus extra mattresses: the most people a room can sleep in a night. */
export const capacityOf = (room: Pick<Room, "beds" | "extraBeds">) =>
  room.beds + (room.extraBeds ?? 0)

/** People who need a bed of their own on a night. */
export const bedTakers = (occupants: Occupant[], night: string) =>
  occupants.filter((o) => o.nights.includes(night) && takesBed(o.member)).length

/** Someone in a room. */
export type Occupant = {
  registration: Registration
  member: Member
  nights: string[]
  /** Let into another registration's family room by the team: relatives. */
  shared?: boolean
}

export type RoomIssue = {
  /** "family" is the one the team may allow, letting relatives share. */
  kind: "gender" | "family" | "child" | "beds"
  message: string
  /** A few words, for a room picker. */
  short: string
}

type RoomRules = Pick<Room, "label" | "beds" | "extraBeds" | "kind">

/**
 * What is wrong with these people sharing this room, or null.
 *
 * - Gents and ladies rooms take only men or only women — except children
 *   under 12 staying with a grown-up from their own registration.
 * - A family room takes one registration's people a night, of any gender;
 *   another family may have it on other nights, and relatives the team let
 *   share do not count as another family.
 * - A general room takes anyone: only its beds limit it.
 * - A child under 5 shares a parent's bed: needs a grown-up from their
 *   registration in the room, and takes no bed.
 * - On no night are there more bed-takers than beds and extra mattresses.
 */
export function roomProblem(room: RoomRules, occupants: Occupant[]): string | null {
  return roomIssue(room, occupants)?.message ?? null
}

export function roomIssue(room: RoomRules, occupants: Occupant[]): RoomIssue | null {
  /** A grown-up from their own registration in the room on every night they are. */
  const accompanied = (child: Occupant) =>
    child.nights.every((night) =>
      occupants.some(
        (o) =>
          o.registration.id === child.registration.id &&
          o.member.id !== child.member.id &&
          o.member.age >= ADULT_AGE &&
          o.nights.includes(night)
      )
    )

  const wrongGender =
    room.kind === "gents" ? "female" : room.kind === "ladies" ? "male" : undefined
  if (wrongGender) {
    const out = occupants.find(
      (o) =>
        o.member.gender === wrongGender &&
        !(o.member.age < WITH_PARENT_UNDER && accompanied(o))
    )
    if (out) {
      return out.member.age < WITH_PARENT_UNDER
        ? {
            kind: "gender",
            message: `Room ${room.label} is a ${room.kind} room — ${out.member.fullName} (${out.member.age}) can stay in it only with a grown-up from their family`,
            short: `${room.kind} only, unless with a parent`,
          }
        : {
            kind: "gender",
            message: `Room ${room.label} is a ${room.kind} room — ${out.member.fullName} is ${out.member.gender}`,
            short: `${room.kind} only`,
          }
    }
  }
  const baby = occupants.find((o) => !takesBed(o.member) && !accompanied(o))
  if (baby) {
    return {
      kind: "child",
      message: `${baby.member.fullName} (${baby.member.age}) shares a parent's bed, so needs a grown-up from their family in Room ${room.label}`,
      short: "needs a parent in the room",
    }
  }
  for (const night of NIGHTS) {
    const there = occupants.filter((o) => o.nights.includes(night))
    // One family a night: another family may have it on other nights, and
    // relatives the team let share are not "another family".
    if (
      room.kind === "family" &&
      new Set(there.filter((o) => !o.shared).map((o) => o.registration.id)).size > 1
    ) {
      return {
        kind: "family",
        message: `Room ${room.label} is a family room — another family has it on ${formatNight(night)}`,
        short: `another family on ${formatNight(night)}`,
      }
    }
    const sleepers = bedTakers(there, night)
    if (sleepers > capacityOf(room)) {
      const extra = room.extraBeds ? ` and ${room.extraBeds} extra` : ""
      return {
        kind: "beds",
        message: `Room ${room.label} has ${room.beds} ${room.beds === 1 ? "bed" : "beds"}${extra} but ${sleepers} people need one on ${formatNight(night)}`,
        short: `full on ${formatNight(night)}`,
      }
    }
  }
  return null
}

/** Whether someone should be on the ground floor: they asked for help, or are 60 or older. */
export const wantsGroundFloor = (member: Member) =>
  member.needsAssistance || member.age >= 60

export type Bed = { place: Place; room: Room; allotment: Allotment }

/** Lookups over one load of accommodation data and registrations. */
export type AccommodationIndex = {
  places: Place[]
  placeById: Map<string, Place>
  registrationById: Map<string, Registration>
  /** Where a person sleeps, if they have a room. */
  bedOf: (registrationId: string, memberId: string) => Bed | undefined
  /** Everyone in a room, with their nights. */
  occupantsOf: (placeId: string, roomId: string) => Occupant[]
  notices: Map<string, NoticeState>
  whatsApp: boolean
}

export function indexAccommodation(
  data: AccommodationData,
  registrations: Registration[]
): AccommodationIndex {
  const placeById = new Map(data.places.map((p) => [p.id, p]))
  const registrationById = new Map(registrations.map((r) => [r.id, r]))
  const beds = new Map<string, Bed>()
  const rooms = new Map<string, Occupant[]>()

  for (const allotment of data.allotments) {
    const place = placeById.get(allotment.placeId)
    const room = place?.rooms.find((r) => r.id === allotment.roomId)
    const registration = registrationById.get(allotment.registrationId)
    const member = registration?.members.find(
      (m) => m.id === allotment.memberId
    )
    if (!place || !room || !registration || !member) continue
    beds.set(`${registration.id}:${member.id}`, { place, room, allotment })
    const key = `${place.id}:${room.id}`
    rooms.set(key, [
      ...(rooms.get(key) ?? []),
      {
        registration,
        member,
        nights: nightsOf(member),
        shared: allotment.sharesRoom ?? false,
      },
    ])
  }

  return {
    places: data.places,
    placeById,
    registrationById,
    bedOf: (registrationId, memberId) =>
      beds.get(`${registrationId}:${memberId}`),
    occupantsOf: (placeId, roomId) => rooms.get(`${placeId}:${roomId}`) ?? [],
    notices: new Map(data.notices.map((n) => [n.registrationId, n])),
    whatsApp: data.whatsApp,
  }
}

export type StayStatus =
  "not_needed" | "unconfirmed" | "to_allot" | "partly" | "allotted"

export type RegistrationStay = {
  status: StayStatus
  /** People who asked for a bed and sleep over at least one night. */
  sleepers: Member[]
  /** Who has a room, and which. */
  allotted: (Bed & { member: Member })[]
  /** Sleepers still without a room. */
  missing: Member[]
  /** Must be sorted out: a room that no longer fits, a registration back to pending. */
  problems: string[]
  /** Worth a look, never blocking: someone who should be on the ground floor and is not. */
  warnings: string[]
}

/** Where a registration stands for accommodation. */
export function stayFor(
  registration: Registration,
  index: AccommodationIndex
): RegistrationStay {
  const sleepers = registration.members.filter(
    (m) => wantsBed(registration, m) && nightsOf(m).length > 0
  )
  const allotted = registration.members.flatMap((member) => {
    const bed = index.bedOf(registration.id, member.id)
    return bed ? [{ ...bed, member }] : []
  })
  const missing = sleepers.filter(
    (m) => !allotted.some((a) => a.member.id === m.id)
  )

  const problems: string[] = []
  const warnings: string[] = []
  for (const a of allotted) {
    if (nightsOf(a.member).length === 0) {
      problems.push(
        `${a.member.fullName} now leaves the day they arrive — take them out of Room ${a.room.label}`
      )
    }
    if (wantsGroundFloor(a.member) && a.room.floor > 0) {
      warnings.push(
        `${a.member.fullName} ${a.member.needsAssistance ? "needs assistance" : `is ${a.member.age}`} — Room ${a.room.label} is on the ${floorLabel(a.room.floor).toLowerCase()}`
      )
    }
  }
  const rooms = new Map(allotted.map((a) => [`${a.place.id}:${a.room.id}`, a]))
  for (const { place, room } of rooms.values()) {
    const problem = roomProblem(room, index.occupantsOf(place.id, room.id))
    if (problem) problems.push(`${place.name}: ${problem}`)
  }

  const status: StayStatus =
    !registration.accommodationRequired || registration.status === "cancelled"
      ? "not_needed"
      : allotted.length === 0
        ? "to_allot"
        : missing.length > 0
          ? "partly"
          : "allotted"

  return { status, sleepers, allotted, missing, problems, warnings }
}

/** Beds used on each night in one place. */
export function placeNights(place: Place, index: AccommodationIndex) {
  const beds = place.rooms.reduce((sum, room) => sum + room.beds, 0)
  const extraBeds = place.rooms.reduce((sum, room) => sum + (room.extraBeds ?? 0), 0)
  return NIGHTS.map((night) => ({
    night,
    beds,
    extraBeds,
    // Beds taken: a child under 5 sharing a parent's bed takes none.
    used: place.rooms.reduce(
      (sum, room) => sum + bedTakers(index.occupantsOf(place.id, room.id), night),
      0
    ),
  }))
}

/** For each night: people who need a bed, how many have one, and beds in all places. */
export function nightTotals(
  registrations: Registration[],
  index: AccommodationIndex
) {
  const wanting = registrations.filter(
    (r) => r.accommodationRequired && r.status !== "cancelled"
  )
  const perPlace = index.places.map((place) => placeNights(place, index))
  return NIGHTS.map((night, i) => ({
    night,
    // Beds, not people: a child under 5 shares a parent's.
    needed: wanting
      .flatMap((r) => r.members.filter((m) => wantsBed(r, m) && takesBed(m)))
      .filter((m) => nightsOf(m).includes(night)).length,
    allotted: perPlace.reduce((sum, nights) => sum + nights[i].used, 0),
    beds: perPlace.reduce((sum, nights) => sum + nights[i].beds, 0),
  }))
}

/**
 * How a room suits some of a registration's people: what would be wrong if
 * they moved in, and the fewest beds free on any of their nights (not
 * counting their own, if they are in it already).
 */
export function roomFit(
  place: Place,
  room: Room,
  registration: Registration,
  members: Member[],
  index: AccommodationIndex,
  /**
   * Everyone of this registration being given a room right now — they leave
   * whatever room they had, so they do not count where they are. Defaults to
   * `members`.
   */
  moving: Set<string> = new Set(members.map((m) => m.id))
) {
  const others = index
    .occupantsOf(place.id, room.id)
    .filter(
      (o) => !(o.registration.id === registration.id && moving.has(o.member.id))
    )
  const incoming: Occupant[] = members.map((member) => ({
    registration,
    member,
    nights: nightsOf(member),
  }))
  const nights = NIGHTS.filter((n) =>
    incoming.some((o) => o.nights.includes(n))
  )
  // Beds (not counting extra mattresses) free on their busiest night.
  const free = nights.length
    ? Math.min(...nights.map((n) => room.beds - bedTakers(others, n)))
    : room.beds
  // Extra mattresses they would need on the busiest night.
  const extraUsed = Math.max(
    0,
    ...nights.map((n) => bedTakers([...others, ...incoming], n) - room.beds)
  )
  const issue = roomIssue(room, [...others, ...incoming])
  // Another family has it: would it do if the team let them share (relatives
  // registered separately)? Only the family rule gives way.
  const canShare =
    issue?.kind === "family" &&
    !roomIssue(room, [...others, ...incoming.map((o) => ({ ...o, shared: true }))])
  const sharesWith = canShare
    ? [
        ...new Set(
          others
            .filter(
              (o) =>
                o.registration.id !== registration.id &&
                o.nights.some((n) => nights.includes(n))
            )
            .map((o) => o.registration.code)
        ),
      ]
    : []
  return {
    issue,
    problem: issue?.message ?? null,
    /** A few words on why not, for a room picker. */
    reason: issue?.short,
    /** Fits if the team lets them share with `sharesWith` — relatives. */
    canShare,
    sharesWith,
    free,
    extraUsed,
    others,
  }
}

/** Orders two scores, first difference wins: positive when `a` is better. */
const compare = (a: number[], b: number[]) => {
  const i = a.findIndex((v, k) => v !== b[k])
  return i === -1 ? 0 : a[i] - b[i]
}

/**
 * How many of the registration's people, other than those being placed now,
 * already sleep in this room — so someone joining a family later goes in with
 * them.
 */
function familyIn(
  placeId: string,
  roomId: string,
  registration: Registration,
  moving: Set<string>,
  index: AccommodationIndex
) {
  return index
    .occupantsOf(placeId, roomId)
    .filter(
      (o) => o.registration.id === registration.id && !moving.has(o.member.id)
    ).length
}

/** Who goes in which room: member id → room id. */
export type Plan = Map<string, string>

/**
 * A suggested plan for putting `members` in `place`.
 *
 * Everyone in one room if any room takes them all — their family's room if
 * the rest of the family already has one here, else on the ground floor if
 * someone needs it, else a room of the right kind (gents, ladies or general
 * for someone on their own; family for a family), filling part-used rooms
 * before empty ones. Otherwise as few rooms as it takes: each time, the room that takes the most of those left, preferring
 * the ground floor for anyone who needs it and rooms numbered near the first
 * one, so a family split in two ends up in Rooms 2 and 3 rather than 2 and 27.
 * Anyone no room here can take is left out of the plan.
 */
export function suggestPlan(
  place: Place,
  registration: Registration,
  members: Member[],
  index: AccommodationIndex
): Plan {
  const plan: Plan = new Map()
  if (members.length === 0) return plan
  const moving = new Set(members.map((m) => m.id))
  const rooms = sortRooms(place.rooms)
  const position = new Map(rooms.map((room, i) => [room.id, i]))
  const fits = (room: Room, group: Member[]) =>
    !roomFit(place, room, registration, group, index, moving).problem
  const groundWanted = (group: Member[]) => group.some(wantsGroundFloor)
  // A family room holds one family a night, so someone on their own there
  // leaves its other beds empty: individuals belong in gents, ladies or
  // general rooms, families in family rooms.
  const kindSuits = (room: Room) =>
    registration.type === "individual" ? room.kind !== "family" : room.kind === "family"
  // Beds left free on their busiest night once they are in: fewer is a
  // snugger fit, so part-used rooms fill up before empty ones are opened.
  // Children under 5 take no bed.
  const spare = (room: Room, group: Member[]) =>
    roomFit(place, room, registration, group, index, moving).free -
    group.filter(takesBed).length
  // Extra mattresses are for when nothing else works.
  const mattresses = (room: Room, group: Member[]) =>
    roomFit(place, room, registration, group, index, moving).extraUsed

  const whole = rooms.filter((room) => fits(room, members))
  if (whole.length > 0) {
    const ranked = (room: Room) => [
      familyIn(place.id, room.id, registration, moving, index),
      -mattresses(room, members),
      // Lower is better for anyone who needs it: ground, then 1st, …
      groundWanted(members) ? -room.floor : 0,
      kindSuits(room) ? 1 : 0,
      -spare(room, members),
    ]
    const best = [...whole].sort((a, b) => compare(ranked(b), ranked(a)))[0]
    members.forEach((m) => plan.set(m.id, best.id))
    return plan
  }

  // Those who need the ground floor are placed first, while it is free; and
  // children who may stay with either parent last, so they fill in around
  // the grown-ups and teenagers who have only one kind of room.
  const flexible = (m: Member) => m.age < WITH_PARENT_UNDER
  let left = [...members].sort(
    (a, b) =>
      Number(wantsGroundFloor(b)) - Number(wantsGroundFloor(a)) ||
      Number(flexible(a)) - Number(flexible(b))
  )
  const used = new Set<string>()
  let anchor: number | undefined
  // Most people first, then where their family already is, then the ground
  // floor if they need it, then the right kind of room, then nearest the
  // first room chosen, then the snuggest.
  const score = (room: Room, group: Member[]) => [
    group.length,
    familyIn(place.id, room.id, registration, moving, index),
    -mattresses(room, group),
    groundWanted(group) ? -room.floor : 0,
    kindSuits(room) ? 1 : 0,
    anchor === undefined ? 0 : -Math.abs(position.get(room.id)! - anchor),
    -spare(room, group),
  ]
  while (left.length > 0) {
    let best: { room: Room; group: Member[] } | undefined
    for (const room of rooms) {
      if (used.has(room.id)) continue
      // Repeated until nobody more fits: a child can only join once the
      // parent they stay with is in.
      const group: Member[] = []
      for (let added = true; added; ) {
        added = false
        for (const m of left) {
          if (!group.includes(m) && fits(room, [...group, m])) {
            group.push(m)
            added = true
          }
        }
      }
      if (group.length === 0) continue
      if (!best || compare(score(room, group), score(best.room, best.group)) > 0) {
        best = { room, group }
      }
    }
    if (!best) break
    const chosen = best
    chosen.group.forEach((m) => plan.set(m.id, chosen.room.id))
    used.add(chosen.room.id)
    anchor ??= position.get(chosen.room.id)
    left = left.filter((m) => !chosen.group.includes(m))
  }
  return plan
}

/**
 * Places in the order to suggest them: where the rest of their family already
 * stays, then those where one room takes everyone, then where their mandal
 * is, then the most room.
 */
export function suggestPlaces(
  registration: Registration,
  members: Member[],
  index: AccommodationIndex
) {
  const nights = NIGHTS.filter((n) =>
    members.some((m) => nightsOf(m).includes(n))
  )
  return index.places
    .map((place) => {
      const sameMandal = place.rooms
        .flatMap((room) => index.occupantsOf(place.id, room.id))
        .filter(
          (o) =>
            o.registration.mandal === registration.mandal &&
            o.registration.id !== registration.id
        ).length
      const usage = placeNights(place, index).filter((n) =>
        nights.includes(n.night)
      )
      const free = usage.length
        ? Math.min(...usage.map((n) => n.beds - n.used))
        : place.rooms.reduce((sum, r) => sum + r.beds, 0)
      // The rest of their family already sleeps here.
      const moving = new Set(members.map((m) => m.id))
      const familyHere = place.rooms.reduce(
        (sum, room) => sum + familyIn(place.id, room.id, registration, moving, index),
        0
      )
      // One room here takes all of them, so the party stays together.
      const together =
        members.length > 0 &&
        place.rooms.some(
          (room) => !roomFit(place, room, registration, members, index).problem
        )
      return { place, sameMandal, free, together, familyHere }
    })
    .sort(
      (a, b) =>
        b.familyHere - a.familyHere ||
        Number(b.together) - Number(a.together) ||
        b.sameMandal - a.sameMandal ||
        b.free - a.free ||
        a.place.sortOrder - b.place.sortOrder
    )
}

const byLabel = new Intl.Collator("en", { numeric: true }).compare

/** Rooms in number order: 2 before 10. */
export const sortRooms = (rooms: Room[]) =>
  [...rooms].sort((a, b) => byLabel(a.label, b.label))
