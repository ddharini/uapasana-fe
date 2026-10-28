import { z } from "zod"

import {
  MANDALS,
  OVERSEAS_MANDALS,
  YOUTH_MAX_AGE,
  isLocalMandal,
  ARRIVAL_DATES,
  DEPARTURE_DATES,
  SEVA_DATES,
  TIME_SLOTS,
  EVENT,
  formatDay,
  mealOf,
  type StayDate,
  type TimeSlot,
} from "@/config/event"

import { translator, type Lang, type Translate } from "@/i18n/translate"
import {
  DEFAULT_COUNTRY_CODE,
  fromE164,
  mobileError,
  toE164,
} from "@/lib/phone"

import {
  compareStay,
  hasOwnFlights,
  hasSplitSchedule,
  isSevak,
  wantsBed,
} from "../stay"
import {
  GENDERS,
  RELATION_GENDER,
  TRAVEL_MODES,
  type Gender,
  type NewRegistration,
  type Registration,
  type RegistrationType,
  type IndiaFlight,
  type IndiaTravel,
  type PersonTravel,
  type StayPoint,
  type TravelMode,
} from "../types"

/**
 * The registration form's values and rules.
 *
 * Every field is a plain string or boolean, which is what the inputs produce.
 * Choices that start out unpicked (gender, mandal, travel mode) are strings
 * checked against their list instead of enums, so an empty select shows
 * "Select a gender" rather than a type error. `toNewRegistration` turns the
 * validated values into the real record.
 *
 * Rules that depend on more than one field live in `superRefine`. Zod still
 * runs it when single-field checks fail, so every error on a step appears at
 * once instead of one round at a time.
 */

const isIn = (list: readonly string[]) => (value: string) =>
  list.includes(value)
const MEAL_ANSWERS = ["yes", "no"]
/** The travel modes the form offers: all but "local", "not_filled" and "separate", which are set, not picked. */
export const TRAVEL_CHOICES = (
  Object.keys(TRAVEL_MODES) as TravelMode[]
).filter(
  (mode): mode is Exclude<TravelMode, "local" | "not_filled" | "separate"> =>
    mode !== "local" && mode !== "not_filled" && mode !== "separate"
)

/** Whether someone of this age (as typed) is asked about the Youth Convention. */
export const asksYouthConvention = (age: string) =>
  /^\d{1,3}$/.test(age.trim()) && Number(age) <= YOUTH_MAX_AGE

/** "yes" → true, "no" → false, anything else (unanswered) → undefined. */
const yesNoAnswer = (answer: string | undefined) =>
  answer === "yes" ? true : answer === "no" ? false : undefined

/** A flight number in capitals ("6e 2131" → "6E 2131"); anything else as typed. */
const asTyped = (mode: string, reference: string) =>
  mode === "flight" ? reference.toUpperCase() : reference

/**
 * Whether the text has letters from a script other than English's: a name
 * typed in Gujarati or Hindi. Names are kept in English letters only, so the
 * team can search, sort and print them however the form was filled in.
 * Mirrors hasNonLatinLetters on the server.
 */
export const hasNonLatinLetters = (text: string) =>
  /(?!\p{Script=Latin})\p{L}/u.test(text)

/** What a pickup or drop's train, bus or flight is missing, when it is. */
const REFERENCE_REQUIRED: Record<DropMode, string> = {
  train: "Enter the train number and name",
  public_bus: "Enter the bus details",
  flight: "Enter the flight number",
}

/** Whether a pickup and drop in Ahmedabad are offered for this way of travelling. */
export const offersPickup = (mode: string): mode is DropMode =>
  (DROP_MODES as readonly string[]).includes(mode)

/** The ways of leaving a drop is offered for: to a station, bus stand or the airport. */
export const DROP_MODES = ["train", "public_bus", "flight"] as const
export type DropMode = (typeof DROP_MODES)[number]

/** A meal answer as saved: only for a slot with a meal. */
const mealTaken = (slot: string, answer: string) =>
  mealOf(slot) && MEAL_ANSWERS.includes(answer) ? answer === "yes" : undefined
/** A saved meal answer back as the form's "yes", "no" or unanswered. */
const mealAnswer = (point: StayPoint) =>
  point.meal === undefined ? "" : point.meal ? "yes" : "no"
const ARRIVAL_DATE_VALUES: readonly string[] = ARRIVAL_DATES
const DEPARTURE_DATE_VALUES: readonly string[] = DEPARTURE_DATES

/**
 * The days that may be picked for arriving and leaving: around the event, or
 * all of January and February 2027 for a Swayam Sevak arriving early for seva.
 */
export const arrivalDays = (earlySeva: boolean) =>
  earlySeva ? SEVA_DATES : ARRIVAL_DATE_VALUES
export const departureDays = (earlySeva: boolean) =>
  earlySeva ? SEVA_DATES : DEPARTURE_DATE_VALUES

/**
 * Whether everyone in the party is arriving early for seva: the party's
 * shared dates can leave the event's days only then. In practice that is
 * someone registering alone — a party with any Swayam Sevak always gives each
 * person's own dates (`hasSplitDates`).
 */
export const everyoneSevak = (values: {
  members: readonly { earlySeva?: boolean }[]
}) => values.members.length > 0 && values.members.every((m) => !!m.earlySeva)
const SLOT_VALUES = Object.keys(TIME_SLOTS)

/** One part of a name, in English letters (see hasNonLatinLetters). Required unless `missing` is not given. */
const namePart = (t: Translate, missing?: string) =>
  z
    .string()
    .trim()
    .refine((v) => !missing || v.length > 0, missing)
    .refine(
      (v) => !hasNonLatinLetters(v),
      t("Write the name in English letters, e.g. Ramesh Patel")
    )

/** The parts of a person's name, as asked on the form. */
export type NameParts = {
  firstName: string
  middleName: string
  surname: string
}

/** "Ramesh Kantilal Patel": the parts joined, without the gaps of a missing middle name. */
export const fullNameOf = (name: NameParts) =>
  [name.firstName, name.middleName, name.surname]
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" ")

/**
 * A one-line name split into first, middle and surname: the first word, the
 * last, and anything between. For drafts saved before the form asked for the
 * parts. Mirrors splitFullName on the server.
 */
export function splitFullName(fullName: string): NameParts {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) {
    return { firstName: words[0] ?? "", middleName: "", surname: "" }
  }
  return {
    firstName: words[0],
    middleName: words.slice(1, -1).join(" "),
    surname: words[words.length - 1],
  }
}

/**
 * How someone gets here and home: the mode, and for a train, bus or flight
 * the pickup and drop with their journeys. Asked once for the party, or for
 * each person when they travel separately. No vehicles: those are the party's.
 */
