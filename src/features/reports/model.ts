import {
  EVENT,
  MANDALS,
  NO_MANDAL,
  OVERSEAS_MANDALS,
  TIME_SLOTS,
  TRAIN_STATIONS,
  formatDay,
  isLocalMandal,
  type TimeSlot,
} from "@/config/event"
import type { GuestMeal, GuestVisit } from "@/features/guests/api"
import {
  displayName,
  formatIndiaFlight,
  formatMeal,
} from "@/features/registrations/format"
import {
  isPresentOn,
  travelOf,
  flightsOf,
  hasOwnFlights,
  isSevak,
  wantsBed,
} from "@/features/registrations/stay"
import {
  GENDERS,
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  TRAVEL_MODES,
  type Member,
  type PersonTravel,
  type Registration,
  type RegistrationStatus,
  type TravelMode,
} from "@/features/registrations/types"
import { formatMobile } from "@/lib/phone"
import { formatTime } from "@/lib/time"

import type { ReportExport } from "./export"

/**
 * Reports: any slice of the registered devotees, counted, broken down and
 * listed — "who arrives by train on the 29th", "how many take dinner on the
 * 30th", "which NRIs need an airport pickup".
 *
 * Everything works on one row per person (a member of a registration), since
 * dates, meals and beds are per person; so is travel (the party's, or each
 * person's own when they travel separately — `tripOf`), while the vehicles and
 * the airport pickup belong to the registration and apply to everyone in it. The whole report lives
 * in the URL, so a report can be bookmarked or sent to another admin.
 */

export type Person = { registration: Registration; member: Member }

/** Ways one person travels: every mode but "separate", which only a party has. */
const PERSON_MODES = Object.entries(TRAVEL_MODES).filter(
  ([mode]) => mode !== "separate"
)

/* ------------------------------------------------------------------ */
/* Meals                                                               */
/* ------------------------------------------------------------------ */

export const MEALS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
} as const
export type Meal = keyof typeof MEALS

const SLOTS = Object.keys(TIME_SLOTS) as TimeSlot[]
const MEAL_OF_SLOT: Record<TimeSlot, Meal> = {
  morning: "breakfast",
  afternoon: "lunch",
  evening: "dinner",
}

/**
 * Whether the person eats the given meal on the given day. Every meal between
 * arriving and leaving counts; the meal served in the arrival and the leaving
 * slot counts only if they said they would take it. Registrations from before
 * that was asked count as taking it — the kitchen would rather cook a plate
 * too many.
 */
