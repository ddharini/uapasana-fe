import {
  EVENT,
  MANDALS,
  NO_MANDAL,
  STAY_DATES,
  formatDay,
} from "@/config/event"
import type { AccommodationData } from "@/features/accommodation/types"
import { PLACE_KINDS } from "@/features/accommodation/types"
import {
  capacityOf,
  occupancyOf,
  roomList,
} from "@/features/accommodation/mandal-stays"
import type { GuestVisit } from "@/features/guests/api"
import {
  displayName,
  formatIndiaFlight,
  formatStay,
} from "@/features/registrations/format"
import { wantsBed } from "@/features/registrations/stay"
import {
  GENDERS,
  REGISTRATION_STATUSES,
  TRAVEL_MODES,
  type PersonTravel,
  type Registration,
} from "@/features/registrations/types"
import {
  COLUMNS,
  DEFAULT_COLUMNS,
  DIMENSIONS,
  FILTERS,
  MEALS,
  REGIONS,
  STATUS_SETS,
  applyReport,
  breakDown,
  describeReport,
  filterAccepts,
  listRows,
  staysNight,
  takesMeal,
  walkInGuests,
  type Column,
  type Dimension,
  type ListMode,
  type Meal,
  type Person,
  type Report,
  type StatusSet,
} from "@/features/reports/model"
import { formatMobile } from "@/lib/phone"
import { formatTime } from "@/lib/time"

/**
 * The Assistant's tools. They run here, in the browser, on the data the
 * screens already load — and the devotee report is the Reports screen's own
 * engine — so the Assistant's numbers are the Reports screen's numbers.
 *
 * Each tool turns the model's input into two things: a compact result for the
 * model to read, and a card for the admin (cards.tsx), which recomputes from
 * the live data with the same functions here.
 *
 * The definitions are sent to the server with every turn; it accepts only
 * the names in ASSISTANT_TOOLS (upasana-be/src/lib/assistant.ts) — add a tool
 * in both places.
 */

export type ToolData = {
  registrations: Registration[]
  guestVisits: GuestVisit[]
  accommodation: AccommodationData
}

/** What a card shows. Small, so a chat can be kept in sessionStorage. */
export type Card =
  | { kind: "report"; report: Report }
  | { kind: "meals"; input: MealInput }
  | { kind: "registrations"; ids: string[] }
  | { kind: "accommodation"; input: AccommodationInput }
  | { kind: "guests"; input: GuestsInput }

export type ToolOutcome = { result: unknown; card?: Card }

/**
 * What the server says applies when the model leaves an input out:
 * `includeDummy` is ASSISTANT_INCLUDE_DUMMY, on while the team tests with
 * the sample registrations.
 */
export type ToolDefaults = { includeDummy: boolean }

export type ToolDefinition = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** A mistake in the model's input. Sent back to it as an error to correct. */
export class ToolInputError extends Error {}

/** Rows of a list the model reads; the card and the files have them all. */
const MODEL_ROWS = 150

/* ------------------------------------------------------------------ */
/* Reading the model's input                                           */
/* ------------------------------------------------------------------ */

type Input = Record<string, unknown>

const isObject = (value: unknown): value is Input =>
  !!value && typeof value === "object" && !Array.isArray(value)

function objectOf(value: unknown, what: string): Input {
  if (value == null) return {}
  if (!isObject(value)) throw new ToolInputError(`${what} must be an object.`)
  return value
}

function textOf(input: Input, key: string): string | undefined {
  const value = input[key]
  if (value == null || value === "") return undefined
  if (typeof value !== "string")
    throw new ToolInputError(`"${key}" must be text.`)
  return value.trim()
}

function flagOf(input: Input, key: string, fallback = false): boolean {
  const value = input[key]
  if (value == null) return fallback
  if (typeof value !== "boolean")
    throw new ToolInputError(`"${key}" must be true or false.`)
  return value
}

function choiceOf<T extends string>(
  input: Input,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = textOf(input, key)
  if (value === undefined) return undefined
  if (!(allowed as readonly string[]).includes(value))
    throw new ToolInputError(
      `"${value}" is not a value of "${key}". Use one of: ${allowed.join(", ")}.`
    )
  return value as T
}

