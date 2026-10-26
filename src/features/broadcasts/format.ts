import type { Registration } from "@/features/registrations/types"
import { formatMobile } from "@/lib/phone"

import type { VariableSpec } from "./api"

/*
 * Send messages, worked out in the browser exactly as the server will do it
 * (src/lib/broadcasts.ts), so the preview and the count match what is sent.
 */

/** "919876543210" → "+91 98765 43210". */
export const showNumber = (digits: string) => formatMobile(`+${digits}`)

/** The body with its blanks filled. Mirrors `renderBody` on the server. */
export const renderBody = (body: string, values: string[]) =>
  body.replace(/\{\{(\d+)\}\}/g, (all, n) => values[Number(n) - 1] ?? all)

/** Line breaks and runs of spaces, as Meta accepts a value. Mirrors `cleanParam`. */
export const cleanParam = (text: string) =>
  text
    .replace(/\s*[\r\n\t]+\s*/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()

/** One blank for one person, as the server will fill it. Mirrors `valueFor`. */
export function valueFor(
  spec: VariableSpec,
  registration: Registration,
  member: Registration["members"][number]
) {
  const value = (() => {
    switch (spec.source) {
      case "name":
        return member.fullName
      case "firstName":
        return member.firstName || member.fullName.split(" ")[0]
      case "dmNumber":
        return member.code || registration.code
      case "registrationNumber":
        return registration.code
      case "mandal":
        return registration.mandal
      case "text":
        return spec.text
    }
  })()
  return cleanParam(value ?? "") || registration.code
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  en_US: "English (US)",
  en_GB: "English (UK)",
  gu: "Gujarati",
  hi: "Hindi",
}

export const CATEGORY_NAMES: Record<string, string> = {
  UTILITY: "Utility",
  MARKETING: "Marketing",
}
