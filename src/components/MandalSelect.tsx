import { Select } from "@base-ui/react/select"
import { RiArrowDownSLine, RiCheckLine, RiSearchLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { NativeSelect } from "@/components/ui/select"
import { MANDAL_GROUPS, type Mandal } from "@/config/event"

/** An option offered besides the mandals: "Every mandal" (value ""), "Not in a mandal". */
type Extra = { value: string; label: string }

// A phone or tablet: its own picker is the one everyone knows (see NativeSelect).
const TOUCH = "(pointer: coarse)"
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(TOUCH)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const useTouch = () =>
  React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TOUCH).matches,
    () => false
  )

/**
 * Picks a mandal, from the mandals under their groups (Gujarat, Gujarat
 * regions, Rest of India, International).
 *
 * On a phone, the phone's own picker. With a mouse, a dropdown of a set height
 * that scrolls, with a search box on top that narrows the list as you type:
 * the browser's own list of 44 mandals would fill the screen.
 *
 * `value` is "" while none is picked. `first` and `last` are offered before and
 * after the mandals; one with value "" stands for "none picked", like "Every
 * mandal" on a filter. `translate` shows the names in the reader's language —
 * the values stay English. `note` adds to a mandal's name, `isDisabled` greys
 * it out.
 */
export function MandalSelect({
  id,
  value,
  onChange,
  placeholder,
  first = [],
  last = [],
  translate = (text) => text,
  note,
  isDisabled,
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  first?: Extra[]
  last?: Extra[]
  translate?: (text: string) => string
  note?: (mandal: Mandal) => string
  isDisabled?: (mandal: Mandal) => boolean
  disabled?: boolean
  invalid?: boolean
  className?: string
  "aria-label"?: string
}) {
  const touch = useTouch()
  const [query, setQuery] = React.useState("")
  const search = query.trim().toLowerCase()
  // Matches the name as shown and the English value, so "surat" finds Surat
  // whatever language the list is in.
  const matches = (mandal: Mandal) =>
    !search ||
    mandal.toLowerCase().includes(search) ||
    translate(mandal).toLowerCase().includes(search)
  const groups = MANDAL_GROUPS.map((group) => ({
    label: group.label,
    mandals: group.mandals.filter(matches),
  })).filter((group) => group.mandals.length > 0)
  const labelOf = (mandal: Mandal) =>
    `${translate(mandal)}${note?.(mandal) ?? ""}`

  if (touch) {
    return (
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        className={className}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {first.map((extra) => (
          <option key={extra.value} value={extra.value}>
            {extra.label}
          </option>
        ))}
        {MANDAL_GROUPS.map((group) => (
          <optgroup key={group.label} label={translate(group.label)}>
            {group.mandals.map((mandal) => (
              <option
                key={mandal}
                value={mandal}
                disabled={isDisabled?.(mandal)}
              >
                {labelOf(mandal)}
              </option>
            ))}
          </optgroup>
        ))}
        {last.map((extra) => (
          <option key={extra.value} value={extra.value}>
            {extra.label}
          </option>
        ))}
      </NativeSelect>
    )
  }

  // What the trigger shows for each value; "" is none picked.
  const items = [
    ...[...first, ...last].map((extra) => ({
      value: extra.value || null,
      label: extra.label,
    })),
    ...MANDAL_GROUPS.flatMap((group) =>
      group.mandals.map((mandal) => ({ value: mandal, label: labelOf(mandal) }))
    ),
  ]

  return (
    <div className={cn("w-full min-w-0", className)}>
      <Select.Root
        id={id}
        items={items}
        value={value || null}
        onValueChange={(next) => onChange((next as string | null) ?? "")}
        onOpenChange={(open) => {
          if (!open) setQuery("")
        }}
        disabled={disabled}
      >
        <Select.Trigger
          aria-invalid={invalid || undefined}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-transparent px-3 text-left text-base transition-all outline-none select-none sm:h-8 sm:px-2.5 sm:text-xs/relaxed",
            "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
            "disabled:pointer-events-none disabled:opacity-50 data-popup-open:border-ring dark:bg-input/30"
          )}
        >
          <Select.Value
            placeholder={placeholder}
            className="truncate data-placeholder:text-muted-foreground"
          />
          <RiArrowDownSLine
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground sm:size-3.5"
          />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            sideOffset={6}
            align="start"
            alignItemWithTrigger={false}
            className="z-50"
          >
            <Select.Popup className="flex max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-48 origin-(--transform-origin) flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg transition-[scale,opacity] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <div className="flex items-center gap-2 border-b border-border px-2.5">
                <RiSearchLine
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  // The list's own keys (type-to-jump, Space to pick) would
                  // swallow the typing; only arrows and Enter reach the list.
                  onKeyDown={(event) => {
                    if (
                      ![
                        "ArrowDown",
                        "ArrowUp",
                        "Enter",
                        "Escape",
                        "Tab",
                      ].includes(event.key)
                    ) {
                      event.stopPropagation()
                    }
                  }}
                  placeholder={translate("Search mandal")}
                  aria-label={translate("Search mandal")}
                  autoComplete="off"
                  className="h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:h-8 sm:text-xs/relaxed"
                />
              </div>
              <Select.List className="min-h-0 overflow-y-auto overscroll-contain p-1">
                {groups.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    {translate("No mandal matches")}
                  </p>
                )}
                {!search &&
                  first.map((extra) => (
                    <Item key={extra.value} value={extra.value || null}>
                      {extra.label}
                    </Item>
                  ))}
                {groups.map((group) => (
                  <Select.Group key={group.label}>
                    <Select.GroupLabel className="px-2 pt-2 pb-1 text-3xs font-medium tracking-wider text-muted-foreground uppercase">
                      {translate(group.label)}
                    </Select.GroupLabel>
                    {group.mandals.map((mandal) => (
                      <Item
                        key={mandal}
                        value={mandal}
                        disabled={isDisabled?.(mandal)}
                      >
                        {labelOf(mandal)}
                      </Item>
                    ))}
                  </Select.Group>
                ))}
                {!search && last.length > 0 && (
                  <Select.Separator className="my-1 h-px bg-border" />
                )}
                {!search &&
                  last.map((extra) => (
                    <Item key={extra.value} value={extra.value || null}>
                      {extra.label}
                    </Item>
                  ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

function Item({
  value,
  disabled,
  children,
}: {
  value: string | null
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Select.Item
      value={value}
      disabled={disabled}
      className="relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm outline-none select-none data-highlighted:bg-muted sm:text-xs/relaxed data-disabled:opacity-40"
    >
      <Select.ItemIndicator className="absolute left-2 flex">
        <RiCheckLine className="size-3.5 text-primary" />
      </Select.ItemIndicator>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
}