const ALL_MANDALS = [...MANDALS, NO_MANDAL]
const STATUS_KEYS = Object.keys(STATUS_SETS) as StatusSet[]
const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[]
const COLUMN_KEYS = Object.keys(COLUMNS) as Column[]

/** "a = A; b = B" — values and what they mean, for a schema description. */
const legend = (options: readonly (readonly [string, string])[]) =>
  options.map(([v, label]) => (v === label ? v : `${v} = ${label}`)).join("; ")

const DAY_LEGEND = legend(EVENT.days.map((d) => [d, formatDay(d)]))

/** Which registrations count, and whether the dummy ones do. Shared by most tools. */
const countingSchema = {
  counting: {
    type: "string",
    enum: STATUS_KEYS,
    description: `Which registrations count. Default "active". ${legend(
      STATUS_KEYS.map((k) => [k, STATUS_SETS[k].label])
    )}.`,
  },
  include_dummy: {
    type: "boolean",
    description:
      "Count the made-up sample registrations used for demos and testing. Leave it out for the default your instructions give.",
  },
}

/* ------------------------------------------------------------------ */
/* devotee_report                                                      */
/* ------------------------------------------------------------------ */

const filterSchema = Object.fromEntries(
  FILTERS.map((f) => [
    f.key,
    f.key === "flightDay"
      ? {
          type: "string",
          description: `${f.label}: the day an NRI's flight lands in Ahmedabad, an ISO date (it can be before the event).`,
        }
      : f.key === "age"
        ? {
            type: "string",
            description: `Age, any range: "80+" = 80 and over, "-14" = 14 and under, "25-35" = 25 to 35, both ends counted. Write exactly the ages asked: "over 80" is "80+", never the nearest group. Also these groups: ${legend(f.options)}.`,
          }
        : f.key === "size"
          ? {
              type: "string",
              description: `How many people are in the whole registration (all its members, whatever the other filters pick), any range: "6+" = 6 or more, "-2" = 2 or fewer, "3-5", "4" = exactly 4. "More than 5" is "6+".`,
            }
          : {
              type: "string",
              enum: f.options.map(([v]) => v),
              description:
                f.key === "mandal"
                  ? f.label
                  : `${f.label}: ${legend(f.options)}.`,
            },
  ])
)

const devoteeReport: ToolDefinition = {
  name: "devotee_report",
  description: `Counts and lists registered devotees with any mix of filters — the Reports screen's engine. Works on one row per person (a member of a registration); dates, meals and beds are per person, and so are travel and pickups (a party travelling separately has each person's own; otherwise everyone's is the registration's). Returns the totals, a breakdown, and the first ${MODEL_ROWS} rows of the list. The admin sees a card with the full list, Excel and PDF buttons, and a link to the same report on the Reports screen.

Use it for every "who / how many" question about devotees: arrivals and departures on a day, travel by train or bus and the pickups and drops they need, NRI airport pickups, meals on a day, beds needed on a night, ages and children, family sizes, mandals, assistance, the Youth Convention, pending registrations.

Examples:
- "Who comes by train on the 29th?" → filters {travel: "train", arrive: "2027-01-29"}, breakdown_by "station", breakdown_across "arriveSlot", list_per "registrations", columns [code, family, contact, contactMobile, mandal, reference, station, arrivalTime, pickup].
- "Dinner count on the 30th" → filters {mealDay: "2027-01-30", meal: "dinner"}, breakdown_by "mandal", show "breakdown".
- "Beds needed on the night of the 29th" → filters {night: "2027-01-29"}, breakdown_by "mandal", breakdown_across "gender".`,
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          'Short title for the card and the exported files, e.g. "Train arrivals · 29 Jan".',
      },
      ...countingSchema,
      filters: {
        type: "object",
        description:
          'Only the filters the question needs; all must match. "mealDay" with "meal" means that meal on that day. Days are ISO dates: ' +
          DAY_LEGEND +
          ".",
        properties: filterSchema,
        additionalProperties: false,
      },
      breakdown_by: {
        type: "string",
        enum: DIMENSION_KEYS,
        description: `Count the people by this. Default "mandal". ${legend(
          DIMENSION_KEYS.map((k) => [k, DIMENSIONS[k].label])
        )}.`,
      },
      breakdown_across: {
        type: "string",
        enum: DIMENSION_KEYS,
        description:
          "Optional second dimension, making the breakdown a grid (e.g. station × slot).",
      },
      list_per: {
        type: "string",
        enum: ["people", "registrations"],
        description:
          'One row per person (default), or one per registration — a party, with how many of its people matched and their names. Use "registrations" for pickups, drops, parking and calling contacts.',
      },
      columns: {
        type: "array",
        items: { type: "string", enum: COLUMN_KEYS },
        description: `The list's columns, in order; start with "code". Default: ${DEFAULT_COLUMNS.join(", ")}. ${legend(
          COLUMN_KEYS.map((k) => [k, COLUMNS[k].label])
        )}. A person's own details (name, gender, age, relation, mobile, meals, accommodation, assistance) are left out of a per-registration list, which adds "People" (how many matched) and "Names" columns by itself.`,
      },
      show: {
        type: "string",
        enum: ["list", "breakdown"],
        description:
          'What the card opens on: the list (default) or the breakdown. "breakdown" for "how many" questions.',
      },
    },
    required: ["title"],
    additionalProperties: false,
  },
}