export function takesMeal(member: Member, day: string, meal: Meal) {
  if (!isPresentOn(member, day)) return false
  const slot = SLOTS.findIndex((s) => MEAL_OF_SLOT[s] === meal)
  const { arrival, departure } = member
  if (day === arrival.date) {
    const from = SLOTS.indexOf(arrival.slot)
    if (slot < from || (slot === from && arrival.meal === false)) return false
  }
  if (day === departure.date) {
    const to = SLOTS.indexOf(departure.slot)
    if (slot > to || (slot === to && departure.meal === false)) return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export const REGIONS = {
  local: "Local (Ahmedabad & nearby)",
  outstation: "Outstation (rest of India)",
  overseas: "Overseas (NRI)",
} as const
export type Region = keyof typeof REGIONS

export function regionOf(mandal: string): Region {
  if (OVERSEAS_MANDALS.includes(mandal)) return "overseas"
  return isLocalMandal(mandal) ? "local" : "outstation"
}

const AGE_BANDS = [
  { key: "0-4", label: "Under 5", max: 4 },
  { key: "5-11", label: "5 – 11", max: 11 },
  { key: "12-17", label: "12 – 17", max: 17 },
  { key: "18-40", label: "18 – 40", max: 40 },
  { key: "41-59", label: "41 – 59", max: 59 },
  { key: "60+", label: "60 and over", max: Infinity },
] as const

const ageBand = (age: number) => AGE_BANDS.find((band) => age <= band.max)!

/** Whole numbers from `min` to `max`, both counted; `max` may be Infinity. */
export type Range = { min: number; max: number }

/**
 * A range as the range filters (age, party size) write it: "80+" (80 and
 * over), "-14" (14 and under), "25-35", "40" (just 40). Without these the filters offered only
 * fixed groups, and the Assistant, asked for devotees over 80, answered with
 * everyone over 60 under a title that said 80.
 */
export function parseRange(value: string): Range | null {
  const match = /^(?:(\d{1,3})\+|(\d{1,3})?-(\d{1,3})?|(\d{1,3}))$/.exec(value)
  if (!match) return null
  const [, over, from, to, exactly] = match
  if (exactly != null) return { min: Number(exactly), max: Number(exactly) }
  if (over != null) return { min: Number(over), max: Infinity }
  if (from == null && to == null) return null
  const range = {
    min: from == null ? 0 : Number(from),
    max: to == null ? Infinity : Number(to),
  }
  return range.min <= range.max ? range : null
}

/** A range as the filter's value: the inverse of `parseRange`. */
export const rangeValue = ({ min, max }: Range) =>
  max === Infinity ? `${min}+` : min === max ? `${min}` : `${min || ""}-${max}`

const inRange = (n: number, range: Range | null) =>
  range != null && n >= range.min && n <= range.max

/** The age filter's named groups, which are not bands. */
const AGE_GROUPS: Record<string, Range> = {
  child: { min: 0, max: 11 },
  adult: { min: 18, max: Infinity },
  youth: { min: 0, max: 40 },
}

/** An age filter's value: a named group, or any range — the bands' keys ("5-11", "60+") are ranges. */
export const parseAgeRange = (value: string) =>
  Object.hasOwn(AGE_GROUPS, value) ? AGE_GROUPS[value] : parseRange(value)

/** "80 and over", "14 and under", "25 – 35". */
export function ageRangeLabel({ min, max }: Range) {
  if (max === Infinity) return `${min} and over`
  if (min === 0) return `${max} and under`
  return min === max ? `${min}` : `${min} – ${max}`
}

/** "6 or more people", "Up to 2 people", "3 – 5 people". */
export function partySizeLabel({ min, max }: Range) {
  if (max === Infinity) return `${min} or more people`
  if (min <= 1) return max === 1 ? "1 person" : `Up to ${max} people`
  return min === max ? `${min} people` : `${min} – ${max} people`
}

/**
 * How they leave Ahmedabad: the journey home they gave with a drop, else the
 * way they came.
 */
export const leavingBy = (travel: PersonTravel): TravelMode =>
  travel.departureMode ?? travel.mode

/**
 * How this person travels: their own way when the party travels separately,
 * else the party's. The vehicles are only on the registration's travel.
 */
const tripOf = ({ registration, member }: Person) =>
  travelOf(registration, member)

/** Sleeps here the night of `day`: wants a bed, is here that day and still here the next morning. */
export const staysNight = ({ registration, member }: Person, day: string) =>
  wantsBed(registration, member) &&
  member.age >= 5 &&
  isPresentOn(member, day) &&
  member.departure.date > day

const yesNo = (value: boolean | undefined) =>
  value == null ? "" : value ? "Yes" : "No"

const contactOf = (r: Registration) =>
  r.members.find((m) => m.isPrimary) ?? r.members[0]

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

/** Which registrations count. Cancelled ones are kept for the record only. */
export const STATUS_SETS = {
  active: {
    label: "Not cancelled",
    statuses: ["confirmed", "checked_in"],
  },
  confirmed: { label: "Not checked in yet", statuses: ["confirmed"] },
  checked_in: { label: "Checked in only", statuses: ["checked_in"] },
  cancelled: { label: "Cancelled only", statuses: ["cancelled"] },
  all: {
    label: "All, with cancelled",
    statuses: ["confirmed", "checked_in", "cancelled"],
  },
} as const satisfies Record<
  string,
  { label: string; statuses: RegistrationStatus[] }
>
export type StatusSet = keyof typeof STATUS_SETS

type Option = readonly [value: string, label: string]

const DAY_OPTIONS: Option[] = EVENT.days.map((day) => [day, formatDay(day)])
const SLOT_OPTIONS: Option[] = SLOTS.map((slot) => [
  slot,
  TIME_SLOTS[slot].split(" (")[0],
])
const YES_NO: Option[] = [
  ["yes", "Yes"],
  ["no", "No"],
]

/**
 * A filter: its URL key, how it is offered, and the test a person must pass.
 * `test` gets the raw URL value, never empty.
 */
type FilterDef = {
  key: string
  label: string
  group: FilterGroup
  options: Option[]
  test: (person: Person, value: string) => boolean
  /**
   * For a filter that takes values beyond its options (an age range, a
   * landing day): whether a value is one, and how to show it.
   */
  free?: {
    accepts: (value: string) => boolean
    label: (value: string) => string
  }
}

/** Whether a filter can take this value. */
export const filterAccepts = (filter: FilterDef, value: string) =>
  filter.options.some(([v]) => v === value) ||
  (filter.free?.accepts(value) ?? false)

/** A filter's value as people read it: "60 and over", "29 Jan". */
export const filterValueLabel = (filter: FilterDef, value: string) =>
  filter.options.find(([v]) => v === value)?.[1] ??
  filter.free?.label(value) ??
  value

export const FILTER_GROUPS = {
  who: "Who",
  when: "When",
  travel: "Travel",
  needs: "Needs",
} as const
type FilterGroup = keyof typeof FILTER_GROUPS

const flag = (value: boolean, wanted: string) => value === (wanted === "yes")

export const FILTERS: FilterDef[] = [
  // Who
  {
    key: "mandal",
    label: "Mandal",
    group: "who",
    options: [...MANDALS, NO_MANDAL].map((m) => [m, m]),
    test: ({ registration }, v) => registration.mandal === v,
  },
  {
    key: "region",
    label: "Coming from",
    group: "who",
    options: Object.entries(REGIONS),
    test: ({ registration }, v) => regionOf(registration.mandal) === v,
  },
  {
    key: "gender",
    label: "Gender",
    group: "who",
    options: Object.entries(GENDERS),
    test: ({ member }, v) => member.gender === v,
  },
  {
    key: "age",
    label: "Age",
    group: "who",
    options: [
      ...AGE_BANDS.map((band): Option => [band.key, band.label]),
      ["child", "Children (under 12)"],
      ["adult", "Adults (18 and over)"],
      ["youth", "40 and under"],
    ],
    test: ({ member }, v) => inRange(member.age, parseAgeRange(v)),
    free: {
      accepts: (v) => parseAgeRange(v) != null,
      label: (v) => ageRangeLabel(parseAgeRange(v)!),
    },
  },
  {
    // The whole registration, whoever else the filters pick: a family of six
    // needs a car of that size however many of them are children.
    key: "size",
    label: "Party size",
    group: "who",
    options: [
      ["1", "1 person"],
      ["2-4", "2 – 4 people"],
      ["5+", "5 or more people"],
    ],
    test: ({ registration }, v) =>
      inRange(registration.members.length, parseRange(v)),
    free: {
      accepts: (v) => parseRange(v) != null,
      label: (v) => partySizeLabel(parseRange(v)!),
    },
  },
  {
    key: "type",
    label: "Registration",
    group: "who",
    options: Object.entries(REGISTRATION_TYPES),
    test: ({ registration }, v) => registration.type === v,
  },
  {
    key: "youth",
    label: "Youth Convention",
    group: "who",
    options: [
      ["yes", "Attending"],
      ["no", "Not attending"],
    ],
    test: ({ member }, v) =>
      member.attendsYouthConvention != null &&
      flag(member.attendsYouthConvention, v),
  },
  {
    key: "seva",
    label: "Swayam Sevak (early seva)",
    group: "who",
    options: YES_NO,
    test: ({ registration, member }, v) =>
      flag(isSevak(registration, member), v),
  },

  // When
  {
    key: "on",
    label: "On site on",
    group: "when",
    options: DAY_OPTIONS,
    test: ({ member }, v) => isPresentOn(member, v),
  },
  {
    key: "arrive",
    label: "Arriving on",
    group: "when",
    options: DAY_OPTIONS,
    test: ({ member }, v) => member.arrival.date === v,
  },
  {
    key: "arriveSlot",
    label: "Arriving in the",
    group: "when",
    options: SLOT_OPTIONS,
    test: ({ member }, v) => member.arrival.slot === v,
  },
  {
    key: "leave",
    label: "Leaving on",
    group: "when",
    options: DAY_OPTIONS,
    test: ({ member }, v) => member.departure.date === v,
  },
  {
    key: "leaveSlot",
    label: "Leaving in the",
    group: "when",
    options: SLOT_OPTIONS,
    test: ({ member }, v) => member.departure.slot === v,
  },
  {
    key: "night",
    label: "Needs a bed the night of",
    group: "when",
    options: DAY_OPTIONS.slice(0, -1),
    test: (person, v) => staysNight(person, v),
  },
  {
    key: "mealDay",
    label: "Eating on",
    group: "when",
    options: DAY_OPTIONS,
    // Read together with `meal`; on its own, any meal that day.
    test: ({ member }, v) =>
      (Object.keys(MEALS) as Meal[]).some((meal) => takesMeal(member, v, meal)),
  },
  {
    key: "meal",
    label: "Meal",
    group: "when",
    options: Object.entries(MEALS),
    // With `mealDay` the pair is tested in `applyFilters`; on its own, that
    // meal on any day.
    test: ({ member }, v) =>
      EVENT.days.some((day) => takesMeal(member, day, v as Meal)),
  },

  // Travel
  {
    key: "travel",
    label: "Coming by",
    group: "travel",
    options: PERSON_MODES,
    test: (p, v) => tripOf(p).mode === v,
  },
  {
    key: "station",
    label: "Train station",
    group: "travel",
    options: TRAIN_STATIONS.map((s) => [s, s]),
    test: (p, v) => tripOf(p).station === v,
  },
  {
    key: "pickup",
    label: "Station / bus pickup",
    group: "travel",
    options: YES_NO,
    test: (p, v) => flag(tripOf(p).needsPickup, v),
  },
  {
    key: "leaveBy",
    label: "Leaving by",
    group: "travel",
    options: PERSON_MODES,
    test: (p, v) => leavingBy(tripOf(p)) === v,
  },
  {
    key: "drop",
    label: "Drop when leaving",
    group: "travel",
    options: YES_NO,
    test: (p, v) => flag(!!tripOf(p).needsDrop, v),
  },
  {
    key: "airport",
    label: "Airport pickup (NRI)",
    group: "travel",
    options: YES_NO,
    test: ({ registration, member }, v) =>
      flag(!!flightsOf(registration, member)?.needsPickup, v),
  },
  {
    key: "flightDay",
    label: "Landing on",
    group: "travel",
    options: [],
    test: ({ registration, member }, v) =>
      flightsOf(registration, member)?.arrival?.date === v,
    free: { accepts: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v), label: formatDay },
  },

  // Needs
  {
    key: "bed",
    label: "Accommodation",
    group: "needs",
    options: YES_NO,
    test: ({ registration, member }, v) =>
      flag(wantsBed(registration, member), v),
  },
  {
    key: "assist",
    label: "Needs assistance",
    group: "needs",
    options: YES_NO,
    test: ({ member }, v) => flag(member.needsAssistance, v),
  },
]

/**
 * Days that come from the data: NRIs can land days before the event, and a
 * Swayam Sevak arriving early for seva can come or go on any day of January
 * or February — so "Arriving on" and "Leaving on" offer the event days plus
 * any other day someone actually picked.
 */
export function withDataDays(filters: FilterDef[], people: Person[]) {
  const daysOf = (dates: (string | undefined)[]) =>
    [...new Set(dates.filter((d): d is string => !!d))]
      .sort()
      .map((d): Option => [d, formatDay(d)])
  const landing = daysOf(
    people.map((p) => flightsOf(p.registration, p.member)?.arrival?.date)
  )
  const arriving = daysOf([
    ...EVENT.days,
    ...people.map((p) => p.member.arrival.date),
  ])
  const leaving = daysOf([
    ...EVENT.days,
    ...people.map((p) => p.member.departure.date),
  ])
  return filters.map((f) =>
    f.key === "flightDay"
      ? { ...f, options: landing }
      : f.key === "arrive"
        ? { ...f, options: arriving }
        : f.key === "leave"
          ? { ...f, options: leaving }
          : f
  )
}

/* ------------------------------------------------------------------ */
/* Breakdowns                                                          */
/* ------------------------------------------------------------------ */

type DimensionDef = {
  label: string
  /** `sort` orders the groups; defaults to the label. */
  of: (person: Person) => { label: string; sort?: string | number }
}

const daySort = (date: string | undefined) =>
  date ? { label: formatDay(date), sort: date } : { label: "—", sort: "~" }

export const DIMENSIONS = {
  mandal: { label: "Mandal", of: (p) => ({ label: p.registration.mandal }) },
  region: {
    label: "Coming from",
    of: (p) => {
      const region = regionOf(p.registration.mandal)
      return {
        label: REGIONS[region],
        sort: Object.keys(REGIONS).indexOf(region),
      }
    },
  },
  gender: { label: "Gender", of: (p) => ({ label: GENDERS[p.member.gender] }) },
  age: {
    label: "Age group",
    of: (p) => {
      const band = ageBand(p.member.age)
      return { label: band.label, sort: AGE_BANDS.indexOf(band) }
    },
  },
  type: {
    label: "Registration",
    of: (p) => ({ label: REGISTRATION_TYPES[p.registration.type] }),
  },
  status: {
    label: "Status",
    of: (p) => ({
      label: REGISTRATION_STATUSES[p.registration.status],
      sort: Object.keys(REGISTRATION_STATUSES).indexOf(p.registration.status),
    }),
  },
  arrive: { label: "Arriving on", of: (p) => daySort(p.member.arrival.date) },
  arriveSlot: {
    label: "Arriving in the",
    of: (p) => ({
      label: TIME_SLOTS[p.member.arrival.slot].split(" (")[0],
      sort: SLOTS.indexOf(p.member.arrival.slot),
    }),
  },
  leave: { label: "Leaving on", of: (p) => daySort(p.member.departure.date) },
  leaveSlot: {
    label: "Leaving in the",
    of: (p) => ({
      label: TIME_SLOTS[p.member.departure.slot].split(" (")[0],
      sort: SLOTS.indexOf(p.member.departure.slot),
    }),
  },
  travel: {
    label: "Coming by",
    of: (p) => ({ label: TRAVEL_MODES[tripOf(p).mode] }),
  },
  station: {
    label: "Train station",
    of: (p) => ({ label: tripOf(p).station ?? "No station" }),
  },
  pickup: {
    label: "Station / bus pickup",
    of: (p) => ({ label: tripOf(p).needsPickup ? "Yes" : "No" }),
  },
  leaveBy: {
    label: "Leaving by",
    of: (p) => ({ label: TRAVEL_MODES[leavingBy(tripOf(p))] }),
  },
  flightDay: {
    label: "Landing on (NRI)",
    of: (p) => daySort(flightsOf(p.registration, p.member)?.arrival?.date),
  },
  bed: {
    label: "Accommodation",
    of: (p) => ({ label: wantsBed(p.registration, p.member) ? "Yes" : "No" }),
  },
  assist: {
    label: "Needs assistance",
    of: (p) => ({ label: p.member.needsAssistance ? "Yes" : "No" }),
  },
  youth: {
    label: "Youth Convention",
    of: (p) => ({
      label:
        p.member.attendsYouthConvention == null
          ? "Not asked"
          : p.member.attendsYouthConvention
            ? "Attending"
            : "Not attending",
    }),
  },
  seva: {
    label: "Swayam Sevak (early seva)",
    of: (p) => ({ label: isSevak(p.registration, p.member) ? "Yes" : "No" }),
  },
} satisfies Record<string, DimensionDef>
export type Dimension = keyof typeof DIMENSIONS

const groupOf = (dim: Dimension, person: Person) =>
  (DIMENSIONS[dim] as DimensionDef).of(person)

export type Breakdown = {
  rows: {
    label: string
    cells: number[]
    people: number
    registrations: number
  }[]
  /** Empty without a second dimension. */
  columns: string[]
  columnTotals: number[]
}

/** People counted by one dimension, or two as a grid. */
export function breakDown(
  people: Person[],
  by: Dimension,
  across?: Dimension
): Breakdown {
  const groups = <T>(
    items: Person[],
    dim: Dimension,
    make: (items: Person[]) => T
  ) => {
    const map = new Map<string, { sort: string | number; items: Person[] }>()
    for (const person of items) {
      const { label, sort } = groupOf(dim, person)
      const entry = map.get(label) ?? { sort: sort ?? label, items: [] }
      entry.items.push(person)
      map.set(label, entry)
    }
    return [...map.entries()]
      .sort(([, a], [, b]) =>
        typeof a.sort === "number" && typeof b.sort === "number"
          ? a.sort - b.sort
          : String(a.sort).localeCompare(String(b.sort))
      )
      .map(([label, { items }]) => ({ label, ...make(items) }))
  }

  const columns = across
    ? groups(people, across, (items) => ({ count: items.length }))
    : []

  const rows = groups(people, by, (items) => ({
    people: items.length,
    registrations: new Set(items.map((p) => p.registration.id)).size,
    cells: across
      ? columns.map(
          (column) =>
            items.filter((p) => groupOf(across, p).label === column.label)
              .length
        )
      : [],
  }))

  // Largest first for mandals; the natural order (dates, ages) for the rest.
  if (by === "mandal") rows.sort((a, b) => b.people - a.people)

  return {
    rows,
    columns: columns.map((c) => c.label),
    columnTotals: columns.map((c) => c.count),
  }
}

/* ------------------------------------------------------------------ */
/* Columns of the list                                                 */
/* ------------------------------------------------------------------ */

type ColumnDef = {
  label: string
  /** A person's own detail; left out of the one-row-per-registration list. */
  person?: boolean
  value: (person: Person) => string | number
  /** In the one-row-per-registration list, the booking's value instead. */
  booking?: (registration: Registration) => string
}

const formatPoint = (point: Member["arrival"]) =>
  `${formatDay(point.date)}, ${point.slot}`

export const COLUMNS = {
  // A person's own number on a row per person; the family's (or the one
  // person's) on a row per registration.
  code: {
    label: "Code",
    value: (p) => p.member.code ?? p.registration.code,
    booking: (r) => r.code,
  },
  name: { label: "Name", person: true, value: (p) => p.member.fullName },
  family: {
    label: "Family / name",
    value: (p) => displayName(p.registration),
  },
  gender: {
    label: "Gender",
    person: true,
    value: (p) => GENDERS[p.member.gender],
  },
  age: { label: "Age", person: true, value: (p) => p.member.age },
  relation: {
    label: "Relation",
    person: true,
    value: (p) =>
      p.member.isPrimary ? "Primary contact" : (p.member.relation ?? ""),
  },
  mobile: {
    label: "Own mobile",
    person: true,
    value: (p) => (p.member.mobile ? formatMobile(p.member.mobile) : ""),
  },
  contact: {
    label: "Contact",
    value: (p) => contactOf(p.registration).fullName,
  },
  contactMobile: {
    label: "Contact mobile",
    value: (p) => {
      const mobile = contactOf(p.registration).mobile
      return mobile ? formatMobile(mobile) : ""
    },
  },
  mandal: { label: "Mandal", value: (p) => p.registration.mandal },
  region: {
    label: "Coming from",
    value: (p) => REGIONS[regionOf(p.registration.mandal)],
  },
  status: {
    label: "Status",
    value: (p) => REGISTRATION_STATUSES[p.registration.status],
  },
  arrival: {
    label: "Arriving",
    person: true,
    value: (p) => formatPoint(p.member.arrival),
    booking: (r) => formatPoint(r.arrival),
  },
  arrivalMeal: {
    label: "Arrival meal",
    person: true,
    value: (p) => formatMeal(p.member.arrival),
  },
  departure: {
    label: "Leaving",
    person: true,
    value: (p) => formatPoint(p.member.departure),
    booking: (r) => formatPoint(r.departure),
  },
  departureMeal: {
    label: "Leaving meal",
    person: true,
    value: (p) => formatMeal(p.member.departure),
  },
  travel: {
    label: "Coming by",
    value: (p) => TRAVEL_MODES[tripOf(p).mode],
  },
  reference: {
    label: "Train / bus",
    value: (p) => tripOf(p).reference ?? "",
  },
  station: {
    label: "Station",
    value: (p) => tripOf(p).station ?? "",
  },
  arrivalTime: {
    label: "Reaches at",
    value: (p) => {
      const { arrivalTime } = tripOf(p)
      return arrivalTime ? formatTime(arrivalTime) : ""
    },
  },
  pickup: {
    label: "Pickup",
    value: (p) => (tripOf(p).needsPickup ? "Yes" : ""),
  },
  vehicles: {
    label: "Vehicles",
    value: (p) => {
      const { vehicleCount, vehicleNumbers } = p.registration.travel
      if (!vehicleCount) return ""
      return [vehicleCount, ...(vehicleNumbers ?? [])].join(" · ")
    },
  },
  leaveBy: {
    label: "Leaving by",
    value: (p) => TRAVEL_MODES[leavingBy(tripOf(p))],
  },
  drop: {
    label: "Drop",
    value: (p) => (tripOf(p).needsDrop ? "Yes" : ""),
  },
  journeyHome: {
    label: "Journey home",
    value: (p) => {
      const trip = tripOf(p)
      return [
        trip.departureReference,
        trip.departureStation,
        trip.departureTime && formatTime(trip.departureTime),
      ]
        .filter(Boolean)
        .join(" · ")
    },
  },
  // Each person's airport flights; one row per registration says "Per person"
  // when the party's differ.
  airportPickup: {
    label: "Airport pickup",
    value: (p) =>
      flightsOf(p.registration, p.member)?.needsPickup ? "Yes" : "",
    booking: (r) => (r.indiaTravel?.needsPickup ? "Yes" : ""),
  },
  flightIn: {
    label: "Flight in",
    value: (p) => {
      const arrival = flightsOf(p.registration, p.member)?.arrival
      return arrival ? formatIndiaFlight(arrival) : ""
    },
    booking: (r) =>
      hasOwnFlights(r)
        ? "Per person"
        : r.indiaTravel?.arrival
          ? formatIndiaFlight(r.indiaTravel.arrival)
          : "",
  },
  flightOut: {
    label: "Flight out",
    value: (p) => {
      const departure = flightsOf(p.registration, p.member)?.departure
      return departure ? formatIndiaFlight(departure) : ""
    },
    booking: (r) =>
      hasOwnFlights(r)
        ? "Per person"
        : r.indiaTravel?.departure
          ? formatIndiaFlight(r.indiaTravel.departure)
          : "",
  },
  bed: {
    label: "Accommodation",
    person: true,
    value: (p) => (wantsBed(p.registration, p.member) ? "Yes" : "No"),
  },
  assist: {
    label: "Assistance",
    person: true,
    value: (p) =>
      p.member.needsAssistance ? (p.member.assistanceNote ?? "Yes") : "",
  },
  youth: {
    label: "Youth Convention",
    person: true,
    value: (p) => yesNo(p.member.attendsYouthConvention),
  },
  seva: {
    label: "Swayam Sevak (early seva)",
    person: true,
    value: (p) => (isSevak(p.registration, p.member) ? "Yes" : "No"),
  },
  notes: { label: "Notes", value: (p) => p.registration.notes ?? "" },
} satisfies Record<string, ColumnDef>
export type Column = keyof typeof COLUMNS

export const DEFAULT_COLUMNS: Column[] = [
  "code",
  "name",
  "gender",
  "age",
  "mandal",
  "arrival",
  "departure",
  "travel",
  "contactMobile",
]

/** One row per person, or per registration with how many of its people matched. */
export type ListMode = "people" | "registrations"

export type ListRow = { cells: (string | number)[]; key: string }

/** The registration a list row belongs to: its key is "id" or "id:memberId". */
export const registrationIdOf = (row: ListRow) => row.key.split(":")[0]

/** The list's registrations in its order, once each — what "Next" walks through. */
export const registrationIdsOf = (rows: ListRow[]) => [
  ...new Set(rows.map(registrationIdOf)),
]

export function listRows(
  people: Person[],
  columns: Column[],
  mode: ListMode
): { header: string[]; rows: ListRow[] } {
  if (mode === "people") {
    return {
      header: columns.map((c) => COLUMNS[c].label),
      rows: people.map((p) => ({
        key: `${p.registration.id}:${p.member.id}`,
        cells: columns.map((c) => COLUMNS[c].value(p)),
      })),
    }
  }
  const shown = columns
    .map((c): ColumnDef => COLUMNS[c])
    .filter((c) => !c.person || c.booking)
  const byRegistration = new Map<string, Person[]>()
  for (const p of people) {
    const list = byRegistration.get(p.registration.id) ?? []
    list.push(p)
    byRegistration.set(p.registration.id, list)
  }
  return {
    header: [...shown.map((c) => c.label), "People", "Names"],
    rows: [...byRegistration.values()].map((group) => ({
      key: group[0].registration.id,
      cells: [
        ...shown.map((c) =>
          c.booking ? c.booking(group[0].registration) : c.value(group[0])
        ),
        group.length,
        group.map((p) => p.member.fullName).join(", "),
      ],
    })),
  }
}

/* ------------------------------------------------------------------ */
/* The report, as read from the URL                                    */
/* ------------------------------------------------------------------ */

export type Report = {
  /**
   * The title on the screen and the exported files; empty for the default.
   * Null while no report is open — the screen offers the questions instead.
   */
  name: string | null
  status: StatusSet
  /** Whether the made-up demo registrations count. */
  dummy: boolean
  /** Filter key → value, only the ones set. */
  filters: Record<string, string>
  by: Dimension
  across?: Dimension
  mode: ListMode
  /** Which half of the results shows: the counts, or the people. */
  view: "summary" | "list"
  columns: Column[]
}

const isKey = <T extends object>(
  map: T,
  key: string | null
): key is keyof T & string => key != null && Object.hasOwn(map, key)

export function readReport(params: URLSearchParams): Report {
  const status = params.get("status")
  const by = params.get("by")
  const across = params.get("across")
  const columns = (params.get("cols") ?? "")
    .split(",")
    .filter((c): c is Column => isKey(COLUMNS, c))
  return {
    name: params.get("name"),
    status: isKey(STATUS_SETS, status) ? status : "active",
    dummy: params.get("dummy") === "1",
    filters: Object.fromEntries(
      FILTERS.flatMap((f) => {
        const value = params.get(f.key)
        return value && filterAccepts(f, value) ? [[f.key, value]] : []
      })
    ),
    by: isKey(DIMENSIONS, by) ? by : "mandal",
    across: isKey(DIMENSIONS, across) && across !== by ? across : undefined,
    mode: params.get("list") === "registrations" ? "registrations" : "people",
    view: params.get("view") === "list" ? "list" : "summary",
    columns: columns.length ? columns : DEFAULT_COLUMNS,
  }
}

export function writeReport(report: Report) {
  const params = new URLSearchParams()
  // Kept even when empty: an open report whose title is being retyped.
  if (report.name !== null) params.set("name", report.name)
  if (report.status !== "active") params.set("status", report.status)
  if (report.dummy) params.set("dummy", "1")
  for (const [key, value] of Object.entries(report.filters))
    if (value) params.set(key, value)
  if (report.by !== "mandal") params.set("by", report.by)
  if (report.across) params.set("across", report.across)
  if (report.mode !== "people") params.set("list", report.mode)
  if (report.view !== "summary") params.set("view", report.view)
  if (report.columns.join() !== DEFAULT_COLUMNS.join())
    params.set("cols", report.columns.join(","))
  return params
}

/** Everyone in the report: people of the chosen registrations who pass every filter. */
export function applyReport(registrations: Registration[], report: Report) {
  const statuses: readonly RegistrationStatus[] =
    STATUS_SETS[report.status].statuses
  const { meal, mealDay } = report.filters
  return registrations
    .filter((r) => statuses.includes(r.status) && (report.dummy || !r.isSample))
    .flatMap((registration) =>
      registration.members.map((member) => ({ registration, member }))
    )
    .filter((person) =>
      FILTERS.every((f) => {
        const value = report.filters[f.key]
        if (!value) return true
        // A meal on a day is one question, not two.
        if (meal && mealDay && (f.key === "meal" || f.key === "mealDay"))
          return takesMeal(person.member, mealDay, meal as Meal)
        return f.test(person, value)
      })
    )
}

/** "Arriving on: 29 Jan · Coming by: Train", for the screen and the exports. */
export function describeReport(report: Report, filters = FILTERS) {
  const parts = filters.flatMap((f) => {
    const value = report.filters[f.key]
    if (!value) return []
    return [`${f.label}: ${filterValueLabel(f, value)}`]
  })
  return [
    `Registrations: ${STATUS_SETS[report.status].label.toLowerCase()}${report.dummy ? ", with dummy data" : ""}`,
    ...parts,
  ]
}

/* ------------------------------------------------------------------ */
/* Ready-made reports                                                  */
/* ------------------------------------------------------------------ */

export type Preset = {
  label: string
  /** What it answers, shown under the label. */
  question: string
  report: Partial<Report>
}

const [, SECOND_DAY, THIRD_DAY] = EVENT.days

export const PRESETS: Preset[] = [
  {
    label: "Arriving by train",
    question: `Who comes by train on a day (${formatDay(SECOND_DAY)} here), by station`,
    report: {
      filters: { travel: "train", arrive: SECOND_DAY },
      by: "station",
      across: "arriveSlot",
      columns: [
        "code",
        "name",
        "contact",
        "contactMobile",
        "mandal",
        "reference",
        "station",
        "arrivalTime",
        "pickup",
      ],
    },
  },
  {
    label: "Meal count",
    question: `How many take a meal (dinner on ${formatDay(THIRD_DAY)} here)`,
    report: {
      filters: { mealDay: THIRD_DAY, meal: "dinner" },
      by: "mandal",
      across: "gender",
      columns: [
        "code",
        "name",
        "gender",
        "age",
        "mandal",
        "arrival",
        "departure",
      ],
    },
  },
  {
    label: "NRI airport pickups",
    question: "Devotees from abroad who need a pickup at Ahmedabad airport",
    report: {
      filters: { airport: "yes" },
      by: "flightDay",
      across: "mandal",
      mode: "registrations",
      columns: [
        "code",
        "family",
        "contact",
        "contactMobile",
        "mandal",
        "flightIn",
        "flightOut",
      ],
    },
  },
  {
    label: "Station pickups",
    question: "Pickups at the train station or bus stand, by day and station",
    report: {
      filters: { pickup: "yes" },
      by: "arrive",
      across: "station",
      mode: "registrations",
      columns: [
        "code",
        "family",
        "contact",
        "contactMobile",
        "travel",
        "reference",
        "station",
        "arrivalTime",
      ],
    },
  },
  {
    label: "Drops when leaving",
    question: "Who needs a drop to the station or bus stand, by day",
    report: {
      filters: { drop: "yes" },
      by: "leave",
      across: "leaveBy",
      mode: "registrations",
      columns: [
        "code",
        "family",
        "contact",
        "contactMobile",
        "leaveBy",
        "journeyHome",
      ],
    },
  },
  {
    label: "Beds per night",
    question: `Who needs a bed on a night (${formatDay(SECOND_DAY)} here), by mandal`,
    report: {
      filters: { night: SECOND_DAY },
      by: "mandal",
      across: "gender",
      columns: [
        "code",
        "name",
        "gender",
        "age",
        "mandal",
        "arrival",
        "departure",
        "assist",
      ],
    },
  },
  {
    label: "Needs assistance",
    question: "Seniors, wheelchair users and anyone who asked for help",
    report: {
      filters: { assist: "yes" },
      by: "age",
      columns: [
        "code",
        "name",
        "age",
        "gender",
        "mandal",
        "assist",
        "arrival",
        "departure",
        "contactMobile",
      ],
    },
  },
  {
    label: "Youth Convention",
    question: "Who is attending the Youth Convention, by mandal",
    report: {
      filters: { youth: "yes" },
      by: "mandal",
      across: "gender",
      columns: ["code", "name", "gender", "age", "mandal", "mobile"],
    },
  },
  {
    label: "Children",
    question: "Children under 12, by age",
    report: {
      filters: { age: "child" },
      by: "age",
      across: "gender",
      columns: [
        "code",
        "name",
        "age",
        "gender",
        "mandal",
        "contact",
        "contactMobile",
      ],
    },
  },
  {
    label: "Parking",
    question: "Families coming in their own vehicles, with the numbers",
    report: {
      filters: { travel: "personal_vehicle" },
      by: "arrive",
      mode: "registrations",
      columns: [
        "code",
        "family",
        "contact",
        "contactMobile",
        "mandal",
        "vehicles",
        "arrival",
      ],
    },
  },
]

/** Nothing picked yet: the screen offers the questions instead of results. */
export const isBlank = (report: Report) =>
  report.name === null &&
  report.status === "active" &&
  Object.keys(report.filters).length === 0

/** A preset as a whole report: what it does not set goes back to the default. */
export const fromPreset = (preset: Preset, current: Report): Report => ({
  name: preset.label,
  status: "active",
  filters: {},
  by: "mandal",
  mode: "people",
  view: "summary",
  columns: DEFAULT_COLUMNS,
  ...preset.report,
  // Keep the dummy-data choice: it is about the data, not the question.
  dummy: current.dummy,
})

/* ------------------------------------------------------------------ */
/* Walk-in guests and exports                                          */
/* ------------------------------------------------------------------ */

/**
 * Walk-in guests eat too. They are counted, not named, so they only add to a
 * meal count — narrowed by mandal, the one thing known about them. Null when
 * the report is not about meals.
 */
export function walkInGuests(guestVisits: GuestVisit[], report: Report) {
  const { meal, mealDay, mandal, region } = report.filters
  if (!(meal || mealDay)) return null
  if (meal === "breakfast") return 0
  return guestVisits
    .filter(
      (visit) =>
        (!mandal || visit.hostMandal === mandal) &&
        (!region || regionOf(visit.hostMandal) === region)
    )
    .flatMap((visit) => visit.days)
    .filter(
      (day) =>
        (!mealDay || day.date === mealDay) &&
        (meal ? day.meals.includes(meal as GuestMeal) : day.meals.length > 0)
    )
    .reduce((sum, day) => sum + day.guests, 0)
}

/** "Plus 12 walk-in guests taking dinner on 30 Jan (…)", or null for none. */
export function walkInLine(walkIns: number | null, report: Report) {
  if (walkIns == null || walkIns === 0) return null
  const { meal, mealDay } = report.filters
  return `Plus ${walkIns.toLocaleString("en-IN")} walk-in guests taking ${meal ? MEALS[meal as Meal].toLowerCase() : "a meal"}${mealDay ? ` on ${formatDay(mealDay)}` : ""} (from the Guests screen, not in the list).`
}

/** Everything the Excel and PDF need for a report. */
export function reportExport(
  report: Report,
  people: Person[],
  extra: string[],
  filters = FILTERS
): ReportExport {
  const list = listRows(people, report.columns, report.mode)
  return {
    title: report.name || "Devotees report",
    description: describeReport(report, filters),
    people: people.length,
    registrations: new Set(people.map((p) => p.registration.id)).size,
    extra,
    breakdown: breakDown(people, report.by, report.across),
    breakdownLabel: [report.by, report.across]
      .filter((d): d is Dimension => !!d)
      .map((d) => DIMENSIONS[d].label)
      .join(" × "),
    list: { header: list.header, rows: list.rows.map((row) => row.cells) },
  }
}

/** The report on the Reports screen, as a link. */
export const reportLink = (report: Report) =>
  `/admin/reports?${writeReport(report)}`
