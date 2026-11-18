/**
 * The code this browser is waiting on: which number it went to, and until when
 * it works.
 *
 * Kept outside the component because reading the code means leaving the page.
 * On a phone, opening WhatsApp often costs the browser its tab — Android
 * reloads it on return — and the form came back from its draft with every
 * field filled but the code box gone, showing "Send code" again. Devotees then
 * asked for another code (which, until codes stopped retiring each other,
 * made the one in their hand wrong), or found no place to type it and were
 * stopped by "Verify this number". Seen on 2026-11-18: numbers with two or
 * five codes sent and none ever entered.
 *
 * localStorage, guarded like the draft (src/features/registrations/form/draft.ts):
 * blocked storage just means the old behaviour.
 */

type Pending = {
  mobile: string
  /** When the code stops working, ms since epoch. */
  expiresAt: number
  /** When another may be asked for, ms since epoch. */
  resendAt: number
}

const KEY = "upasana.otp-pending"

export function rememberCodeSent(
  mobile: string,
  sent: { expiresInSeconds: number; resendAfterSeconds: number }
) {
  const now = Date.now()
  const pending: Pending = {
    mobile,
    expiresAt: now + sent.expiresInSeconds * 1000,
    resendAt: now + sent.resendAfterSeconds * 1000,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    // Blocked storage: the code box just does not survive a reload.
  }
}

/** The number a still-working code went to, and seconds until a resend. */
export function recallCodeSent():
  | { mobile: string; resendInSeconds: number }
  | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return undefined
    const pending = JSON.parse(raw) as Partial<Pending>
    const now = Date.now()
    if (
      typeof pending.mobile !== "string" ||
      typeof pending.expiresAt !== "number" ||
      pending.expiresAt <= now
    ) {
      forgetCodeSent()
      return undefined
    }
    const resendAt = typeof pending.resendAt === "number" ? pending.resendAt : 0
    return {
      mobile: pending.mobile,
      resendInSeconds: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    }
  } catch {
    return undefined
  }
}

export function forgetCodeSent() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}