/** The model's input as a report, the same object the Reports screen reads from its URL. */
function reportOf(input: Input, defaults: ToolDefaults): Report {
  const filters: Record<string, string> = {}
  for (const [key, raw] of Object.entries(objectOf(input.filters, "filters"))) {
    if (raw == null || raw === "") continue
    const def = FILTERS.find((f) => f.key === key)
    if (!def)
      throw new ToolInputError(
        `There is no filter "${key}". Filters: ${FILTERS.map((f) => f.key).join(", ")}.`
      )
    if (typeof raw !== "string")
      throw new ToolInputError(`Filter "${key}" must be text.`)
    if (!filterAccepts(def, raw))
      throw new ToolInputError(
        key === "flightDay"
          ? `Filter "flightDay" must be an ISO date like 2027-01-27.`
          : key === "age" || key === "size"
            ? `"${raw}" is not a range. Write "80+", "-14", "25-35" or "40"${key === "age" ? `, or one of: ${def.options.map(([v]) => v).join(", ")}` : ""}.`
            : `"${raw}" is not a value of filter "${key}". Use one of: ${def.options.map(([v]) => v).join(", ")}.`
      )
    filters[key] = raw
  }

  const by = choiceOf(input, "breakdown_by", DIMENSION_KEYS) ?? "mandal"
  const across = choiceOf(input, "breakdown_across", DIMENSION_KEYS)
  const asked = input.columns == null ? [] : input.columns
  if (!Array.isArray(asked))
    throw new ToolInputError(`"columns" must be a list of column names.`)
  // A per-registration list adds "People" and "Names" by itself; the model
  // asks for them anyway, so they are let through rather than refused.
  const columns = asked.filter(
    (c) => !(typeof c === "string" && /^(people|names)$/i.test(c))
  )
  for (const column of columns)
    if (!COLUMN_KEYS.includes(column as Column))
      throw new ToolInputError(
        `There is no column "${String(column)}". Columns: ${COLUMN_KEYS.join(", ")}.`
      )

  return {
    name: textOf(input, "title") || "Devotees report",
    status: choiceOf(input, "counting", STATUS_KEYS) ?? "active",
    dummy: flagOf(input, "include_dummy", defaults.includeDummy),
    filters,
    by,
    across: across !== by ? across : undefined,
    mode:
      choiceOf<ListMode>(input, "list_per", ["people", "registrations"]) ??
      "people",
    view:
      choiceOf(input, "show", ["list", "breakdown"]) === "breakdown"
        ? "summary"
        : "list",
    columns: columns.length
      ? [...new Set(columns as Column[])]
      : DEFAULT_COLUMNS,
  }
}