const tripFields = {
  travelMode: z.string(),
  travelReference: z.string().trim(),
  // Train, bus or flight, with a pickup (and then required): when it reaches
  // Ahmedabad ("HH:MM"); and, for a train, at which station.
  travelTime: z.string(),
  travelStation: z.string().trim(),
  // Train, public bus or flight: "yes" or "no", required, unanswered until picked.
  // The journey's details are asked, and sent, only after a "yes". The two are
  // independent: someone may make their own way here and still need a drop.
  needsPickup: z.string(),
  needsDrop: z.string(),
  // With a drop (and then required): "train", "public_bus" or "flight" — how
  // they leave, which need not be how they came — and the journey home, as
  // for the one in.
  dropMode: z.string(),
  dropReference: z.string().trim(),
  dropStation: z.string().trim(),
  dropTime: z.string(),
}

/**
 * From abroad (see `isOverseas`): a pickup from Ahmedabad airport, optional,
 * and the flight out, for the record only — no drop is arranged. A flight is
 * its day, time and number; the day is needed once the pickup is ticked or
 * anything about the flight out is given. A date is "YYYY-MM-DD" and a time
 * "HH:MM". The landing flight is kept but not sent while unticked. Asked once
 * for the party, or for each person when they land and fly out on different
 * days (`hasSplitFlights`) — the same names on both, so one set of rules
 * checks each.
 */
const flightFields = {
  indiaNeedsPickup: z.boolean(),
  indiaArrivalDate: z.string(),
  indiaArrivalTime: z.string(),
  indiaArrivalFlight: z.string(),
  indiaDepartureDate: z.string(),
  indiaDepartureTime: z.string(),
  indiaDepartureFlight: z.string(),
}
export type FlightValues = {
  [K in keyof typeof flightFields]: z.infer<(typeof flightFields)[K]>
}
export const FLIGHT_FIELDS = Object.keys(flightFields) as (keyof FlightValues)[]
export const EMPTY_FLIGHTS: FlightValues = {
  indiaNeedsPickup: false,
  indiaArrivalDate: "",
  indiaArrivalTime: "",
  indiaArrivalFlight: "",
  indiaDepartureDate: "",
  indiaDepartureTime: "",
  indiaDepartureFlight: "",
}

/** The travel fields of the party, or of one person travelling on their own. */
export type TripValues = {
  [K in keyof typeof tripFields]: z.infer<(typeof tripFields)[K]>
}
export const TRIP_FIELDS = Object.keys(tripFields) as (keyof TripValues)[]

const makeMemberSchema = (t: Translate) =>
  z.object({
    // The person's id on a saved registration, sent back so the server keeps
    // it (room allotments point at it). Not shown; missing for someone new.
    key: z.string().optional(),
    firstName: namePart(t, t("Enter the first name")),
    middleName: namePart(t, t("Enter the middle name")),
    surname: namePart(t, t("Enter the surname")),
    gender: z.string().refine(isIn(Object.keys(GENDERS)), t("Select a gender")),
    age: z
      .string()
      .trim()
      .refine(
        (v) => /^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 100,
        t("Enter an age from 1 to 100")
      ),
    mobileCountry: z.string(),
    // Digits only, without the country code. Checked in superRefine, because
    // the valid length depends on the country picked beside it.
    mobile: z.string().trim(),
    relation: z.string(),
    // No longer asked. Kept so editing an older registration keeps its answer.
    needsAssistance: z.boolean(),
    assistanceNote: z.string(),
    // Only used when the party does not travel together. Checked in superRefine.
    arrivalDate: z.string(),
    arrivalSlot: z.string(),
    departureDate: z.string(),
    departureSlot: z.string(),
    arrivalMeal: z.string(),
    departureMeal: z.string(),
    // Asked per person only when the party does not all need a bed. Optional so
    // a draft saved before it existed still loads.
    needsAccommodation: z.boolean().optional(),
    // Aged YOUTH_MAX_AGE or under: "yes", "no" or unanswered (optional).
    // Optional so a draft saved before it existed still loads.
    youthConvention: z.string().optional(),
    // "Arriving early for seva as a Swayam Sevak", optional. Ticked, this
    // person's days may be any in January or February 2027 (SEVA_DATES).
    // Optional so a draft saved before it existed still loads.
    earlySeva: z.boolean().optional(),
    // How this person travels, only used when the party does not all travel
    // the same way (`hasSplitTravel`). The same names and meanings as the
    // party's travel fields below, so one set of rules checks both; checked in
    // superRefine.
    ...tripFields,
    // This person's airport flights, only used when the party does not all
    // land and fly out on the same days (`hasSplitFlights`).
    ...flightFields,
  })

/**
 * The schema with its messages in `lang`. RegistrationForm makes one per
 * language; the values and rules are the same in every one.
 */
