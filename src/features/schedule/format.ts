import { toLocalDate } from "@/config/event"

import { SESSION_KINDS, type BuiltInKind } from "./api"

type KindStyle = {
  label: string
  dot: string
  badge: "default" | "warning" | "info" | "secondary" | "outline"
}

export const KINDS: Record<BuiltInKind, KindStyle> = {
  sabha: { label: "Sabha", dot: "bg-primary", badge: "default" },
  aarti: { label: "Aarti", dot: "bg-orange-500", badge: "secondary" },
  prasad: { label: "Prasad", dot: "bg-amber-500", badge: "warning" },
  cultural: { label: "Cultural", dot: "bg-sky-500", badge: "info" },
}

export const isBuiltInKind = (kind: string): kind is BuiltInKind =>
  (SESSION_KINDS as readonly string[]).includes(kind)

/** Dots for custom types. Picked by name, so a type keeps its colour everywhere. */
const CUSTOM_DOTS = [
  "bg-violet-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-slate-500",
]

export function kindStyle(kind: string): KindStyle {
  if (isBuiltInKind(kind)) return KINDS[kind]
  let hash = 0
  for (const char of kind.toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return {
    label: kind,
    dot: CUSTOM_DOTS[hash % CUSTOM_DOTS.length],
    badge: "outline",
  }
}

/**
 * A custom type as typed, trimmed — or the built-in key when it names one
 * ("sabha" typed as a custom type is just Sabha).
 */
export function normalizeKind(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ")
  const builtIn = SESSION_KINDS.find(
    (k) => KINDS[k].label.toLowerCase() === trimmed.toLowerCase()
  )
  return builtIn ?? trimmed
}

/**
 * A Google Maps link. Mirrors GOOGLE_MAPS_URL in upasana-be/src/lib/schedule.ts:
 * only Google Maps hosts, since the link becomes an href.
 */
export const GOOGLE_MAPS_URL =
  /^https?:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|(www\.)?google\.[a-z.]{2,6}\/maps|maps\.google\.[a-z.]{2,6}(\/|\?|$))\S*$/i

const SHORT_DATE = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

/** "Sat, 2 Jan" */
export const formatShortDate = (iso: string) =>
  SHORT_DATE.format(toLocalDate(iso))

/** "10:00" → "10 am", "18:30" → "6:30 pm". */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  const hour = h % 12 || 12
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`
}

/** "HH:MM" moved by `minutes`, kept within the same day (00:00 – 23:59). */
export function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number)
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** "YYYY-MM-DD" for the day after `iso`. */
export function nextDate(iso: string) {
  const d = toLocalDate(iso)
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
