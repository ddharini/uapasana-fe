import { cn } from "cn"

import { useT } from "@/i18n/context"
import { asciiDigits } from "@/lib/phone"

/**
 * Primitives written by hand rather than pulled from the shadcn registry.
 *
 * The `shadcn add` CLI at the version this project pins crashes on this Node
 * (a ts-morph ESM import), so these follow button.tsx's conventions directly:
 * the same compact heights, the same `focus-visible` ring, the same
 * `aria-invalid` treatment, and a `data-slot` for styling from a parent.
 *
 * Fields are 16px on phones. Anything smaller and iOS Safari zooms the whole
 * page in when the field is tapped, and leaves it zoomed.
 */

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-border bg-transparent px-3 py-1 text-base transition-all outline-none sm:h-8 sm:px-2.5 sm:text-xs/relaxed",
        "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        "dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

/**
 * A whole-number field: anything that is not a digit is dropped as it is typed
 * or pasted, so letters never reach the form. Range checks stay with the
 * form's schema, which can say what is wrong.
 */
function DigitsInput({ onChange, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      {...props}
      onChange={(event) => {
        const digits = asciiDigits(event.target.value).replace(/\D/g, "")
        event.target.value = props.maxLength
          ? digits.slice(0, props.maxLength)
          : digits
        onChange?.(event)
      }}
    />
  )
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-base transition-all outline-none sm:min-h-20 sm:px-2.5 sm:py-1.5 sm:text-xs/relaxed",
        "field-sizing-content placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        "dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-xs/relaxed font-medium select-none",
        className
      )}
      {...props}
    />
  )
}

/**
 * The red star on a required field's label. Screen readers hear "required"
 * instead of "star".
 */
function RequiredMark() {
  const { t } = useT()
  return (
    <>
      <span aria-hidden className="ml-0.5 text-destructive">
        *
      </span>
      <span className="sr-only"> ({t("required")})</span>
    </>
  )
}

/**
 * A labelled form row with room for help text and an error.
 * `required` marks the label with a red star.
 *
 * The hint sits *above* the control rather than below it. Wizard fields here
 * ask for things people get wrong in specific ways ("titles, not departments"),
 * and a hint read after the field has been filled in has already failed.
 */
function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>
        <span>
          {label}
          {required && <RequiredMark />}
        </span>
      </Label>
      {hint && <p className="text-2xs/relaxed text-muted-foreground">{hint}</p>}
      {children}
      {error && <p className="text-2xs/relaxed text-destructive">{error}</p>}
    </div>
  )
}

export { DigitsInput, Field, Input, Label, RequiredMark, Textarea }