export function makeRegistrationFormSchema(lang: Lang = "en") {
  const t = translator(lang)
  const memberSchema = makeMemberSchema(t)
  return z
    .object({
      type: z.enum(["individual", "family"]),
      groupName: z.string().trim(),
      mandal: z.string().refine(isIn(MANDALS), t("Select your mandal")),
      members: z.array(memberSchema),
      sameSchedule: z.boolean(),
      // The party's dates. Only asked for while everyone travels together —
      // checked in superRefine, since with split dates they are not on screen.
      arrivalDate: z.string(),
      arrivalSlot: z.string(),
      departureDate: z.string(),
      departureSlot: z.string(),
      // "yes" or "no" to the meal served in the arrival or departure slot
      // (SLOT_MEALS). Only asked when that slot has one; checked in superRefine.
      arrivalMeal: z.string(),
      departureMeal: z.string(),
      // "Everyone travels together": unticked, each person's own travel
      // fields are asked instead of the party's (`hasSplitTravel`).
      sameTravel: z.boolean(),
      // The party's travel. Not asked of local mandals (isLocalMandal), nor
      // while each person travels on their own: checked in superRefine.
      ...tripFields,
      // The party's vehicles, asked whenever anyone comes by personal vehicle.
      vehicleCount: z.string().trim(),
      // One per vehicle, all optional. Longer than the count when the count
      // was lowered: kept so raising it again brings the numbers back, and
      // trimmed to the count on submit.
      vehicleNumbers: z.array(z.string().optional()),
      accommodationRequired: z.boolean(),
      notes: z.string().trim(),
      consent: z
        .boolean()
        .refine((v) => v, t("Please confirm the details to submit")),
      // Set by MobileVerification once the primary contact's code is right: the
      // number that was verified, and the server's proof of it. Not inputs.
      verifiedMobile: z.string(),
      mobileVerificationToken: z.string(),
      // Ticked by a sanchalak or admin at the desk instead of sending a code.
      verifiedInPerson: z.boolean(),
      // When editing: the contact number already on the registration. Keeping
      // it needs no new verification. Empty for a new registration.
      keptMobile: z.string(),
      // A number found to be another registration's contact already (one
      // registration per number), and that registration's code. Set by
      // MobileVerification; blocks Continue while the number is the same.
      takenMobile: z.string(),
      takenCode: z.string(),
      // The other people of a family while "Individual" is picked, so switching
      // back brings them back. Never submitted, never validated.
      stashedMembers: z.array(
        z.custom<z.infer<ReturnType<typeof makeMemberSchema>>>(() => true)
      ),
      // "Everyone lands and flies out on the same days": unticked, each
      // person's own flights are asked instead of the party's.
      sameFlights: z.boolean(),
      // The party's airport flights (see flightFields).
      ...flightFields,
    })
    .superRefine((values, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", path, message })
      // Arriving or leaving in a slot with a meal: "will you take it?" needs an answer.
      const checkMeal = (
        path: (string | number)[],
        slot: string,
        answer: string
      ) => {
        if (mealOf(slot) && !MEAL_ANSWERS.includes(answer))
          issue(path, t("Choose yes or no"))
      }
      // How someone travels, at `path`: the party's ([]) or one person's.
      // A pickup or a drop needs its journey: the train's number, station and
      // time; the bus's details and time; or the flight number and time.
      const checkTrip = (trip: TripValues, path: (string | number)[]) => {
        if (!isIn(TRAVEL_CHOICES)(trip.travelMode)) {
          issue([...path, "travelMode"], t("Select how you are travelling"))
        }
        if (!offersPickup(trip.travelMode)) return
        if (!isIn(MEAL_ANSWERS)(trip.needsPickup)) {
          issue([...path, "needsPickup"], t("Select Yes or No"))
        }
        if (!isIn(MEAL_ANSWERS)(trip.needsDrop)) {
          issue([...path, "needsDrop"], t("Select Yes or No"))
        }
        const drop = trip.needsDrop === "yes"
        if (drop && !offersPickup(trip.dropMode)) {
          issue([...path, "dropMode"], t("Select how you are leaving"))
        }
        const legs = [
          {
            wanted: trip.needsPickup === "yes",
            mode: trip.travelMode,
            fields: ["travelReference", "travelStation", "travelTime"] as const,
            timeMessage: t("Pick the arrival time"),
          },
          {
            // Leaving may be by another way than arriving: its own mode.
            wanted: drop && offersPickup(trip.dropMode),
            mode: trip.dropMode,
            fields: ["dropReference", "dropStation", "dropTime"] as const,
            timeMessage: t("Pick the departure time"),
          },
        ]
        for (const { wanted, mode, fields, timeMessage } of legs) {
          if (!wanted) continue
          const [reference, station, time] = fields
          if (!trip[reference].trim()) {
            issue([...path, reference], t(REFERENCE_REQUIRED[mode as DropMode]))
          }
          if (mode === "train" && !trip[station]) {
            issue([...path, station], t("Pick the station"))
          }
          if (!trip[time]) issue([...path, time], timeMessage)
        }
      }

      if (values.type === "family" && values.groupName.length < 2) {
        issue(["groupName"], t("Enter a family name, e.g. Patel family"))
      } else if (
        values.type === "family" &&
        hasNonLatinLetters(values.groupName)
      ) {
        issue(
          ["groupName"],
          t("Write the family name in English letters, e.g. Patel family")
        )
      }

      if (values.type === "individual" && values.members.length !== 1) {
        issue(
          ["members"],
          t("An individual registration has exactly one person")
        )
      }
      if (values.type === "family" && values.members.length < 2) {
        issue(
          ["members"],
          t("Add at least two people to a family registration")
        )
      }

      // The same person added twice: same name, gender and age. A shared name
      // alone is not enough — a father and son can both be "Harit Prakashbhai
      // Patel" — so a different age or gender lets it through. Names compared
      // ignoring case and extra spaces. Flagged on the later entry, which is
      // the one to remove or correct.
      const firstWithName = new Map<string, number>()
      values.members.forEach((member, index) => {
        const key = [
          fullNameOf(member).toLowerCase(),
          member.gender,
          Number(member.age.trim()),
        ].join("|")
        if (
          !member.firstName.trim() ||
          !member.surname.trim() ||
          !member.gender ||
          !member.age.trim()
        )
          return
        const first = firstWithName.get(key)
        if (first === undefined) {
          firstWithName.set(key, index)
          return
        }
        issue(
          ["members", index, "firstName"],
          first === 0
            ? t("Already added as the primary contact")
            : t("Already added as person {n}", { n: first + 1 })
        )
      })

      // A relation that implies a gender has to agree with the gender picked.
      // On the relation field; changing either field re-checks it.
      if (values.type === "family") {
        values.members.forEach((member, index) => {
          const expected =
            RELATION_GENDER[member.relation as keyof typeof RELATION_GENDER]
          if (
            index === 0 ||
            !expected ||
            !member.gender ||
            member.gender === expected
          )
            return
          issue(
            ["members", index, "relation"],
            t(
              "{relation} has to be {gender} — check the gender or the relation",
              {
                relation: t(member.relation),
                gender: t(GENDERS[expected]),
              }
            )
          )
        })
      }

      values.members.forEach((member, index) => {
        if (member.mobile === "") {
          if (index === 0) {
            issue(
              ["members", 0, "mobile"],
              t("The primary contact needs a mobile number")
            )
          }
          return
        }
        const error = mobileError(member.mobile, member.mobileCountry, t)
        if (error) {
          issue(["members", index, "mobile"], error)
          return
        }
        // The primary contact's number has to be verified: by OTP, by a
        // sanchalak or admin in person, or already on the registration being
        // edited. A number changed after verifying needs it again.
        // One registration per contact number.
        if (
          index === 0 &&
          values.takenMobile &&
          contactMobile(values) === values.takenMobile
        ) {
          // No code before the number is verified on the public page.
          issue(
            ["members", 0, "mobile"],
            values.takenCode
              ? t(
                  "Already registered as {code} — one registration per number",
                  {
                    code: values.takenCode,
                  }
                )
              : t("Already registered — one registration per number")
          )
          return
        }
        if (index === 0 && !isContactVerified(values)) {
          issue(
            ["members", 0, "mobile"],
            t("Verify this number with the code we send on WhatsApp")
          )
        }
      })

      // A family is looked after by an adult. Someone registering alone may be
      // younger, so this is for families only.
      const contactAge = Number(values.members[0]?.age)
      if (
        values.type === "family" &&
        contactAge >= 1 &&
        contactAge < MIN_FAMILY_CONTACT_AGE
      ) {
        issue(
          ["members", 0, "age"],
          t("A family's primary contact has to be {age} or older", {
            age: MIN_FAMILY_CONTACT_AGE,
          })
        )
      }

      if (!hasSplitDates(values)) {
        const arrivalChoices = arrivalDays(everyoneSevak(values))
        const departureChoices = departureDays(everyoneSevak(values))
        if (!isIn(arrivalChoices)(values.arrivalDate))
          issue(["arrivalDate"], t("Select the arrival day"))
        if (!isIn(SLOT_VALUES)(values.arrivalSlot))
          issue(["arrivalSlot"], t("Select a time"))
        if (!isIn(departureChoices)(values.departureDate))
          issue(["departureDate"], t("Select the departure day"))
        if (!isIn(SLOT_VALUES)(values.departureSlot))
          issue(["departureSlot"], t("Select a time"))
        checkMeal(["arrivalMeal"], values.arrivalSlot, values.arrivalMeal)
        checkMeal(["departureMeal"], values.departureSlot, values.departureMeal)

        const arrival = {
          date: values.arrivalDate,
          slot: values.arrivalSlot,
        } as StayPoint
        const departure = {
          date: values.departureDate,
          slot: values.departureSlot,
        } as StayPoint
        const datesPicked =
          isIn(arrivalChoices)(values.arrivalDate) &&
          isIn(departureChoices)(values.departureDate) &&
          isIn(SLOT_VALUES)(values.arrivalSlot) &&
          isIn(SLOT_VALUES)(values.departureSlot)
        if (datesPicked && compareStay(departure, arrival) <= 0) {
          issue(["departureDate"], t("Departure has to be after arrival"))
        }
      } else {
        values.members.forEach((member, index) => {
          const path = ["members", index]
          checkMeal(
            [...path, "arrivalMeal"],
            member.arrivalSlot,
            member.arrivalMeal
          )
          checkMeal(
            [...path, "departureMeal"],
            member.departureSlot,
            member.departureMeal
          )
          // Each person's own days: a Swayam Sevak's run all of Jan–Feb.
          const arrivalChoices = arrivalDays(!!member.earlySeva)
          const departureChoices = departureDays(!!member.earlySeva)
          // Both checked, not one then the other, so every gap shows at once.
          const arrivalPicked =
            isIn(arrivalChoices)(member.arrivalDate) &&
            isIn(SLOT_VALUES)(member.arrivalSlot)
          const departurePicked =
            isIn(departureChoices)(member.departureDate) &&
            isIn(SLOT_VALUES)(member.departureSlot)
          if (!arrivalPicked)
            issue([...path, "arrivalDate"], t("Select arrival"))
          if (!departurePicked)
            issue([...path, "departureDate"], t("Select departure"))
          if (!arrivalPicked || !departurePicked) return
          const memberArrival = {
            date: member.arrivalDate,
            slot: member.arrivalSlot,
          } as StayPoint
          const memberDeparture = {
            date: member.departureDate,
            slot: member.departureSlot,
          } as StayPoint
          if (compareStay(memberDeparture, memberArrival) <= 0) {
            issue(
              [...path, "departureDate"],
              t("Departure has to be after arrival")
            )
          }
        })
      }

      // The airport flights are asked on step 2, before the event dates:
      // there a flight only has to fall within reach of the event. Step 3
      // then keeps each person's dates between their landing and flying out,
      // on the date fields shown there.
      if (isOverseas(values)) {
        const firstDay = EVENT.days[0]
        const lastDay = EVENT.days[EVENT.days.length - 1]
        const splitFlights = hasSplitFlights(values)
        // Each set of flights on its own: the party's, or each person's.
        const flightSets = splitFlights
          ? values.members.map((m, i) => ({ f: m, path: ["members", i] }))
          : [{ f: values, path: [] as (string | number)[] }]
        for (const { f, path } of flightSets) {
          const landing = f.indiaNeedsPickup ? f.indiaArrivalDate : ""
          const leaving = f.indiaDepartureDate
          if (f.indiaNeedsPickup && !landing) {
            issue([...path, "indiaArrivalDate"], t("Pick the day you land"))
          }
          if (
            !leaving &&
            (f.indiaDepartureTime || f.indiaDepartureFlight.trim())
          ) {
            issue(
              [...path, "indiaDepartureDate"],
              t("Pick the day you fly out")
            )
          }
          if (landing && landing > lastDay) {
            issue(
              [...path, "indiaArrivalDate"],
              t("The event ends on {date} — land on or before then", {
                date: formatDay(lastDay, lang),
              })
            )
          }
          if (leaving && leaving < firstDay) {
            issue(
              [...path, "indiaDepartureDate"],
              t("The event starts on {date} — fly out on or after then", {
                date: formatDay(firstDay, lang),
              })
            )
          } else if (leaving && landing && leaving < landing) {
            issue(
              [...path, "indiaDepartureDate"],
              t("Has to be after you land")
            )
          }
        }

        // Each person's dates against their flights. Shared dates are held to
        // the latest landing and the earliest flight out in the party.
        const people = values.members.map((m, i) => {
          const f = splitFlights ? m : values
          const dates = hasSplitDates(values) ? m : values
          return {
            landing: f.indiaNeedsPickup ? f.indiaArrivalDate : "",
            leaving: f.indiaDepartureDate,
            arrivalDate: dates.arrivalDate,
            departureDate: dates.departureDate,
            path: hasSplitDates(values) ? ["members", i] : [],
          }
        })
        const checked = hasSplitDates(values)
          ? people
          : [
              {
                ...people[0],
                landing: people
                  .map((p) => p.landing)
                  .filter(Boolean)
                  .sort()
                  .at(-1),
                leaving: people
                  .map((p) => p.leaving)
                  .filter(Boolean)
                  .sort()[0],
              },
            ]
        for (const person of checked) {
          const { landing, leaving } = person
          if (landing && person.arrivalDate && person.arrivalDate < landing) {
            issue(
              [...person.path, "arrivalDate"],
              t("You land in India on {date} — arrive on or after then", {
                date: formatDay(landing, lang),
              })
            )
          }
          if (
            leaving &&
            person.departureDate &&
            person.departureDate > leaving
          ) {
            issue(
              [...person.path, "departureDate"],
              t(
                "Your flight out of India is on {date} — leave on or before then",
                { date: formatDay(leaving, lang) }
              )
            )
          }
        }
      }

      // Locals are not asked how they travel; everyone else picks one of the
      // modes on offer ("local" is set for them, never picked) — once for the
      // party, or for each person when they travel separately.
      if (!isLocalMandal(values.mandal)) {
        if (hasSplitTravel(values)) {
          values.members.forEach((member, index) =>
            checkTrip(member, ["members", index])
          )
        } else {
          checkTrip(values, [])
        }
      }

      if (comesByVehicle(values)) {
        // Asked only when more than one vehicle is possible (never of an
        // individual, nor of a party with one person by vehicle): one to four,
        // and no more than the people coming by vehicle.
        const max = maxVehicles(values)
        const count = Number(values.vehicleCount)
        if (
          asksVehicleCount(values) &&
          values.vehicleCount !== "" &&
          !(Number.isInteger(count) && count >= 1 && count <= max)
        ) {
          issue(
            ["vehicleCount"],
            max < MAX_VEHICLES.family
              ? t("Enter 1 to {max} — no more vehicles than people", { max })
              : t("Enter 1 to {max}", { max })
          )
        }
        // Optional, but a number that is there has to be a real plate, and each
        // vehicle only once.
        const firstWithPlate = new Map<string, number>()
        values.vehicleNumbers
          .slice(0, vehicleSlots(values))
          .forEach((number, index) => {
            const value = (number ?? "").trim()
            if (value === "") return
            if (!isVehiclePlate(value)) {
              issue(
                ["vehicleNumbers", index],
                t("Enter a number like GJ-05-AB-1234")
              )
              return
            }
            const first = firstWithPlate.get(normalizePlate(value))
            if (first !== undefined)
              issue(
                ["vehicleNumbers", index],
                t("Same as vehicle {n}", { n: first + 1 })
              )
            else firstWithPlate.set(normalizePlate(value), index)
          })
      }
    })
}

