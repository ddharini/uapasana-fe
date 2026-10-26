/**
 * Accommodation, shaped as upasana-be sends it (src/lib/accommodation.ts,
 * src/lib/mandal-stays.ts).
 *
 * A place has rooms. The team gives a mandal some of them — a `MandalStay` —
 * and the mandal's coordinator decides who sleeps where, reporting how many
 * people are in each room. (Per-person allotment, which this replaced on
 * 2026-10-11, is kept in ./paused.)
 */

export const PLACE_KINDS = {
  guest_house: "Guest house",
  hotel: "Hotel",
} as const
export type PlaceKind = keyof typeof PLACE_KINDS

export const ROOM_KINDS = {
  gents: "Gents",
  ladies: "Ladies",
  family: "Family",
  /** Anyone: no gender or family rule, only the beds limit it. */
  general: "General",
} as const
export type RoomKind = keyof typeof ROOM_KINDS

/** The floors a room can be on, by number: 0 is the ground floor. */
export const FLOORS = [
  "Ground floor",
  "1st floor",
  "2nd floor",
  "3rd floor",
  "4th floor",
] as const

/** "Ground floor", "2nd floor" — for an unexpected number, "Floor 7". */
export const floorLabel = (floor: number) => FLOORS[floor] ?? `Floor ${floor}`

export type Room = {
  /** Stable: a mandal's rooms point at it, so relabelling a room keeps it theirs. */
  id: string
  label: string
  beds: number
  /** Mattresses the room can take on top of its beds. */
  extraBeds?: number
  kind: RoomKind
  /** 0 = ground floor, 1 = 1st floor … 4 = 4th floor. */
  floor: number
}

export type Place = {
  id: string
  name: string
  kind: PlaceKind
  address: string
  area?: string
  mapUrl?: string
  /** The place's own contact (the guest house's manager) — not a mandal's coordinator. */
  coordinatorName?: string
  /** E.164. */
  coordinatorMobile?: string
  notes?: string
  sortOrder: number
  rooms: Room[]
}

/** Rooms at a place given to one mandal, and how full its coordinator says they are. */
export type MandalStay = {
  id: string
  placeId: string
  mandal: string
  coordinatorName: string
  /** E.164. */
  coordinatorMobile: string
  notes?: string
  roomIds: string[]
  /** People in each room, as last reported. A room missing here is not reported yet. */
  occupancy: { roomId: string; people: number }[]
  occupancyUpdatedAt?: string
  occupancyUpdatedByName?: string
  createdByName: string
  updatedAt: string
}

export type AccommodationData = {
  places: Place[]
  /** Every mandal's for staff and admins; only their own for a sanchalak. */
  mandalStays: MandalStay[]
}

/** What the place editor saves. A room without an id is new. */
export type PlaceInput = Omit<Place, "id" | "sortOrder" | "rooms"> & {
  rooms: (Omit<Room, "id"> & { id?: string })[]
}

/** What giving a mandal rooms, or changing them, saves. */
export type MandalStayInput = Pick<
  MandalStay,
  | "placeId"
  | "mandal"
  | "coordinatorName"
  | "coordinatorMobile"
  | "notes"
  | "roomIds"
>
