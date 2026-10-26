import { GU } from "./gu"

/**
 * The languages the public registration pages speak. English is the source:
 * every string in the code is written in English, and doubles as the key for
 * its translation in gu.ts. A string with no translation shows in English, so
 * a missed one is untranslated rather than broken.
 *
 * Only what the form *says* is translated. What people type, and every value
 * saved (mandal, gender, travel mode, …), stays in English, so the team's
 * lists, filters and reports read the same whoever filled the form in.
 */
export const LANGUAGES = {
  en: { label: "English", locale: "en-IN" },
  gu: { label: "ગુજરાતી", locale: "gu-IN" },
} as const
export type Lang = keyof typeof LANGUAGES

export type Vars = Record<string, string | number>
/** `t("Remove {name}?", { name })`: the text in the current language, with `{…}` filled in. */
export type Translate = (text: string, vars?: Vars) => string

const fill = (text: string, vars?: Vars) =>
  vars
    ? text.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in vars ? String(vars[key]) : match
      )
    : text

/** English: the text as written, with `{…}` filled in. */
export const en: Translate = fill

// Each missing translation is reported once, in development only.
const reported = new Set<string>()

const gu: Translate = (text, vars) => {
  if (!text) return text
  const translated = GU[text]
  if (translated === undefined && import.meta.env.DEV && !reported.has(text)) {
    reported.add(text)
    console.warn(`[i18n] No Gujarati for "${text}"`)
  }
  return fill(translated ?? text, vars)
}

export const translator = (lang: Lang): Translate => (lang === "gu" ? gu : en)

/** The Intl locale for dates in this language: "en-IN" or "gu-IN". */
export const localeOf = (lang: Lang) => LANGUAGES[lang].locale

/**
 * A message from the server, translated where it is one of the server's own
 * fixed sentences (wrong OTP, too many codes, …). Anything else comes back in
 * English as it was sent.
 */
export function serverMessage(t: Translate, message: string) {
  if (t === en) return message
  for (const [pattern, template] of SERVER_PATTERNS) {
    const match = pattern.exec(message)
    if (match) return t(template, { ...match.groups })
  }
  return t(message)
}

/** The server's sentences with a number or code in them, and their key in gu.ts. */
const SERVER_PATTERNS: [RegExp, string][] = [
  [
    /^Wait (?<n>\d+) seconds before asking for another code\.$/,
    "Wait {n} seconds before asking for another code.",
  ],
  [
    /^That code is not right\. (?<n>\d+) tr(?:y|ies) left\.$/,
    "That code is not right. {n} tries left.",
  ],
  [
    /^This number is already registered \((?<code>[^)]+)\)\. Each contact number has one registration — change that one instead\.$/,
    "This number is already registered ({code}). Each contact number has one registration — change that one instead.",
  ],
]