/** The schema in English: its messages for the desk, its shape for the types. */
export const registrationFormSchema = makeRegistrationFormSchema()

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>

/**
 * The most vehicles one registration can bring: one person drives one, a
 * family up to four. Mirrors the server's limit (upasana-be src/lib/event.ts).
 */
export const MAX_VEHICLES = { individual: 1, family: 4 } as const

/** A family's primary contact has to be at least this old. Mirrors the server. */
export const MIN_FAMILY_CONTACT_AGE = 18

type TravelValues = Pick<
  RegistrationFormValues,
  "type" | "members" | "mandal" | "sameTravel" | "travelMode"
>
type VehicleValues = TravelValues & Pick<RegistrationFormValues, "vehicleCount">

/**
 * Whether each person says how they travel. Only possible with more than one
 * person, and never for a local mandal, which is not asked about travel.
 */
export function hasSplitTravel(
  values: Pick<RegistrationFormValues, "members" | "mandal" | "sameTravel">
) {
  return (
    values.members.length > 1 &&
    !values.sameTravel &&
    !isLocalMandal(values.mandal)
  )
}

/** How many people come by personal vehicle: everyone, nobody, or those who said so. */
export function vehicleTravellers(values: TravelValues) {
  if (isLocalMandal(values.mandal)) return 0
  if (hasSplitTravel(values)) {
    return values.members.filter((m) => m.travelMode === "personal_vehicle")
      .length
  }
  return values.travelMode === "personal_vehicle" ? values.members.length : 0
}

