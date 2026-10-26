import { wantsBed } from "@/features/registrations/stay"
import type { Registration } from "@/features/registrations/types"

import type { MandalStay, Place, Room } from "./types"

/**
 * Counting rooms given to mandals, and how full their coordinators say they
 * are. Occupancy is one number per room — the people in it now — not per
 * night: the coordinator keeps it current through the event.
 */

const byLabel = new Intl.Collator("en", { numeric: true }).compare

/** Rooms in number order: 2 before 10. */
export const sortRooms = (rooms: Room[]) =>
  [...rooms].sort((a, b) => byLabel(a.label, b.label))

/** "Rooms 1–4, 7, 9" — runs of consecutive numbers collapsed. */
export function roomList(place: Place, roomIds: string[]) {
  const labels = sortRooms(
    place.rooms.filter((r) => roomIds.includes(r.id))
  ).map((r) => r.label)
  const parts: string[] = []
  for (let i = 0; i < labels.length; i++) {
    let j = i
    while (
      j + 1 < labels.length &&
      /^\d+$/.test(labels[j]) &&
      /^\d+$/.test(labels[j + 1]) &&
      Number(labels[j + 1]) === Number(labels[j]) + 1
    )
      j++
    parts.push(
      j > i + 1
        ? `${labels[i]}–${labels[j]}`
        : j === i + 1
          ? `${labels[i]}, ${labels[j]}`
          : labels[i]
    )
    i = j
  }
  return `${labels.length === 1 ? "Room" : "Rooms"} ${parts.join(", ")}`
}

/** Beds plus extra mattresses. */
export const capacityOf = (room: Pick<Room, "beds" | "extraBeds">) =>
  room.beds + (room.extraBeds ?? 0)

export type Occupancy = {
  rooms: number
  beds: number
  /** Rooms the coordinator has reported a number for, 0 included. */
  reported: number
  /** Rooms with anyone in them. */
  occupied: number
  people: number
}

const none: Occupancy = {
  rooms: 0,
  beds: 0,
  reported: 0,
  occupied: 0,
  people: 0,
}

export const addOccupancy = (a: Occupancy, b: Occupancy): Occupancy => ({
  rooms: a.rooms + b.rooms,
  beds: a.beds + b.beds,
  reported: a.reported + b.reported,
  occupied: a.occupied + b.occupied,
  people: a.people + b.people,
})

/** People reported in a room, or undefined when it has not been reported. */
export const peopleIn = (stay: MandalStay, roomId: string) =>
  stay.occupancy.find((o) => o.roomId === roomId)?.people

/** One mandal's rooms at a place, totalled. Rooms since removed from the place are skipped. */
export function occupancyOf(
  stay: MandalStay,
  place: Place | undefined
): Occupancy {
  if (!place) return none
  return stay.roomIds.reduce<Occupancy>((sum, roomId) => {
    const room = place.rooms.find((r) => r.id === roomId)
    if (!room) return sum
    const people = peopleIn(stay, roomId)
    return addOccupancy(sum, {
      rooms: 1,
      beds: room.beds,
      reported: people === undefined ? 0 : 1,
      occupied: people ? 1 : 0,
      people: people ?? 0,
    })
  }, none)
}

/** Which mandal has each room at a place. */
export function holders(place: Place, stays: MandalStay[]) {
  const map = new Map<string, MandalStay>()
  for (const stay of stays) {
    if (stay.placeId !== place.id) continue
    for (const roomId of stay.roomIds) map.set(roomId, stay)
  }
  return map
}

/** A place's rooms: all of them, those given to mandals, and how full those are. */
export function placeSummary(place: Place, stays: MandalStay[]) {
  const here = stays.filter((s) => s.placeId === place.id)
  const given = here.reduce(
    (sum, s) => addOccupancy(sum, occupancyOf(s, place)),
    none
  )
  return {
    stays: here,
    rooms: place.rooms.length,
    beds: place.rooms.reduce((sum, r) => sum + r.beds, 0),
    given,
    free: place.rooms.length - given.rooms,
  }
}

/**
 * People in each mandal who asked for a bed, from registrations not
 * cancelled — what the mandal's rooms have to hold.
 */
export function peopleAskingByMandal(registrations: Registration[]) {
  const counts = new Map<string, number>()
  for (const r of registrations) {
    if (r.status === "cancelled" || !r.accommodationRequired) continue
    const asking = r.members.filter((m) => wantsBed(r, m)).length
    if (asking > 0) counts.set(r.mandal, (counts.get(r.mandal) ?? 0) + asking)
  }
  return counts
}