/** A report's numbers. The card draws the same. */
export function computeReport(data: ToolData, report: Report) {
  const people = applyReport(data.registrations, report)
  return {
    people,
    registrations: new Set(people.map((p) => p.registration.id)).size,
    breakdown: breakDown(people, report.by, report.across),
    list: listRows(people, report.columns, report.mode),
    walkIns: walkInGuests(data.guestVisits, report),
  }
}

function runDevoteeReport(
  input: Input,
  data: ToolData,
  defaults: ToolDefaults
): ToolOutcome {
  const report = reportOf(input, defaults)
  const { people, registrations, breakdown, list, walkIns } = computeReport(
    data,
    report
  )
  const male = people.filter((p) => p.member.gender === "male").length
  const grid = breakdown.columns.length > 0
  return {
    card: { kind: "report", report },
    result: {
      title: report.name,
      counting: describeReport(report),
      people: people.length,
      registrations,
      male,
      female: people.length - male,
      ...(walkIns != null ? { walk_in_guests_also_eating: walkIns } : {}),
      breakdown: {
        by: DIMENSIONS[report.by].label,
        ...(grid
          ? {
              across: DIMENSIONS[report.across!].label,
              columns: breakdown.columns,
              rows: breakdown.rows.map((r) => [r.label, ...r.cells, r.people]),
            }
          : {
              rows: breakdown.rows.map((r) => ({
                label: r.label,
                people: r.people,
                registrations: r.registrations,
              })),
            }),
      },
      list: {
        one_row_per: report.mode === "people" ? "person" : "registration",
        header: list.header,
        rows: list.rows.slice(0, MODEL_ROWS).map((r) => r.cells),
        total_rows: list.rows.length,
        ...(list.rows.length > MODEL_ROWS
          ? {
              note: `Only the first ${MODEL_ROWS} rows are shown to you. The admin's card and the Excel/PDF have all ${list.rows.length}.`,
            }
          : {}),
      },
    },
  }
}

/* ------------------------------------------------------------------ */
/* meal_counts                                                         */
/* ------------------------------------------------------------------ */

export type MealInput = {
  counting: StatusSet
  dummy: boolean
  mandal?: string
  region?: string
}

const mealCounts: ToolDefinition = {
  name: "meal_counts",
  description:
    "Plates for every meal of every event day: devotees taking breakfast, lunch and dinner each day, plus walk-in day guests (lunch and dinner only). For the kitchen's overall plan. For one meal broken down by mandal, gender etc., or for the names, use devotee_report with mealDay and meal.",
  input_schema: {
    type: "object",
    properties: {
      ...countingSchema,
      mandal: {
        type: "string",
        enum: ALL_MANDALS,
        description: "Only this mandal's devotees and guests.",
      },
      region: {
        type: "string",
        enum: Object.keys(REGIONS),
        description: `Only devotees and guests from here: ${legend(Object.entries(REGIONS))}.`,
      },
    },
    additionalProperties: false,
  },
}

const MEAL_KEYS = Object.keys(MEALS) as Meal[]

export function computeMeals(data: ToolData, input: MealInput) {
  const filters: Record<string, string> = {}
  if (input.mandal) filters.mandal = input.mandal
  if (input.region) filters.region = input.region
  const base: Report = {
    name: null,
    status: input.counting,
    dummy: input.dummy,
    filters,
    by: "mandal",
    mode: "people",
    view: "summary",
    columns: DEFAULT_COLUMNS,
  }
  const people = applyReport(data.registrations, base)
  return EVENT.days.map((day) => ({
    day,
    meals: MEAL_KEYS.map((meal) => {
      const devotees = people.filter((p) =>
        takesMeal(p.member, day, meal)
      ).length
      const guests =
        walkInGuests(data.guestVisits, {
          ...base,
          filters: { ...filters, mealDay: day, meal },
        }) ?? 0
      return { meal, devotees, guests }
    }),
  }))
}