/** Whether anyone comes by personal vehicle, so the party's vehicles are asked. */
export const comesByVehicle = (values: TravelValues) =>
  vehicleTravellers(values) > 0

/**
 * No more vehicles than the people coming in them: one for an individual, up
 * to four for a family.
 */
export function maxVehicles(values: TravelValues) {
  return Math.max(
    1,
    Math.min(MAX_VEHICLES[values.type], vehicleTravellers(values))
  )
}

/** "Number of vehicles" is asked only when more than one is possible. */
export const asksVehicleCount = (values: TravelValues) =>
  maxVehicles(values) > 1

/**
 * How many vehicles — and vehicle-number boxes — a registration has. Always
 * one for an individual; for a family what "Number of vehicles" says, kept
 * between one and `maxVehicles`, and one while that box is empty or mid-edit.
 */
export function vehicleSlots(values: VehicleValues) {
  const n = Number(values.vehicleCount)
  return Number.isInteger(n) && n >= 1 ? Math.min(n, maxVehicles(values)) : 1
}

/** "gj 05-ab 1234" → "GJ05AB1234": how two plates are compared. */
export const normalizePlate = (plate: string) =>
  plate.toUpperCase().replace(/[\s.-]/g, "")

/**
 * An Indian number plate: state, district, up to three series letters, four
 * digits (GJ-05-AB-1234), or a Bharat series plate (22 BH 1234 AA). Spaces and
 * dashes are optional. Mirrors isVehiclePlate on the server.
 */
export const isVehiclePlate = (plate: string) =>
  /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(normalizePlate(plate)) ||
  /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(normalizePlate(plate))

/** The contact's number as entered, in E.164, or undefined while it is not a valid number. */
export function contactMobile(values: Pick<RegistrationFormValues, "members">) {
  const contact = values.members[0]
  if (!contact?.mobile || mobileError(contact.mobile, contact.mobileCountry))
    return undefined
  return toE164(contact.mobileCountry, contact.mobile)
}

/**
 * Whether the contact number needs a WhatsApp code. Off from 2026-10-13 to
 * 2026-10-23 while WhatsApp was not set up; off, the form asks for no code on
 * the contact number. Change together with MOBILE_OTP_REQUIRED in
 * upasana-be/src/lib/otp.ts.
 */
export const MOBILE_OTP_REQUIRED = true

/**
 * Whether the contact's number is verified: unchanged from the registration
 * being edited, vouched for in person, or confirmed by an OTP for this very
 * number. Always, while codes are switched off.
 */
export function isContactVerified(
  values: Pick<
    RegistrationFormValues,
    | "members"
    | "keptMobile"
    | "verifiedInPerson"
    | "verifiedMobile"
    | "mobileVerificationToken"
  >
) {
  const mobile = contactMobile(values)
  if (!mobile) return false
  if (values.keptMobile && mobile === values.keptMobile) return true
  if (values.verifiedInPerson || !MOBILE_OTP_REQUIRED) return true
  return mobile === values.verifiedMobile && !!values.mobileVerificationToken
}

/**
 * Whether the form asks about landing in India: the mandal is abroad. Asked
 * on the people step, under the people.
 */
export function isOverseas(values: Pick<RegistrationFormValues, "mandal">) {
  return OVERSEAS_MANDALS.includes(values.mandal)
}

/**
 * Whether each person gives their own airport flights: from abroad, more
 * than one person, and "everyone lands and flies out on the same days"
 * unticked — some may land days before the others.
 */
export function hasSplitFlights(
  values: Pick<RegistrationFormValues, "members" | "mandal" | "sameFlights">
) {
  return isOverseas(values) && values.members.length > 1 && !values.sameFlights
}

/** A flight as saved: only the parts given. */
const indiaFlight = (
  date: string,
  time: string,
  flight: string
): IndiaFlight => ({
  date,
  time: orUndefined(time),
  flight: orUndefined(flight.trim().toUpperCase()),
})

/**
 * The airport pickup and flight out as saved, the party's or one person's:
 * only for someone from abroad who ticked the pickup or gave the day they fly
 * out.
 */
export function indiaTravelOf(
  values: FlightValues & Pick<RegistrationFormValues, "mandal">
): IndiaTravel | undefined {
  const { indiaNeedsPickup: needsPickup, indiaDepartureDate: leaving } = values
  if (!isOverseas(values) || (!needsPickup && !leaving)) return undefined
  return {
    needsPickup,
    // No drop is arranged any more; the flight out is for the record.
    needsDrop: false,
    arrival: needsPickup
      ? indiaFlight(
          values.indiaArrivalDate,
          values.indiaArrivalTime,
          values.indiaArrivalFlight
        )
      : undefined,
    departure: leaving
      ? indiaFlight(
          values.indiaDepartureDate,
          values.indiaDepartureTime,
          values.indiaDepartureFlight
        )
      : undefined,
  }
}

/** Smallest believable age gaps, for the "check the age" hints. */
const RELATION_AGE_GAP: Partial<
  Record<string, { older: boolean; years: number }>
> = {
  Son: { older: false, years: 14 },
  Daughter: { older: false, years: 14 },
  Father: { older: true, years: 14 },
  Mother: { older: true, years: 14 },
  Grandfather: { older: true, years: 30 },
  Grandmother: { older: true, years: 30 },
  Grandchild: { older: false, years: 30 },
}

/**
 * Gentle hints where an age and a relation do not fit — a "Son" older than the
 * contact, a "Father" younger. Usually a typo, so they never block Continue.
 * By person index; only for people whose relation and both ages are filled.
 */
