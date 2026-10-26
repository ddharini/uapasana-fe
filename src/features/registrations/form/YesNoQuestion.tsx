import { RiCheckLine } from "@remixicon/react"
import { cn } from "cn"
import { get, useFormContext } from "react-hook-form"

import { RequiredMark } from "@/components/ui/input"
import { useT } from "@/i18n/context"

import type { RegistrationFormValues } from "./schema"

/**
 * A Yes or No question, each answer a pill with a tick box, on a muted box:
 * the question, an optional line under it, then Yes and No.
 */
export function YesNoQuestion({
  name,
  question,
  description,
  required,
}: {
  name:
    | "needsPickup"
    | `members.${number}.needsPickup`
    | "arrivalMeal"
    | "departureMeal"
    | `members.${number}.arrivalMeal`
    | `members.${number}.departureMeal`
    | `members.${number}.youthConvention`
  question: string
  description?: string
  required?: boolean
}) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>()
  const { t } = useT()
  const error: string | undefined = get(errors, name)?.message
  const picked = watch(name)

  return (
    <div className="flex flex-col gap-1">
      <div
        role="radiogroup"
        aria-label={question}
        aria-invalid={!!error || undefined}
        // Always two rows — the question, then Yes and No under it — so the
        // arriving and leaving boxes look the same whatever the meal's name.
        className="flex flex-col items-start gap-1.5 rounded-md bg-muted/60 px-3 py-2"
      >
        <span className="flex flex-col">
          <span className="text-xs/relaxed">
            {question}
            {required && <RequiredMark />}
          </span>
          {description && (
            <span className="text-2xs/relaxed text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <div className="flex gap-1">
          {(["yes", "no"] as const).map((answer) => {
            const checked = picked === answer
            return (
              <label
                key={answer}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md border bg-background py-1 pr-3 pl-2 text-xs/relaxed transition-colors select-none sm:py-0.5",
                  "hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring/30",
                  checked
                    ? "border-primary bg-primary/10 text-primary hover:bg-primary/10"
                    : error
                      ? "border-destructive/60"
                      : "border-border"
                )}
              >
                <input
                  type="radio"
                  value={answer}
                  className="sr-only"
                  {...register(name)}
                />
                {/* A tick box inside the pill, filled once it is picked. */}
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors sm:size-3.5",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background"
                  )}
                >
                  {checked && <RiCheckLine className="size-3 sm:size-2.5" />}
                </span>
                {answer === "yes" ? t("Yes") : t("No")}
              </label>
            )
          })}
        </div>
      </div>
      {error && <p className="text-2xs/relaxed text-destructive">{error}</p>}
    </div>
  )
}
