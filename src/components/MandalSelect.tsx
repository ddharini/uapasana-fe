import { Combobox } from "@base-ui/react/combobox"
import * as React from "react"
import { RiArrowDownSLine, RiCheckLine } from "@remixicon/react"
import { cn } from "cn"

import { MANDAL_GROUPS, type Mandal } from "@/config/event"

/** An option offered besides the mandals: "Every mandal" (value ""), "Not in a mandal". */
type Extra = { value: string; label: string }

/** `english` is matched as well as `label`, so "surat" finds Surat in any language. */
type Option = {
  value: string
  label: string
  english: string
  disabled?: boolean
}
type Group = { value: string; label: string; items: Option[] }

/**
 * Picks a mandal, from the mandals under their groups (Gujarat, Gujarat
 * regions, Rest of India, International).
 *
 * The field itself is the search: tap or click it and the list opens, type
 * and the list narrows. The same on a phone as with a mouse — the phone's own
 * picker can't be searched, and scrolling 44 mandals on a small screen to find
 * yours is the slow part of the form.
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
  const extra = (option: Extra): Option => ({
    value: option.value,
    label: option.label,
    english: option.label,
  })
  // Groups without a label hold the extras; empty ones are dropped by the
  // combobox itself.
  const groups: Group[] = [
    { value: "first", label: "", items: first.map(extra) },
    ...MANDAL_GROUPS.map((group) => ({
      value: group.label,
      label: translate(group.label),
      items: group.mandals.map((mandal) => ({
        value: mandal,
        label: `${translate(mandal)}${note?.(mandal) ?? ""}`,
        english: mandal,
        disabled: isDisabled?.(mandal),
      })),
    })),
    { value: "last", label: "", items: last.map(extra) },
  ]
  const selected =
    groups
      .flatMap((group) => group.items)
      .find((option) => option.value === value) ?? null

  const fieldRef = React.useRef<HTMLDivElement>(null)
  const { room, lift, settle } = useLiftAboveKeyboard(fieldRef)

  return (
    <div className={cn("w-full min-w-0", className)}>
      <Combobox.Root<Option>
        items={groups}
        value={selected}
        onValueChange={(next) => onChange(next?.value ?? "")}
        isItemEqualToValue={(a, b) => a.value === b.value}
        filter={(option, query) => {
          const search = query.trim().toLowerCase()
          return (
            option.label.toLowerCase().includes(search) ||
            option.english.toLowerCase().includes(search)
          )
        }}
        // Enter picks the first match, so "sur" + Enter is Surat.
        autoHighlight
        disabled={disabled}
        onOpenChange={(open) => {
          if (!open) settle()
        }}
      >
        <Combobox.InputGroup
          ref={fieldRef}
          className={cn(
            "relative flex h-10 w-full min-w-0 items-center rounded-md border border-border bg-transparent transition-all sm:h-8",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 hover:bg-muted/50",
            "data-popup-open:border-ring dark:bg-input/30 data-disabled:pointer-events-none data-disabled:opacity-50",
            invalid &&
              "border-destructive ring-2 ring-destructive/20 focus-within:border-destructive"
          )}
        >
          <Combobox.Input
            id={id}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            // Selecting what's there lets the first keystroke replace a
            // picked mandal rather than type after it.
            onFocus={(event) => {
              event.currentTarget.select()
              lift()
            }}
            onBlur={settle}
            autoComplete="off"
            // text-base below sm: under 16px, iOS zooms the page on focus.
            className="h-full w-full min-w-0 truncate bg-transparent pr-8 pl-3 text-base outline-none placeholder:text-muted-foreground sm:pr-7 sm:pl-2.5 sm:text-xs/relaxed"
          />
          <Combobox.Trigger
            aria-label={translate("Select mandal")}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 pl-1 text-muted-foreground outline-none sm:pr-2"
          >
            <RiArrowDownSLine aria-hidden className="size-4 sm:size-3.5" />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} align="start" className="z-50">
            <Combobox.Popup className="flex max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-48 origin-(--transform-origin) flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg transition-[scale,opacity] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <Combobox.Empty className="px-2 py-3 text-center text-xs text-muted-foreground empty:hidden">
                {translate("No mandal matches")}
              </Combobox.Empty>
              <Combobox.List className="min-h-0 overflow-y-auto overscroll-contain p-1 empty:hidden">
                {(group: Group) => (
                  <Combobox.Group key={group.value} items={group.items}>
                    {group.label && (
                      <Combobox.GroupLabel className="px-2 pt-2 pb-1 text-3xs font-medium tracking-wider text-muted-foreground uppercase">
                        {group.label}
                      </Combobox.GroupLabel>
                    )}
                    <Combobox.Collection>
                      {(option: Option) => (
                        <Item key={option.value} option={option} />
                      )}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {room > 0 && <div aria-hidden style={{ height: room }} />}
    </div>
  )
}

/**
 * On a phone, focusing the field opens the keyboard over the bottom half of
 * the screen. A field low on the page ends up under it — the devotee types a
 * mandal they cannot see, into a list that opens behind the keyboard too.
 *
 * So once the keyboard has opened, the field is scrolled up to just under the
 * app header, leaving the visible space below it for the list. A field near
 * the end of the page has no page left to scroll into, so `room` is the height
 * of a spacer rendered after it for as long as the field is in use.
 *
 * The keyboard's arrival is the visual viewport shrinking; we wait for those
 * resizes to stop, since scrolling mid-animation fights the browser's own
 * scroll to the focused input. No resize (the keyboard was already up, moving
 * from the previous field) falls through to the timeout.
 */