export function relationAgeHints(
  values: Pick<RegistrationFormValues, "type" | "members">,
  t: Translate
) {
  const hints = new Map<number, string>()
  if (values.type !== "family") return hints
  const contact = values.members[0]
  const contactAge = Number(contact?.age)
  if (!contactAge) return hints
  values.members.forEach((member, index) => {
    const gap = RELATION_AGE_GAP[member.relation]
    const age = Number(member.age)
    if (index === 0 || !gap || !age) return
    const fits = gap.older
      ? age >= contactAge + gap.years
      : age <= contactAge - gap.years
    if (fits) return
    const who = contact.firstName.trim() || t("the primary contact")
    const vars = {
      relation: t(member.relation).toLowerCase(),
      years: gap.years,
      who,
      age: contactAge,
    }
    hints.set(
      index,
      gap.older
        ? t(
            "Check the age: a {relation} is usually at least {years} years older than {who} ({age}).",
            vars
          )
        : t(
            "Check the age: a {relation} is usually at least {years} years younger than {who} ({age}).",
            vars
          )
    )
  })
  return hints
}

const PARTY_DATES = [
  "arrivalDate",
  "arrivalSlot",
  "departureDate",
  "departureSlot",
]

/**
 * Which fields' rules read the field that just changed — passed to
 * `keepErrorsFresh`, so a conflict between two fields shows whichever one was
 * edited last. Keep in step with the cross-field rules in the schema above.
 */
export function relatedFields(
  changed: string,
  values: RegistrationFormValues
): string[] {
  if (PARTY_DATES.includes(changed)) return PARTY_DATES
  // Flying out after landing: either date can make or break it.
  if (["indiaArrivalDate", "indiaNeedsPickup"].includes(changed)) {
    return ["indiaDepartureDate"]
  }
  // Adding or removing someone, or who comes by vehicle, changes how many
  // vehicles are allowed.
  if (["members", "type", "sameTravel", "travelMode"].includes(changed)) {
    return ["vehicleCount"]
  }
  // Two boxes with one plate: every plate is compared with every other.
  if (/^vehicleNumbers\.\d+$/.test(changed)) {
    return values.vehicleNumbers.map((_, i) => `vehicleNumbers.${i}`)
  }

  const match = /^members\.(\d+)\.(\w+)$/.exec(changed)
  if (!match) return []
  const [, index, field] = match
  const person = `members.${index}`
  switch (field) {
    // "Son" has to be male: either field can make or break it.
    case "gender":
    case "relation":
      return [`${person}.relation`]
    // A day and its time slot, and departure after arrival.
    case "arrivalDate":
    case "arrivalSlot":
    case "departureDate":
    case "departureSlot":
      return [`${person}.arrivalDate`, `${person}.departureDate`]
    // A number's valid length and first digit depend on its country code.
    case "mobileCountry":
      return [`${person}.mobile`]
    case "indiaArrivalDate":
    case "indiaNeedsPickup":
      return [`${person}.indiaDepartureDate`]
    // Which days this person may pick, and the party's shared ones, which
    // leave the event's days only while everyone is a Swayam Sevak.
    case "earlySeva":
      return [
        `${person}.arrivalDate`,
        `${person}.departureDate`,
        "arrivalDate",
        "departureDate",
      ]
    case "travelMode":
      return ["vehicleCount"]
    // Two people with one name: every name is compared with every other.
    // The clash shows on the first name, whichever part was changed.
    case "firstName":
    case "middleName":
    case "surname":
      return values.members.map((_, i) => `members.${i}.firstName`)
    default:
      return []
  }
}

/**
 * Whether each person has their own dates. Only possible with more than one
 * person: the "everyone together" box is not shown for one, so a lone member
 * left over after unticking it and removing the others is back on the party's
 * dates. Always, in a party where anyone is arriving early for seva: a Swayam
 * Sevak's days differ from the rest, so the box is hidden and each person
 * gives their own.
 */
export function hasSplitDates(
  values: Pick<RegistrationFormValues, "members" | "sameSchedule">
) {
  return values.members.length > 1 && (!values.sameSchedule || anySevak(values))
}

/** Whether anyone in the party is arriving early for seva as a Swayam Sevak. */
export const anySevak = (values: {
  members: readonly { earlySeva?: boolean }[]
}) => values.members.some((m) => !!m.earlySeva)
export type MemberFormValues = RegistrationFormValues["members"][number]

type DatesValues = Pick<
  RegistrationFormValues,
  "members" | "sameSchedule" | "arrivalDate" | "departureDate"
>

/**
 * Everyone arrives and leaves on the same day, so nobody spends a night and
 * there is no bed to ask for. False until every leaving day is picked.
 */
export function isSameDayVisit(values: DatesValues) {
  const people = hasSplitDates(values)
    ? values.members
    : [{ arrivalDate: values.arrivalDate, departureDate: values.departureDate }]
  return people.every(
    (p) =>
      !!p.arrivalDate && !!p.departureDate && p.departureDate <= p.arrivalDate
  )
}

/**
 * This person leaves the day they arrive, so there is no night to give them
 * a bed for. False until both their days are picked.
 */
export function isSameDayFor(values: DatesValues, index: number) {
  const p = hasSplitDates(values) ? values.members[index] : values
  return (
    !!p?.arrivalDate && !!p.departureDate && p.departureDate <= p.arrivalDate
  )
}

type AccommodationValues = DatesValues &
  Pick<RegistrationFormValues, "accommodationRequired" | "mandal">

/**
 * Whether the form asks for "everyone" at once. `accommodationRequired` is
 * that box; with one person it is simply their answer.
 */
export const accommodationPerPerson = (values: AccommodationValues) =>
  values.members.length > 1 && !values.accommodationRequired

/**
 * For each person, whether they get a bed as the form stands: everyone when
 * the box for everyone is ticked, otherwise each person's own tick. Never
 * someone with no night here.
 */
export function bedsWanted(values: AccommodationValues) {
  // Locals go home at night: they are not asked, and get no bed.
  if (isLocalMandal(values.mandal)) return values.members.map(() => false)
  const perPerson = accommodationPerPerson(values)
  return values.members.map(
    (member, index) =>
      (perPerson
        ? !!member.needsAccommodation
        : values.accommodationRequired) && !isSameDayFor(values, index)
  )
}

/** Accommodation as it is saved: anyone in the party has a bed coming. */
export function needsAccommodation(values: AccommodationValues) {
  return bedsWanted(values).some(Boolean)
}

/** The fields each step owns, so Continue validates only what is on screen. */
export const STEP_FIELDS = [
  ["type", "groupName", "mandal"],
  ["members", "sameFlights", "indiaArrivalDate", "indiaDepartureDate"],
  [
    "arrivalDate",
    "arrivalSlot",
    "departureDate",
    "departureSlot",
    "arrivalMeal",
    "departureMeal",
    "members",
    "sameTravel",
    "travelMode",
    "needsPickup",
    "travelReference",
    "travelStation",
    "travelTime",
    "needsDrop",
    "dropMode",
    "dropReference",
    "dropStation",
    "dropTime",
    "vehicleCount",
    "vehicleNumbers",
  ],
  ["consent"],
] as const satisfies readonly (readonly (keyof RegistrationFormValues)[])[]

