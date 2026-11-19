import type { NumberUse } from "./types"

/**
 * One mobile number, one registration: a number already on another active
 * registration — as its contact or typed against a family member — cannot be
 * used on this one, whoever it is typed against here. A family may still give
 * several of its own people one phone.
 *
 * Mirrors `upasana-be/src/lib/number-in-use.ts`, which refuses the
 * registration whatever this says.
 */
export function usedElsewhere(
  mobile: string | undefined,
  uses: NumberUse[] | undefined
): NumberUse | undefined {
  return mobile ? uses?.find((use) => use.mobile === mobile) : undefined
}
