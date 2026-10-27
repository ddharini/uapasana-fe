import {
  DEFAULT_VALUES,
  emptyMember,
  splitFullName,
  type MemberFormValues,
  type RegistrationFormValues,
} from "./schema"

/**
 * A half-filled registration, kept in this browser so a refresh, a closed tab
 * or a dropped connection does not lose it.
 *
 * One draft per form, by `key`: the public page and the staff desk keep theirs
 * apart (a devotee's draft on a shared desk computer never fills in a staff
 * entry), and each registration being edited has its own.
 * Thrown away on a successful submit, on "Clear form", and once it is a week
 * old.
 *
 * localStorage can be missing, full or blocked (private windows, storage
 * turned off), so every access is guarded: the form then simply works without
 * drafts.
 */

export type Draft = {
  values: RegistrationFormValues
  /** The step on screen. */
  step: number
  /** The furthest step reached, so a link to a later step cannot skip ahead. */
  reached: number
}

type Stored = Draft & { version: number; savedAt: number }

/** Bump when a change to the form's values would make old drafts restore wrongly. */
const VERSION = 1
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const LAST_STEP = 3

const storageKey = (key: string) => `upasana.registration-draft.${key}`

export function loadDraft(key: string): Draft | undefined {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return undefined
    const stored = JSON.parse(raw) as Partial<Stored>
    if (
      stored.version !== VERSION ||
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > MAX_AGE_MS ||
      !stored.values ||
      typeof stored.values !== "object"
    ) {
      clearDraft(key)
      return undefined
    }
    const step = clampStep(stored.step)
    return {
      values: withDefaults(stored.values),
      step,
      reached: Math.max(step, clampStep(stored.reached)),
    }
  } catch {
    // Unreadable or blocked storage, or JSON that is not ours: start fresh.
    return undefined
  }
}

export function saveDraft(key: string, draft: Draft) {
  try {
    const stored: Stored = { ...draft, version: VERSION, savedAt: Date.now() }
    localStorage.setItem(storageKey(key), JSON.stringify(stored))
  } catch {
    // Full or blocked storage: the form keeps working, just without a draft.
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(storageKey(key))
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/**
 * Whether anything differs from where the form started — an untouched form is
 * not worth a draft or a "Clear form" button. `baseline` is the empty form for
 * a new registration, and the saved registration when editing one.
 */
export function hasContent(
  values: RegistrationFormValues,
  baseline: RegistrationFormValues = DEFAULT_VALUES
) {
  return JSON.stringify(values) !== JSON.stringify(baseline)
}

/**
 * Fills in anything the stored values lack — a field added to the form since
 * the draft was saved — so every input still has a value to show.
 */
function withDefaults(
  values: Partial<RegistrationFormValues>
): RegistrationFormValues {
  const members =
    Array.isArray(values.members) && values.members.length > 0
      ? values.members.map(withNameParts)
      : DEFAULT_VALUES.members
  // The pickup was a tick box (true/false) before it became Yes or No.
  const pickup: unknown = values.needsPickup
  const needsPickup =
    typeof pickup === "boolean" ? (pickup ? "yes" : "no") : values.needsPickup
  return {
    ...DEFAULT_VALUES,
    ...values,
    members,
    stashedMembers: Array.isArray(values.stashedMembers)
      ? values.stashedMembers.map(withNameParts)
      : DEFAULT_VALUES.stashedMembers,
    needsPickup: needsPickup ?? DEFAULT_VALUES.needsPickup,
  }
}

/**
 * A stored person with the form's current fields. The name was one "full
 * name" box before it was asked in three parts: a draft from then is split.
 * The Youth Convention was left unanswered ("") before it defaulted to No: a
 * draft from then opens on No, as a new person does, rather than on neither.
 */
function withNameParts(member: Partial<MemberFormValues>): MemberFormValues {
  const { fullName, ...rest } = member as Partial<MemberFormValues> & {
    fullName?: unknown
  }
  const parts =
    typeof fullName === "string" && rest.firstName === undefined
      ? splitFullName(fullName)
      : {}
  return {
    ...emptyMember(),
    ...parts,
    ...rest,
    youthConvention: rest.youthConvention === "yes" ? "yes" : "no",
  }
}

function clampStep(step: unknown) {
  return typeof step === "number" && Number.isInteger(step)
    ? Math.min(Math.max(step, 0), LAST_STEP)
    : 0
}