/** A person's own days and travel, asked on step 3. The rest of a person — name, age, number, flights — is step 2's. */
const MEMBER_STAY_FIELDS: readonly string[] = [
  "arrivalDate",
  "arrivalSlot",
  "departureDate",
  "departureSlot",
  "arrivalMeal",
  "departureMeal",
  "needsAccommodation",
  "earlySeva",
  ...TRIP_FIELDS,
]
const MEMBER_FIELDS = Object.keys(makeMemberSchema(translator("en")).shape)

/**
 * The paths Continue checks on `step`: STEP_FIELDS with "members" spelled out
 * as each person's fields that are asked on that step, plus the list's own
 * error ("Add at least two people") on step 2.
 *
 * Checking "members" whole also checked every person's step-3 fields, which
 * are not on screen at step 2: going back from step 3 with someone's days or
 * travel unfinished left step 2's Continue refusing, with no error showing.
 * The same held the other way for a step 3 reached from the step bar.
 */
export function stepFieldPaths(
  step: number,
  values: Pick<RegistrationFormValues, "members">
): string[] {
  const own = MEMBER_FIELDS.filter((field) =>
    step === 2
      ? MEMBER_STAY_FIELDS.includes(field)
      : !MEMBER_STAY_FIELDS.includes(field)
  )
  return STEP_FIELDS[step].flatMap((field) =>
    field !== "members"
      ? [field]
      : [
          // The list error sits on `root` once any person's path is named.
          ...(step === 1 ? ["members.root"] : []),
          ...values.members.flatMap((_, index) =>
            own.map((name) => `members.${index}.${name}`)
          ),
        ]
  )
}

export const EMPTY_TRIP: TripValues = {
  travelMode: "",
  travelReference: "",
  travelTime: "",
  travelStation: "",
  needsPickup: "",
  needsDrop: "",
  dropMode: "",
  dropReference: "",
  dropStation: "",
  dropTime: "",
}

export function emptyMember(): MemberFormValues {
  return {
    ...EMPTY_TRIP,
    firstName: "",
    middleName: "",
    surname: "",
    gender: "",
    age: "",
    mobileCountry: DEFAULT_COUNTRY_CODE,
    mobile: "",
    relation: "",
    needsAssistance: false,
    assistanceNote: "",
    // No unless they say Yes: most who come for the Mahotsav do not stay on
    // for the Convention, and an unanswered question saved nothing at all.
    youthConvention: "no",
    arrivalDate: "",
    arrivalSlot: "",
    departureDate: "",
    departureSlot: "",
    arrivalMeal: "",
    departureMeal: "",
    needsAccommodation: false,
    earlySeva: false,
    ...EMPTY_FLIGHTS,
  }
}

export const DEFAULT_VALUES: RegistrationFormValues = {
  type: "individual",
  groupName: "",
  mandal: "",
  members: [emptyMember()],
  sameSchedule: true,
  arrivalDate: "",
  arrivalSlot: "",
  departureDate: "",
  departureSlot: "",
  arrivalMeal: "",
  departureMeal: "",
  sameTravel: true,
  ...EMPTY_TRIP,
  vehicleCount: "1",
  vehicleNumbers: [""],
  accommodationRequired: false,
  notes: "",
  consent: false,
  verifiedMobile: "",
  mobileVerificationToken: "",
  verifiedInPerson: false,
  keptMobile: "",
  takenMobile: "",
  takenCode: "",
  stashedMembers: [],
  sameFlights: true,
  ...EMPTY_FLIGHTS,
}

const orUndefined = (value: string) => (value === "" ? undefined : value)

/** Validated form values → the record the API accepts. */
export function toNewRegistration(
  values: RegistrationFormValues,
  source: NewRegistration["source"]
): NewRegistration {
  const arrival: StayPoint = {
    date: values.arrivalDate as StayDate,
    slot: values.arrivalSlot as TimeSlot,
    meal: mealTaken(values.arrivalSlot, values.arrivalMeal),
  }
  const departure: StayPoint = {
    date: values.departureDate as StayDate,
    slot: values.departureSlot as TimeSlot,
    meal: mealTaken(values.departureSlot, values.departureMeal),
  }
  const local = isLocalMandal(values.mandal)
  const split = hasSplitDates(values)
  const splitTravel = hasSplitTravel(values)
  const splitFlights = hasSplitFlights(values)
  const type: RegistrationType = values.type

  const beds = bedsWanted(values)
  const members = values.members.map((member, index) => ({
    needsAccommodation: beds[index],
    // Empty for someone new: the server assigns their id.
    id: member.key ?? "",
    firstName: member.firstName.trim().replace(/\s+/g, " "),
    middleName: member.middleName.trim().replace(/\s+/g, " "),
    surname: member.surname.trim().replace(/\s+/g, " "),
    gender: member.gender as Gender,
    age: Number(member.age),
    mobile: member.mobile
      ? toE164(member.mobileCountry, member.mobile)
      : undefined,
    // Optional: left unpicked, it is simply not sent.
    relation:
      index > 0 && type === "family" ? orUndefined(member.relation) : undefined,
    isPrimary: index === 0,
    needsAssistance: member.needsAssistance,
    assistanceNote: member.needsAssistance
      ? orUndefined(member.assistanceNote.trim())
      : undefined,
    attendsYouthConvention: asksYouthConvention(member.age)
      ? yesNoAnswer(member.youthConvention)
      : undefined,
    earlySeva: !!member.earlySeva,
    travel: splitTravel ? tripRecord(member) : undefined,
    indiaTravel: splitFlights
      ? indiaTravelOf({ ...member, mandal: values.mandal })
      : undefined,
    arrival: !split
      ? arrival
      : {
          date: member.arrivalDate as StayDate,
          slot: member.arrivalSlot as TimeSlot,
          meal: mealTaken(member.arrivalSlot, member.arrivalMeal),
        },
    departure: !split
      ? departure
      : {
          date: member.departureDate as StayDate,
          slot: member.departureSlot as TimeSlot,
          meal: mealTaken(member.departureSlot, member.departureMeal),
        },
  }))

  // With split dates, the booking spans from the first person in to the last
  // person out, which is what the accommodation team plans the room around.
  const bookingArrival = !split
    ? arrival
    : members.map((m) => m.arrival).sort(compareStay)[0]
  const bookingDeparture = !split
    ? departure
    : members
        .map((m) => m.departure)
        .sort(compareStay)
        .at(-1)!

  return {
    type,
    groupName: type === "individual" ? undefined : values.groupName,
    mandal: values.mandal,
    members,
    arrival: bookingArrival,
    departure: bookingDeparture,
    travel: {
      // Locals are not asked: they travel from home. A party travelling
      // separately only says so here; each person's way is on them.
      ...(local
        ? tripRecord({ ...EMPTY_TRIP, travelMode: "local" })
        : splitTravel
          ? {
              ...tripRecord({ ...EMPTY_TRIP, travelMode: "separate" }),
              needsPickup: members.some((m) => m.travel?.needsPickup),
              needsDrop: members.some((m) => !!m.travel?.needsDrop),
            }
          : tripRecord(values)),
      ...(comesByVehicle(values)
        ? {
            vehicleCount: vehicleSlots(values),
            // Only the boxes on screen, without the blank ones.
            vehicleNumbers: values.vehicleNumbers
              .slice(0, vehicleSlots(values))
              .map((number) => (number ?? "").trim().toUpperCase())
              .filter(Boolean),
          }
        : {}),
    },
    accommodationRequired: beds.some(Boolean),
    // Split: each person's are on them.
    indiaTravel: splitFlights ? undefined : indiaTravelOf(values),
    notes: orUndefined(values.notes),
    source,
    // How the contact's number is vouched for. Nothing when an edit keeps it.
    ...contactProof(values),
  }
}