function useLiftAboveKeyboard(fieldRef: React.RefObject<HTMLElement | null>) {
  const [room, setRoom] = React.useState(0)
  const cancelRef = React.useRef<() => void>(() => {})

  const lift = React.useCallback(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return
    cancelRef.current()
    const viewport = window.visualViewport
    let timer = 0

    const scroll = () => {
      cancelRef.current()
      const field = fieldRef.current
      if (!field || !field.contains(document.activeElement)) return
      // Sit below the sticky app header where there is one (--app-header-h is
      // set by AppShell; the public form has no header).
      const header =
        parseFloat(
          getComputedStyle(field).getPropertyValue("--app-header-h")
        ) || 0
      const by =
        field.getBoundingClientRect().top -
        (viewport?.offsetTop ?? 0) -
        header -
        12
      if (by <= 0) return
      const left =
        document.documentElement.scrollHeight -
        window.innerHeight -
        window.scrollY
      if (by > left) setRoom(Math.ceil(by - left))
      // After the spacer has rendered, so the page is long enough to scroll.
      requestAnimationFrame(() =>
        window.scrollBy({ top: by, behavior: "smooth" })
      )
    }
    const wait = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(scroll, 150)
    }

    viewport?.addEventListener("resize", wait)
    timer = window.setTimeout(scroll, 600)
    cancelRef.current = () => {
      window.clearTimeout(timer)
      viewport?.removeEventListener("resize", wait)
    }
  }, [fieldRef])

  const settle = React.useCallback(() => {
    cancelRef.current()
    setRoom(0)
  }, [])

  React.useEffect(() => () => cancelRef.current(), [])

  return { room, lift, settle }
}

function Item({ option }: { option: Option }) {
  return (
    <Combobox.Item
      value={option}
      disabled={option.disabled}
      className="relative flex cursor-default items-center gap-2 rounded-md py-2 pr-2 pl-7 text-sm outline-none select-none data-highlighted:bg-muted sm:py-1.5 sm:text-xs/relaxed data-disabled:opacity-40"
    >
      <Combobox.ItemIndicator className="absolute left-2 flex">
        <RiCheckLine className="size-3.5 text-primary" />
      </Combobox.ItemIndicator>
      {option.label}
    </Combobox.Item>
  )
}
