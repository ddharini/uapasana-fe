import { TIME_SLOTS, formatStayDate, mealOf, toLocalDate } from "@/config/event"
import { localeOf, translator, type Lang } from "@/i18n/translate"
import { formatTime } from "@/lib/time"

import {
  TRAVEL_MODES,
  type IndiaFlight,
  type PersonTravel,
  type Registration,
  type StayPoint,
} from "./types"

/** "Thu 24 Dec · Day before, evening · with dinner" */
export function formatStay(point: StayPoint, lang: Lang = "en") {
  const meal = formatMeal(point, lang)
  const slot = translator(lang)(TIME_SLOTS[point.slot]).split(" (")[0]
  return `${formatStayDate(point.date, lang)}, ${slot.toLowerCase()}${meal ? ` · ${meal}` : ""}`
}

/** "with breakfast" or "no breakfast"; empty on registrations from before it was asked. */
export function formatMeal(
  point: Pick<StayPoint, "slot" | "meal">,
  lang: Lang = "en"
) {
  const t = translator(lang)
  const meal = mealOf(point.slot)
  if (!meal || point.meal === undefined) return ""
  return point.meal
    ? t("with {meal}", { meal: t(meal) })
    : t("no {meal}", { meal: t(meal) })
}

/** "Sun 24 Jan, 6:30 am · AI 144" — the time and number when given. */
export function formatIndiaFlight(flight: IndiaFlight, lang: Lang = "en") {
  const flightDate = new Intl.DateTimeFormat(localeOf(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const when = [
    flightDate.format(toLocalDate(flight.date)).replace(",", ""),
    flight.time && formatTime(flight.time),
  ]
    .filter(Boolean)
    .join(", ")
  return [when, flight.flight].filter(Boolean).join(" · ")
}

/** The name a registration goes by in lists: the family name, else the person. */
export function displayName(registration: Registration) {
  return registration.groupName ?? registration.members[0]?.fullName ?? "—"
}

/** "3 Oct, 2:15 pm" in the viewer's own time zone. */
export function formatCreatedAt(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

/** "Train · 12009 Shatabdi Exp · Sabarmati · reaches 6:30 am": how someone gets here. */
export function comingByText(travel: PersonTravel) {
  return [
    TRAVEL_MODES[travel.mode],
    travel.reference,
    travel.station,
    travel.arrivalTime && `reaches ${formatTime(travel.arrivalTime)}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** "Train · 12010 Shatabdi Exp · Kalupur · leaves 6:45 pm": the journey home, given with a drop. */
export function journeyHomeText(travel: PersonTravel) {
  return [
    travel.departureMode && TRAVEL_MODES[travel.departureMode],
    travel.departureReference,
    travel.departureStation,
    travel.departureTime && `leaves ${formatTime(travel.departureTime)}`,
  ]
    .filter(Boolean)
    .join(" · ")
}