function runMealCounts(
  input: Input,
  data: ToolData,
  defaults: ToolDefaults
): ToolOutcome {
  const parsed: MealInput = {
    counting: choiceOf(input, "counting", STATUS_KEYS) ?? "active",
    dummy: flagOf(input, "include_dummy", defaults.includeDummy),
    mandal: choiceOf(input, "mandal", ALL_MANDALS),
    region: choiceOf(input, "region", Object.keys(REGIONS)),
  }
  return {
    card: { kind: "meals", input: parsed },
    result: {
      counting: STATUS_SETS[parsed.counting].label,
      ...(parsed.mandal ? { mandal: parsed.mandal } : {}),
      ...(parsed.region
        ? { region: REGIONS[parsed.region as keyof typeof REGIONS] }
        : {}),
      days: computeMeals(data, parsed).map(({ day, meals }) => ({
        day: formatDay(day),
        ...Object.fromEntries(
          meals.map((m) => [
            m.meal,
            { devotees: m.devotees, walk_in_guests: m.guests },
          ])
        ),
      })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* find_registrations                                                  */
/* ------------------------------------------------------------------ */

const findRegistrations: ToolDefinition = {
  name: "find_registrations",
  description:
    "Looks up registrations by code (a person's DM-0142, or a family's DM-F-0031), a person's or family's name, or a mobile number (any part of it), across every status, and returns everything in them: each person's dates, meals, bed and assistance, travel, pickups, notes. Up to 8 matches. Use it for questions about particular people.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A code, a name (all words must match), or 5 or more digits of a mobile number.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
}

const MAX_MATCHES = 8
const digits = (text: string) => text.replace(/\D/g, "")

export function searchRegistrations(
  registrations: Registration[],
  query: string
) {
  const q = query.toLowerCase().trim()
  const number = digits(q)
  // "Ketanbhai", "Hiralben": the respectful suffix is not part of the name.
  const words = q
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^(.{2,}?)(bhai|ben|behen|bahen)$/, "$1"))
  return registrations.filter((r) => {
    if (
      r.code.toLowerCase() === q ||
      r.members.some((m) => m.code?.toLowerCase() === q)
    )
      return true
    if (
      number.length >= 5 &&
      number.length === q.replace(/[\s+()-]/g, "").length &&
      r.members.some((m) => m.mobile && digits(m.mobile).includes(number))
    )
      return true
    const text = [
      r.code,
      ...r.members.map((m) => m.code ?? ""),
      r.groupName ?? "",
      ...r.members.map((m) => m.fullName),
    ]
      .join(" ")
      .toLowerCase()
    return words.length > 0 && words.every((w) => text.includes(w))
  })
}

const pointText = (point: Registration["arrival"]) => formatStay(point)

/** One way of travelling, for the lookup: the party's, or a person's own. */
function tripDetail(t: PersonTravel) {
  return {
    by: TRAVEL_MODES[t.mode],
    ...(t.reference ? { reference: t.reference } : {}),
    ...(t.station ? { station: t.station } : {}),
    ...(t.arrivalTime ? { reaches_at: formatTime(t.arrivalTime) } : {}),
    pickup: t.needsPickup,
    ...(t.needsDrop
      ? {
          drop: true,
          leaving_by: TRAVEL_MODES[t.departureMode ?? t.mode],
          journey_home: [
            t.departureReference,
            t.departureStation,
            t.departureTime && formatTime(t.departureTime),
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : {}),
  }
}

function registrationDetail(r: Registration) {
  const t = r.travel
  return {
    code: r.code,
    status: REGISTRATION_STATUSES[r.status],
    ...(r.isSample ? { dummy: true } : {}),
    name: displayName(r),
    type: r.type,
    mandal: r.mandal,
    people: r.members.map((m) => ({
      ...(m.code ? { code: m.code } : {}),
      name: m.fullName,
      gender: GENDERS[m.gender],
      age: m.age,
      ...(m.isPrimary ? { primary_contact: true } : { relation: m.relation }),
      ...(m.mobile ? { mobile: formatMobile(m.mobile) } : {}),
      arriving: pointText(m.arrival),
      leaving: pointText(m.departure),
      needs_bed: wantsBed(r, m),
      ...(m.needsAssistance ? { assistance: m.assistanceNote || "Yes" } : {}),
      ...(m.attendsYouthConvention != null
        ? { youth_convention: m.attendsYouthConvention }
        : {}),
      // Travelling separately: this person's own way here and home.
      ...(m.travel ? { travel: tripDetail(m.travel) } : {}),
      // Landing and flying out on other days than the rest of the party.
      ...(m.indiaTravel?.needsPickup && m.indiaTravel.arrival
        ? { airport_pickup: formatIndiaFlight(m.indiaTravel.arrival) }
        : {}),
      ...(m.indiaTravel?.departure
        ? { flight_out: formatIndiaFlight(m.indiaTravel.departure) }
        : {}),
    })),
    travel: {
      ...tripDetail(t),
      ...(t.vehicleCount
        ? {
            vehicles: [t.vehicleCount, ...(t.vehicleNumbers ?? [])].join(" · "),
          }
        : {}),
    },
    ...(r.indiaTravel?.needsPickup && r.indiaTravel.arrival
      ? { airport_pickup: formatIndiaFlight(r.indiaTravel.arrival) }
      : {}),
    ...(r.indiaTravel?.needsDrop && r.indiaTravel.departure
      ? { airport_drop: formatIndiaFlight(r.indiaTravel.departure) }
      : {}),
    ...(r.notes ? { notes: r.notes } : {}),
  }
}

function runFindRegistrations(input: Input, data: ToolData): ToolOutcome {
  const query = textOf(input, "query")
  if (!query || query.length < 2)
    throw new ToolInputError(`"query" needs at least 2 characters.`)
  const matches = searchRegistrations(data.registrations, query)
  const shown = matches.slice(0, MAX_MATCHES)
  return {
    card: shown.length
      ? { kind: "registrations", ids: shown.map((r) => r.id) }
      : undefined,
    result: {
      matches: matches.length,
      ...(matches.length > MAX_MATCHES
        ? { note: `Showing ${MAX_MATCHES}; ask for something more specific.` }
        : {}),
      registrations: shown.map(registrationDetail),
    },
  }
}

/* ------------------------------------------------------------------ */
/* accommodation                                                       */
/* ------------------------------------------------------------------ */

export type AccommodationInput = { mandal?: string; dummy: boolean }

const accommodation: ToolDefinition = {
  name: "accommodation",
  description:
    "Where mandals stay: each place (guest house or hotel) with its rooms and beds and which mandals have them, and per mandal the rooms given, its coordinator and mobile, the people its coordinator reports in the rooms, and how many of its devotees need a bed each night (registrations not cancelled). Use it for room, bed and coordinator questions.",
  input_schema: {
    type: "object",
    properties: {
      mandal: {
        type: "string",
        enum: ALL_MANDALS,
        description: "Only this mandal.",
      },
      include_dummy: countingSchema.include_dummy,
    },
    additionalProperties: false,
  },
}

// Every night someone can sleep here, the one before the event included.
const NIGHTS = STAY_DATES.slice(0, -1)

export function computeAccommodation(
  data: ToolData,
  input: AccommodationInput
) {
  const { places, mandalStays } = data.accommodation
  const people: Person[] = data.registrations
    .filter((r) => r.status !== "cancelled" && (input.dummy || !r.isSample))
    .flatMap((registration) =>
      registration.members.map((member) => ({ registration, member }))
    )
  const mandals = [
    ...new Set([
      ...mandalStays.map((s) => s.mandal),
      ...people
        .filter((p) => wantsBed(p.registration, p.member))
        .map((p) => p.registration.mandal),
    ]),
  ]
    .filter((m) => !input.mandal || m === input.mandal)
    .sort((a, b) => ALL_MANDALS.indexOf(a) - ALL_MANDALS.indexOf(b))

  return {
    places: places.map((place) => {
      const stays = mandalStays.filter((s) => s.placeId === place.id)
      const given = new Set(stays.flatMap((s) => s.roomIds))
      return {
        place,
        rooms: place.rooms.length,
        beds: place.rooms.reduce((sum, r) => sum + capacityOf(r), 0),
        roomsGiven: place.rooms.filter((r) => given.has(r.id)).length,
        mandals: stays.map((s) => s.mandal),
      }
    }),
    mandals: mandals.map((mandal) => {
      const mine = people.filter((p) => p.registration.mandal === mandal)
      return {
        mandal,
        askingForBed: mine.filter((p) => wantsBed(p.registration, p.member))
          .length,
        nights: NIGHTS.map((night) => ({
          night,
          beds: mine.filter((p) => staysNight(p, night)).length,
        })),
        stays: mandalStays
          .filter((s) => s.mandal === mandal)
          .map((stay) => {
            const place = places.find((p) => p.id === stay.placeId)
            return {
              stay,
              place,
              rooms: place ? roomList(place, stay.roomIds) : "",
              occupancy: occupancyOf(stay, place),
            }
          }),
      }
    }),
  }
}

function runAccommodation(
  input: Input,
  data: ToolData,
  defaults: ToolDefaults
): ToolOutcome {
  const parsed: AccommodationInput = {
    mandal: choiceOf(input, "mandal", ALL_MANDALS),
    dummy: flagOf(input, "include_dummy", defaults.includeDummy),
  }
  const { places, mandals } = computeAccommodation(data, parsed)
  return {
    card: { kind: "accommodation", input: parsed },
    result: {
      ...(parsed.mandal
        ? {}
        : {
            places: places.map((p) => ({
              name: p.place.name,
              kind: PLACE_KINDS[p.place.kind],
              area: p.place.area,
              rooms: p.rooms,
              beds_with_extra_mattresses: p.beds,
              rooms_given: p.roomsGiven,
              given_to: p.mandals,
            })),
          }),
      mandals: mandals.map((m) => ({
        mandal: m.mandal,
        people_asking_for_a_bed: m.askingForBed,
        beds_needed_by_night: Object.fromEntries(
          m.nights.map((n) => [formatDay(n.night), n.beds])
        ),
        rooms_given: m.stays.map((s) => ({
          place: s.place?.name ?? "(place removed)",
          rooms: s.rooms,
          beds: s.occupancy.beds,
          coordinator: s.stay.coordinatorName,
          coordinator_mobile: formatMobile(s.stay.coordinatorMobile),
          people_reported_in_rooms: s.occupancy.people,
          rooms_reported: `${s.occupancy.reported} of ${s.occupancy.rooms}`,
        })),
      })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* walk_in_guests                                                      */
/* ------------------------------------------------------------------ */

export type GuestsInput = { date?: string; mandal?: string }

const walkInGuestsTool: ToolDefinition = {
  name: "walk_in_guests",
  description:
    "Walk-in day guests: friends and family a devotee (the host) brings for a day to attend and eat, entered on the Guests screen. Counted, not registered. Returns per-day totals (guests, lunch, dinner) and each host's entry with their mobile.",
  input_schema: {
    type: "object",
    properties: {
      date: {
        type: "string",
        enum: [...EVENT.days],
        description: `Only this day. ${DAY_LEGEND}.`,
      },
      mandal: {
        type: "string",
        enum: ALL_MANDALS,
        description: "Only hosts from this mandal.",
      },
    },
    additionalProperties: false,
  },
}

export function computeGuests(visits: GuestVisit[], input: GuestsInput) {
  const entries = visits.filter(
    (v) =>
      (!input.mandal || v.hostMandal === input.mandal) &&
      (!input.date || v.days.some((d) => d.date === input.date))
  )
  const days = EVENT.days
    .filter((day) => !input.date || day === input.date)
    .map((day) => {
      const that = entries.flatMap((v) => v.days.filter((d) => d.date === day))
      const sum = (pick: (d: GuestVisit["days"][number]) => boolean) =>
        that.filter(pick).reduce((n, d) => n + d.guests, 0)
      return {
        day,
        guests: sum(() => true),
        lunch: sum((d) => d.meals.includes("lunch")),
        dinner: sum((d) => d.meals.includes("dinner")),
      }
    })
  return { entries, days }
}

export const guestDaysText = (visit: GuestVisit, only?: string) =>
  visit.days
    .filter((d) => !only || d.date === only)
    .map(
      (d) =>
        `${formatDay(d.date)}: ${d.guests}${d.meals.length ? ` (${d.meals.join(", ")})` : ""}`
    )
    .join("; ")

function runWalkInGuests(input: Input, data: ToolData): ToolOutcome {
  const parsed: GuestsInput = {
    date: choiceOf(input, "date", [...EVENT.days]),
    mandal: choiceOf(input, "mandal", ALL_MANDALS),
  }
  const { entries, days } = computeGuests(data.guestVisits, parsed)
  return {
    card: { kind: "guests", input: parsed },
    result: {
      days: days.map((d) => ({ ...d, day: formatDay(d.day) })),
      entries: entries.length,
      hosts: entries.slice(0, MODEL_ROWS).map((v) => ({
        host: v.hostName,
        mobile: formatMobile(v.hostMobile),
        mandal: v.hostMandal,
        days: guestDaysText(v, parsed.date),
        ...(v.guestNames ? { guest_names: v.guestNames } : {}),
        ...(v.notes ? { notes: v.notes } : {}),
      })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* The set                                                             */
/* ------------------------------------------------------------------ */

const RUN: Record<
  string,
  (input: Input, data: ToolData, defaults: ToolDefaults) => ToolOutcome
> = {
  devotee_report: runDevoteeReport,
  meal_counts: runMealCounts,
  find_registrations: runFindRegistrations,
  accommodation: runAccommodation,
  walk_in_guests: runWalkInGuests,
}

/** Sent with every turn, in this order — the same bytes each time, so they cache. */
export const TOOLS: ToolDefinition[] = [
  devoteeReport,
  mealCounts,
  findRegistrations,
  accommodation,
  walkInGuestsTool,
]

/** What each tool is doing, for the line shown while it runs. */
export function toolLabel(name: string, input: unknown): string {
  const i = isObject(input) ? input : {}
  switch (name) {
    case "devotee_report":
      return typeof i.title === "string" ? i.title : "Devotees report"
    case "meal_counts":
      return "Meal counts"
    case "find_registrations":
      return `Looking up “${typeof i.query === "string" ? i.query : ""}”`
    case "accommodation":
      return "Accommodation"
    case "walk_in_guests":
      return "Walk-in guests"
    default:
      return name
  }
}

export function runTool(
  name: string,
  input: unknown,
  data: ToolData,
  defaults: ToolDefaults
): ToolOutcome {
  const run = RUN[name]
  if (!run) throw new ToolInputError(`There is no tool "${name}".`)
  return run(objectOf(input, "The input"), data, defaults)
}

/** Which data each tool reads, so only that is loaded. */
export const TOOL_NEEDS: Record<string, (keyof ToolData)[]> = {
  devotee_report: ["registrations", "guestVisits"],
  meal_counts: ["registrations", "guestVisits"],
  find_registrations: ["registrations"],
  accommodation: ["registrations", "accommodation"],
  walk_in_guests: ["guestVisits"],
}

/** A card's heading: on the card, in History and in the team's list. */
export function cardTitle(card: Card): string {
  switch (card.kind) {
    case "report":
      return card.report.name || "Devotees report"
    case "meals":
      return ["Meal counts", card.input.mandal].filter(Boolean).join(" · ")
    case "registrations":
      return card.ids.length === 1 ? "Registration" : "Registrations"
    case "accommodation":
      return ["Accommodation", card.input.mandal].filter(Boolean).join(" · ")
    case "guests":
      return [
        "Walk-in guests",
        card.input.date && formatDay(card.input.date),
        card.input.mandal,
      ]
        .filter(Boolean)
        .join(" · ")
  }
}

/** JSON with object keys in order, so the same recipe always reads the same. */
const stable = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stable).join(",")}]`
    : isObject(value)
      ? `{${Object.keys(value)
          .filter((k) => value[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
          .join(",")}}`
      : JSON.stringify(value)

/**
 * What makes two cards the same answer, for "Recently asked by the team":
 * the recipe without its wording (title, which view opens first). Undefined
 * for cards about particular people, which are not shared.
 */
export function shareKeyOf(card: Card): string | undefined {
  switch (card.kind) {
    case "report": {
      return stable({
        kind: card.kind,
        ...card.report,
        name: undefined,
        view: undefined,
      })
    }
    case "meals":
    case "accommodation":
    case "guests":
      return stable(card)
    case "registrations":
      return undefined
  }
}
