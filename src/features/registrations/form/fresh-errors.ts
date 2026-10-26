import {
  get,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form"

/**
 * Every field path currently holding an error, e.g. "members.1.arrivalDate".
 *
 * A leaf error is recognised by its `type` string; that is checked before
 * recursing so the walk never wanders into the DOM element on `ref`.
 */
export function errorPaths(errors: FieldErrors, prefix = ""): string[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (!value || typeof value !== "object") return []
    // An error on a whole list ("Add at least two people") sits on `root`.
    if (key === "root") return prefix ? [prefix] : []
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof (value as { type?: unknown }).type === "string") return [path]
    return errorPaths(value as FieldErrors, path)
  })
}

/** For a changed field, the fields whose rules read it and so need checking again. */
export type RelatedFields<T> = (changed: string, values: T) => string[]

const isFilled = (value: unknown) =>
  value !== undefined && value !== null && value !== "" && value !== false

/**
 * Keeps every shown error true to the current values. Returns the unsubscribe.
 *
 * Rules that span fields — a date and its time slot, departure after arrival,
 * a relation that implies a gender, two people with one name — put their error
 * on one field, and React Hook Form on its own only re-checks the field that
 * changed. So on any change this re-checks:
 *
 * - every field currently showing an error, so an error clears or updates the
 *   moment its cause does (picking the arrival *time* clears "Select arrival"
 *   on the arrival *day*); and
 * - the fields `related` names for the changed one, so a new conflict shows
 *   whichever side of it was edited last (relation "Son", then gender
 *   "Female"). Only those already filled in: a field the user has not reached
 *   yet is never turned red by someone else's edit.
 *
 * Subscribed to values only: a re-check updates errors, not values, so it
 * cannot set this off again.
 */
export function keepErrorsFresh<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, "subscribe" | "trigger">,
  related?: RelatedFields<T>
) {
  return form.subscribe({
    formState: { values: true },
    callback: ({ name, errors, values }) => {
      if (!name) return
      const paths = new Set(errors ? errorPaths(errors) : [])
      for (const path of related?.(name, values) ?? []) {
        if (isFilled(get(values, path))) paths.add(path)
      }
      if (paths.size > 0) void form.trigger([...paths] as Path<T>[])
    },
  })
}
