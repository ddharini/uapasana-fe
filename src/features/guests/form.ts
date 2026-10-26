import { EVENT } from "@/config/event"
import {
  DEFAULT_COUNTRY_CODE,
  fromE164,
  mobileError,
  toE164,
} from "@/lib/phone"

import {
  MAX_GUESTS_PER_DAY,
  type GuestMeal,
  type GuestVisit,
  type GuestVisitInput,
} from "./api"

/**
 * The guest form's values, rules and request body, apart from the screen.
 * Rules mirror `guestVisitSchema` in upasana-be/src/lib/guests.ts.
 */

export type DayValues = {
  date: string
  on: boolean
  /** Digits as typed. */
  guests: string
  /** The mahaprasad they take that day: any of lunch and dinner. */
  meals: GuestMeal[]
  /**
   * "No mahaprasad" ticked. Asked outright, so a day with nothing ticked is
   * unanswered rather than read as "no". Never set together with `meals`.
   */
  noMeal: boolean
}

export type GuestFormValues = {
  hostName: string
  countryCode: string
  /** National digits. */
  hostMobile: string
  hostMandal: string
  guestNames: string
  days: DayValues[]
  notes: string
}

/** Field → message. A day's fields are "<date>.guests" and "<date>.meal". */
export type GuestFormErrors = Record<string, string>

/** Whose guests: carried over when a host adds another group. */
export type GuestHost = Pick<
  GuestVisit,
  "hostName" | "hostMobile" | "hostMandal"
>

export function initialValues(
  visit?: GuestVisit,
  lockedMandal?: string,
  host: GuestHost | undefined = visit
): GuestFormValues {
  const phone = host ? fromE164(host.hostMobile) : undefined
  return {
    hostName: host?.hostName ?? "",
    countryCode: phone?.code ?? DEFAULT_COUNTRY_CODE,
    hostMobile: phone?.national ?? "",
    hostMandal: lockedMandal ?? host?.hostMandal ?? "",
    guestNames: visit?.guestNames ?? "",
    days: EVENT.days.map((date) => {
      const day = visit?.days.find((d) => d.date === date)
      return day
        ? {
            date,
            on: true,
            guests: String(day.guests),
            meals: day.meals,
            noMeal: day.meals.length === 0,
          }
        : { date, on: false, guests: "", meals: [], noMeal: false }
    }),
    notes: visit?.notes ?? "",
  }
}

/** Mirrors `guestVisitSchema` in upasana-be/src/lib/guests.ts. Every problem at once. */
export function validate(v: GuestFormValues): GuestFormErrors {
  const errors: GuestFormErrors = {}
  if (!v.hostName.trim()) errors.hostName = "Enter a name"
  else if (v.hostName.trim().length > 80)
    errors.hostName = "Keep it under 80 characters"

  if (!v.hostMobile) errors.hostMobile = "Enter a mobile number"
  else {
    const problem = mobileError(v.hostMobile, v.countryCode)
    if (problem) errors.hostMobile = problem
  }

  if (!v.hostMandal) errors.hostMandal = "Pick a mandal"

  const on = v.days.filter((d) => d.on)
  if (on.length === 0) errors.days = "Pick at least one day"
  for (const day of on) {
    const guests = Number(day.guests)
    if (!day.guests) errors[`${day.date}.guests`] = "Enter how many"
    else if (guests < 1) errors[`${day.date}.guests`] = "At least 1"
    else if (guests > MAX_GUESTS_PER_DAY)
      errors[`${day.date}.guests`] =
        `At most ${MAX_GUESTS_PER_DAY} — call the team for a bigger party`
    if (day.meals.length === 0 && !day.noMeal)
      errors[`${day.date}.meal`] = "Tick lunch, dinner, or no mahaprasad"
  }

  if (v.guestNames.trim().length > 300)
    errors.guestNames = "Keep it under 300 characters"
  if (v.notes.trim().length > 300) errors.notes = "Keep it under 300 characters"
  return errors
}

/** The request body, once `validate` passes. */
export function toInput(v: GuestFormValues): GuestVisitInput {
  return {
    hostName: v.hostName.trim(),
    hostMobile: toE164(v.countryCode, v.hostMobile),
    hostMandal: v.hostMandal,
    guestNames: v.guestNames.trim() || undefined,
    days: v.days
      .filter((d) => d.on)
      .map((d) => ({
        date: d.date,
        guests: Number(d.guests),
        meals: d.noMeal ? [] : d.meals,
      })),
    notes: v.notes.trim() || undefined,
  }
}
