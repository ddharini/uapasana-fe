import { RiArrowDownSLine } from "@remixicon/react"
import { cn } from "cn"

import { useT } from "@/i18n/context"
import { COUNTRY_CODES, cleanNationalNumber, countryFor } from "@/lib/phone"

/**
 * A country code select joined to a number field, styled as one control.
 *
 * Takes the two fields' props separately so each can be registered with
 * react-hook-form on its own. The number field strips anything that is not a
 * digit as it is typed, which is where most invalid numbers come from.
 */
function PhoneInput({
  id,
  countryCode,
  codeProps,
  numberProps,
  invalid,
  placeholder,
}: {
  id: string
  countryCode: string
  codeProps: React.ComponentProps<"select">
  numberProps: React.ComponentProps<"input">
  invalid?: boolean
  placeholder?: string
}) {
  const { t } = useT()
  const country = countryFor(countryCode)
  const { max } = country

  return (
    <div
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-border bg-transparent transition-all sm:h-8 dark:bg-input/30",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"
      )}
    >
      {/*
        A closed native select can only show the chosen option's full text. So
        the compact flag and code are drawn underneath, and the real select is
        stretched over them, invisible: clicking it still opens the browser's
        own list, with every country spelled out.
      */}
      <div className="relative flex shrink-0 items-center gap-1 border-r border-border pr-1.5 pl-3 text-base tabular-nums hover:bg-muted/50 sm:pl-2.5 sm:text-xs/relaxed">
        <span aria-hidden>{country.flag}</span>
        <span aria-hidden>{country.code}</span>
        <RiArrowDownSLine className="size-4 text-muted-foreground sm:size-3.5" aria-hidden />
        <select
          id={`${id}-code`}
          aria-label={t("Country code")}
          title={t(country.country)}
          className="absolute inset-0 cursor-pointer appearance-none opacity-0 [&>option]:bg-popover [&>option]:text-popover-foreground"
          {...codeProps}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code} {t(c.country)}
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={max}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 py-1 text-base tabular-nums sm:px-2.5 sm:text-xs/relaxed outline-none placeholder:text-muted-foreground"
        {...numberProps}
        onPaste={(event) => {
          // maxLength would cut "+91 98765 43210" off at "+91 98765 " before
          // it could be cleaned, so a paste is cleaned first and set directly.
          event.preventDefault()
          // Set through the native setter: assigning `input.value` directly
          // updates React's own record of the value too, and React then
          // swallows the input event as "nothing changed".
          const input = event.currentTarget
          const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set
          setValue?.call(
            input,
            cleanNationalNumber(event.clipboardData.getData("text"), countryCode)
          )
          input.dispatchEvent(new Event("input", { bubbles: true }))
        }}
        onChange={(event) => {
          event.target.value = cleanNationalNumber(event.target.value, countryCode)
          numberProps.onChange?.(event)
        }}
      />
    </div>
  )
}

export { PhoneInput }
