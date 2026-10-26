import { RiCheckLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

/**
 * Large radio options, for choices worth reading before picking — individual
 * or family; how someone is travelling. Each option can carry a line of
 * explanation, which a select would hide.
 */
function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
  invalid,
}: {
  name: string
  value: T | ""
  onChange: (value: T) => void
  options: {
    value: T
    label: string
    description?: string
    icon?: React.ReactNode
  }[]
  className?: string
  invalid?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-invalid={invalid || undefined}
      className={cn("grid grid-cols-1 gap-2", className)}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer items-start gap-3 rounded-md border border-border p-3.5 transition-colors select-none sm:gap-2.5 sm:p-3",
              "hover:bg-muted/60 has-focus-visible:border-ring has-focus-visible:ring-2 has-focus-visible:ring-ring/30",
              checked && "border-primary bg-primary/5 hover:bg-primary/5",
              invalid && !checked && "border-destructive/60"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon && (
              <span
                className={cn(
                  "mt-px text-muted-foreground [&_svg]:size-4",
                  checked && "text-primary"
                )}
              >
                {option.icon}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs/relaxed font-medium">
                {option.label}
              </span>
              {option.description && (
                <span className="text-2xs/relaxed text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border sm:size-3.5",
                checked && "border-primary bg-primary text-primary-foreground"
              )}
            >
              {checked && <RiCheckLine className="size-3 sm:size-2.5" />}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** A checkbox with its label beside it. Forwards everything to the input, so react-hook-form's `register` works on it. */
function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  label: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 py-1 select-none has-disabled:cursor-not-allowed has-disabled:opacity-60 sm:gap-2.5 sm:py-0",
        className
      )}
    >
      <input
        type="checkbox"
        className="peer mt-0.5 size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed sm:size-3.5"
        {...props}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs/relaxed font-medium">{label}</span>
        {description && (
          <span className="text-2xs/relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

export { Checkbox, ChoiceGroup }
