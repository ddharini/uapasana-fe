import type { UseFormReturn } from "react-hook-form"

import { RELATION_GENDER, type Gender } from "../types"
import type { RegistrationFormValues } from "./schema"

/**
 * Picking a relation that fixes the gender — Son, Mother, … — sets the gender
 * to match, rather than leaving the user an error to fix by hand. Returns the
 * gender it switched to, or nothing when the gender already matched or the
 * relation (Spouse, Other, none) says nothing about it.
 *
 * Only this direction is automatic. Changing the gender afterwards does not
 * rewrite the relation — a female "Brother" could be a wrong gender or a wrong
 * relation — so that case still shows the schema's error.
 */
export function matchGenderToRelation(
  form: Pick<UseFormReturn<RegistrationFormValues>, "getValues" | "setValue">,
  index: number,
  relation: string
): Gender | undefined {
  const expected = RELATION_GENDER[relation as keyof typeof RELATION_GENDER]
  if (!expected || form.getValues(`members.${index}.gender`) === expected)
    return undefined
  // Not validated here: errors only appear after Continue, and a "Select a
  // gender" already showing clears through keepErrorsFresh.
  form.setValue(`members.${index}.gender`, expected, { shouldDirty: true })
  return expected
}