/**
 * The party's travel, or one person's, as saved: by train, bus or flight the
 * details only with a pickup, and the journey home only with a drop — either
 * without the other.
 */
function tripRecord(trip: TripValues): PersonTravel {
  const mode = trip.travelMode as TravelMode
  const pickup = offersPickup(mode) && trip.needsPickup === "yes"
  const drop = offersPickup(mode) && trip.needsDrop === "yes"
  return {
    mode,
    reference:
      mode === "personal_vehicle" ||
      mode === "local" ||
      mode === "separate" ||
      (offersPickup(mode) && !pickup)
        ? undefined
        : orUndefined(asTyped(mode, trip.travelReference)),
    arrivalTime: pickup ? orUndefined(trip.travelTime) : undefined,
    station:
      mode === "train" && pickup ? orUndefined(trip.travelStation) : undefined,
    needsPickup: pickup,
    needsDrop: drop,
    departureMode:
      drop && offersPickup(trip.dropMode) ? trip.dropMode : undefined,
    departureReference: drop
      ? orUndefined(asTyped(trip.dropMode, trip.dropReference))
      : undefined,
    departureStation:
      drop && trip.dropMode === "train"
        ? orUndefined(trip.dropStation)
        : undefined,
    departureTime: drop ? orUndefined(trip.dropTime) : undefined,
  }
}

/** A saved journey back as the form's travel fields. */
function tripValues(travel: PersonTravel): TripValues {
  return {
    travelMode: travel.mode,
    travelReference: travel.reference ?? "",
    travelTime: travel.arrivalTime ?? "",
    travelStation: travel.station ?? "",
    needsPickup: offersPickup(travel.mode)
      ? travel.needsPickup
        ? "yes"
        : "no"
      : "",
    needsDrop: offersPickup(travel.mode)
      ? travel.needsDrop
        ? "yes"
        : "no"
      : "",
    // Before it was asked, leaving was the way they came.
    dropMode:
      travel.departureMode ??
      (travel.needsDrop && offersPickup(travel.mode) ? travel.mode : ""),
    dropReference: travel.departureReference ?? "",
    dropStation: travel.departureStation ?? "",
    dropTime: travel.departureTime ?? "",
  }
}

function contactProof(values: RegistrationFormValues) {
  const mobile = contactMobile(values)
  if (values.keptMobile && mobile === values.keptMobile) return {}
  if (values.verifiedInPerson) return { verifiedInPerson: true }
  if (!MOBILE_OTP_REQUIRED) return {}
  return { mobileVerificationToken: values.mobileVerificationToken }
}

/**
 * A saved registration as form values, for editing it. The contact's number
 * goes into `keptMobile`, so leaving it alone needs no new verification.
 */
export function fromRegistration(
  registration: Registration
): RegistrationFormValues {
  // A party with a Swayam Sevak gives each person's dates even when they match.
  const split =
    hasSplitSchedule(registration) ||
    (registration.members.length > 1 &&
      registration.members.some((m) => isSevak(registration, m)))
  const splitTravel = registration.travel.mode === "separate"
  const splitFlights = hasOwnFlights(registration)
  const members = registration.members.map((member) => {
    const phone = member.mobile ? fromE164(member.mobile) : undefined
    return {
      ...emptyMember(),
      key: member.id,
      firstName: member.firstName,
      middleName: member.middleName ?? "",
      surname: member.surname,
      gender: member.gender,
      age: String(member.age),
      mobileCountry: phone?.code ?? DEFAULT_COUNTRY_CODE,
      mobile: phone?.national ?? "",
      relation: member.relation ?? "",
      needsAssistance: member.needsAssistance,
      assistanceNote: member.assistanceNote ?? "",
      // Never answered (saved before it was asked, or over 40 then) opens on
      // No, as a new person does.
      youthConvention: member.attendsYouthConvention ? "yes" : "no",
      arrivalDate: split ? member.arrival.date : "",
      arrivalSlot: split ? member.arrival.slot : "",
      departureDate: split ? member.departure.date : "",
      departureSlot: split ? member.departure.slot : "",
      arrivalMeal: split ? mealAnswer(member.arrival) : "",
      departureMeal: split ? mealAnswer(member.departure) : "",
      needsAccommodation: wantsBed(registration, member),
      earlySeva: isSevak(registration, member),
      ...(splitTravel && member.travel ? tripValues(member.travel) : {}),
      ...(splitFlights ? fromIndiaTravel(member.indiaTravel) : {}),
    }
  })
  // "Everyone" stays ticked only when everyone who stays a night has a bed; a
  // party where only some do opens on the per-person ticks.
  const everyone = registration.members.every(
    (m, i) =>
      members[i].needsAccommodation || m.departure.date <= m.arrival.date
  )
  const count = registration.travel.vehicleCount ?? 1
  const numbers = registration.travel.vehicleNumbers ?? []
  return {
    ...DEFAULT_VALUES,
    type: registration.type,
    groupName: registration.groupName ?? "",
    mandal: registration.mandal,
    members,
    sameSchedule: !split,
    arrivalDate: registration.arrival.date,
    arrivalSlot: registration.arrival.slot,
    departureDate: registration.departure.date,
    departureSlot: registration.departure.slot,
    arrivalMeal: mealAnswer(registration.arrival),
    departureMeal: mealAnswer(registration.departure),
    sameTravel: !splitTravel,
    ...(splitTravel ? {} : tripValues(registration.travel)),
    vehicleCount: String(count),
    vehicleNumbers: [
      ...numbers,
      ...Array<string>(Math.max(1, count) - numbers.length).fill(""),
    ].slice(0, Math.max(1, count, numbers.length)),
    accommodationRequired: registration.accommodationRequired && everyone,
    sameFlights: !splitFlights,
    ...fromIndiaTravel(splitFlights ? undefined : registration.indiaTravel),
    notes: registration.notes ?? "",
    keptMobile: registration.members[0]?.mobile ?? "",
  }
}

/** A saved airport pickup and flight out back as form values. */
function fromIndiaTravel(india?: IndiaTravel): FlightValues {
  return {
    indiaNeedsPickup: india?.needsPickup ?? false,
    indiaArrivalDate: india?.arrival?.date ?? "",
    indiaArrivalTime: india?.arrival?.time ?? "",
    indiaArrivalFlight: india?.arrival?.flight ?? "",
    indiaDepartureDate: india?.departure?.date ?? "",
    indiaDepartureTime: india?.departure?.time ?? "",
    indiaDepartureFlight: india?.departure?.flight ?? "",
  }
}
