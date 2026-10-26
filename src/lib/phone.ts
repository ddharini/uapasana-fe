/**
 * Mobile numbers: the country codes offered, how long a number may be in each,
 * and how one is stored and shown.
 *
 * Numbers are stored in E.164 ("+919876543210") so the backend, SMS providers
 * and WhatsApp links can all use them as is. Each country has its own number
 * length and, where mobiles are told apart by it, first digit (`starts`).
 * Mirrors MOBILE_E164 on the server.
 */

import { en, type Translate } from "@/i18n/translate"

export const COUNTRY_CODES = [
  {
    code: "+91",
    country: "India",
    flag: "🇮🇳",
    min: 10,
    max: 10,
    starts: "6789",
  },
  {
    code: "+1",
    country: "USA / Canada",
    flag: "🇺🇸",
    min: 10,
    max: 10,
    starts: "",
  },
  {
    code: "+44",
    country: "United Kingdom",
    flag: "🇬🇧",
    min: 10,
    max: 10,
    starts: "",
  },
  {
    code: "+61",
    country: "Australia",
    flag: "🇦🇺",
    min: 9,
    max: 9,
    starts: "4",
  },
  // New Zealand mobiles are 02x numbers of 8 to 10 digits, without the 0.
  {
    code: "+64",
    country: "New Zealand",
    flag: "🇳🇿",
    min: 8,
    max: 10,
    starts: "2",
  },
  { code: "+971", country: "UAE", flag: "🇦🇪", min: 9, max: 9, starts: "5" },
] as const

export type CountryCode = (typeof COUNTRY_CODES)[number]["code"]

export const DEFAULT_COUNTRY_CODE: CountryCode = "+91"

export function countryFor(code: string) {
  return COUNTRY_CODES.find((c) => c.code === code) ?? COUNTRY_CODES[0]
}

/**
 * Cleans what was typed or pasted into the number field: digits only, and a
 * pasted country code ("+91 98765 43210") or trunk zero ("07700 900123")
 * dropped, so a correct number never fails for how it was written.
 */
export function cleanNationalNumber(raw: string, code: string) {
  let digits = asciiDigits(raw).replace(/\D/g, "")
  const { min, max } = countryFor(code)
  const codeDigits = code.slice(1)
  if (digits.length > max && digits.startsWith(codeDigits)) {
    digits = digits.slice(codeDigits.length)
  }
  // A mobile never starts with 0 in these countries: past the shortest
  // number, a leading 0 is the trunk prefix ("0412 345 678").
  if (digits.length > Math.min(min, max) && digits.startsWith("0")) {
    digits = digits.slice(1)
  }
  return digits
}

/**
 * Gujarati (૦–૯) and Hindi (०–९) digits as 0–9. A phone set to Gujarati can
 * type them, and stripping them as "not a digit" would make the field ignore
 * every key.
 */
export function asciiDigits(text: string) {
  return text.replace(/[\u0966-\u096F\u0AE6-\u0AEF]/g, (d) => {
    const point = d.charCodeAt(0)
    return String(point - (point >= 0x0ae6 ? 0x0ae6 : 0x0966))
  })
}

/** Why a national number is not valid for its country, or undefined when it is. */
export function mobileError(digits: string, code: string, t: Translate = en) {
  const { min, max, country, starts } = countryFor(code)
  if (!/^\d+$/.test(digits)) return t("Use digits only")
  if (digits.length < min) return t("Enter at least {min} digits", { min })
  if (digits.length > max)
    return t("{country} mobile numbers have {max} digits", {
      country: t(country),
      max,
    })
  if (code === "+91" && !starts.includes(digits[0])) {
    return t("Indian mobile numbers start with 6, 7, 8 or 9")
  }
  if (starts && !starts.includes(digits[0])) {
    return t("{country} mobile numbers start with {digit}", {
      country: t(country),
      digit: starts,
    })
  }
  return undefined
}

/** "+91" + "9876543210" → "+919876543210" */
export function toE164(code: string, digits: string) {
  return `${code}${digits}`
}

/**
 * "+919876543210" → { code: "+91", national: "9876543210" }: a stored number
 * back into the two form fields. Undefined for a country the form does not offer.
 */
export function fromE164(e164: string) {
  const country = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => e164.startsWith(c.code))
  return country
    ? { code: country.code, national: e164.slice(country.code.length) }
    : undefined
}

/** "+919876543210" → "+91 98765 43210". Anything unrecognised is shown as stored. */
export function formatMobile(e164: string) {
  const country = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => e164.startsWith(c.code))
  if (!country) return e164
  const national = e164.slice(country.code.length)
  const grouped =
    country.code === "+91"
      ? `${national.slice(0, 5)} ${national.slice(5)}`
      : country.code === "+1"
        ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
        : country.code === "+61"
          ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
          : country.code === "+64" || country.code === "+971"
            ? `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`
            : `${national.slice(0, 4)} ${national.slice(4)}`
  return `${country.code} ${grouped}`
}
