import { Popover } from "@base-ui/react/popover"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarLine,
  RiTimeLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { useT } from "@/i18n/context"
import { formatTime } from "@/lib/time"

/**
 * A date and a time field that open a dropdown, in place of the browser's own
 * `type="date"` / `type="time"` boxes — those render "dd/mm/yyyy" and
 * "--:-- --" in the page font, differ on every browser, and are hard to use
 * with a screen reader. Both take and give the same strings the native inputs
 * did ("2027-01-25", "06:30"), so the form's rules are unchanged.
 */

const triggerClass = cn(
  "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-transparent px-3 text-left text-base transition-all outline-none select-none sm:h-8 sm:px-2.5 sm:text-xs/relaxed",
  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
  "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
  "data-popup-open:border-ring dark:bg-input/30"
)

const popupClass =
  "z-50 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none select-none origin-[var(--transform-origin)] transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"

// ---------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, "0")
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`
const partsOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return { y, m: m - 1, d }
}
const todayIso = () => {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth(), now.getDate())
}
const addDays = (iso: string, days: number) => {
  const { y, m, d } = partsOf(iso)
  const date = new Date(y, m, d + days)
  return isoOf(date.getFullYear(), date.getMonth(), date.getDate())
}
const addMonths = (iso: string, months: number) => {
  const { y, m, d } = partsOf(iso)
  const last = new Date(y, m + months + 1, 0).getDate()
  const date = new Date(y, m + months, Math.min(d, last))
  return isoOf(date.getFullYear(), date.getMonth(), date.getDate())
}
const clampIso = (iso: string, min?: string, max?: string) =>
  min && iso < min ? min : max && iso > max ? max : iso

/** The calendar's date formats and weekday names in one locale, made once each. */
const calendars = new Map<
  string,
  {
    long: Intl.DateTimeFormat
    short: Intl.DateTimeFormat
    month: Intl.DateTimeFormat
    weekdays: [string, string][]
  }
>()
function calendarFor(locale: string) {
  let calendar = calendars.get(locale)
  if (!calendar) {
    const narrow = new Intl.DateTimeFormat(locale, { weekday: "narrow" })
    const long = new Intl.DateTimeFormat(locale, { weekday: "long" })
    calendar = {
      long: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      short: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      month: new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }),
      // Sunday first: 1 Jan 2023 was a Sunday.
      weekdays: Array.from({ length: 7 }, (_, i) => {
        const day = new Date(2023, 0, 1 + i)
        return [narrow.format(day), long.format(day)]
      }),
    }
    calendars.set(locale, calendar)
  }
  return calendar
}
const asDate = (iso: string) => {
  const { y, m, d } = partsOf(iso)
  return new Date(y, m, d)
}

/**
 * A date field that opens a month calendar. Arrow keys move a day or a week,
 * Page Up and Page Down a month; Enter picks. Days outside `min`–`max` cannot
 * be picked, and `highlight` marks days worth seeing (the event days).
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  defaultMonth,
  highlight = [],
  highlightLabel,
  placeholder,
  invalid,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  /** A day in the month to open on while nothing is picked. */
  defaultMonth?: string
  highlight?: readonly string[]
  /** What the highlighted days are, shown under the calendar. */
  highlightLabel?: string
  placeholder?: string
  invalid?: boolean
  "aria-label"?: string
}) {
  const { t, locale } = useT()
  const calendar = calendarFor(locale)
  const [open, setOpen] = React.useState(false)
  // The day with keyboard focus; the month shown is the one it is in.
  const [active, setActive] = React.useState(() =>
    clampIso(value || defaultMonth || todayIso(), min, max)
  )
  const grid = React.useRef<HTMLDivElement>(null)
  const moved = React.useRef(false)

  const onOpenChange = (next: boolean) => {
    if (next) setActive(clampIso(value || defaultMonth || todayIso(), min, max))
    setOpen(next)
  }

  // After an arrow key, focus follows the active day, even into the next month.
  React.useEffect(() => {
    if (!moved.current) return
    moved.current = false
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-iso="${active}"]`)
      ?.focus()
  }, [active])

  const { y, m } = partsOf(active)
  const firstWeekday = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoOf(y, m, i + 1)),
  ]
  const today = todayIso()
  const monthStart = isoOf(y, m, 1)
  const monthEnd = isoOf(y, m, daysInMonth)
  const canPrev = !min || monthStart > min
  const canNext = !max || monthEnd < max

  const move = (to: string) => {
    moved.current = true
    setActive(clampIso(to, min, max))
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(active, -1),
      ArrowRight: () => addDays(active, 1),
      ArrowUp: () => addDays(active, -7),
      ArrowDown: () => addDays(active, 7),
      PageUp: () => addMonths(active, -1),
      PageDown: () => addMonths(active, 1),
    }
    const next = step[event.key]
    if (!next) return
    event.preventDefault()
    move(next())
  }
  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        id={id}
        aria-label={
          ariaLabel &&
          `${ariaLabel}: ${value ? calendar.long.format(asDate(value)) : t("not picked")}`
        }
        aria-invalid={invalid || undefined}
        className={triggerClass}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value
            ? calendar.short.format(asDate(value))
            : (placeholder ?? t("Pick a date"))}
        </span>
        <RiCalendarLine
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground sm:size-3.5"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            className={cn(popupClass, "w-72")}
            initialFocus={() =>
              grid.current?.querySelector<HTMLElement>('[tabindex="0"]') ?? true
            }
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={t("Previous month")}
                disabled={!canPrev}
                onClick={() =>
                  setActive(clampIso(addMonths(active, -1), min, max))
                }
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-30"
              >
                <RiArrowLeftSLine className="size-4" />
              </button>
              <Popover.Title
                aria-live="polite"
                className="font-heading text-sm font-medium"
              >
                {calendar.month.format(asDate(active))}
              </Popover.Title>
              <button
                type="button"
                aria-label={t("Next month")}
                disabled={!canNext}
                onClick={() =>
                  setActive(clampIso(addMonths(active, 1), min, max))
                }
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-30"
              >
                <RiArrowRightSLine className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-2xs text-muted-foreground">
              {calendar.weekdays.map(([short, long]) => (
                <abbr key={long} title={long} className="py-1 no-underline">
                  {short}
                </abbr>
              ))}
            </div>
            <div
              ref={grid}
              role="group"
              aria-label={calendar.month.format(asDate(active))}
              onKeyDown={onKeyDown}
              className="grid grid-cols-7 gap-0.5"
            >
              {cells.map((iso, index) =>
                !iso ? (
                  <span key={`blank-${index}`} />
                ) : (
                  <button
                    key={iso}
                    type="button"
                    data-iso={iso}
                    tabIndex={iso === active ? 0 : -1}
                    disabled={(!!min && iso < min) || (!!max && iso > max)}
                    aria-label={calendar.long.format(asDate(iso))}
                    aria-pressed={iso === value}
                    aria-current={iso === today ? "date" : undefined}
                    onClick={() => pick(iso)}
                    onFocus={() => setActive(iso)}
                    className={cn(
                      "relative flex h-9 items-center justify-center rounded-md text-xs tabular-nums transition-colors outline-none sm:h-8",
                      "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30",
                      highlight.includes(iso) && "bg-primary/10 text-primary",
                      iso === today &&
                        "font-semibold underline underline-offset-4",
                      iso === value &&
                        "bg-primary font-medium text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {partsOf(iso).d}
                  </button>
                )
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-2xs text-muted-foreground">
              {highlightLabel && highlight.length > 0 ? (
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-3 rounded-sm bg-primary/10"
                  />
                  {highlightLabel}
                </span>
              ) : (
                <span />
              )}
              {value && (
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="rounded-sm px-1 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {t("Clear")}
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ---------------------------------------------------------------- times

const ROW = 36
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))
const PERIODS = ["am", "pm"]

type Wheels = { hour: number; minute: number; period: number }

/** "06:30" → wheel positions; minutes to the nearest five. */
function wheelsOf(value: string): Wheels | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const hours = Number(match[1])
  const minute = Math.round(Number(match[2]) / 5) % 12
  return { hour: (hours % 12 || 12) - 1, minute, period: hours >= 12 ? 1 : 0 }
}

/** Wheel positions → "06:30". */
const timeOf = ({ hour, minute, period }: Wheels) =>
  `${pad(((hour + 1) % 12) + period * 12)}:${MINUTES[minute]}`

/**
 * One column of the time picker, scrolling like an iPhone's: rows snap to
 * the band in the middle, and with `loop` the list never ends (it is drawn
 * several times over and quietly recentred when the scroll settles).
 * A spinbutton to assistive tech; arrow keys step it.
 */
function Wheel({
  items,
  index,
  onChange,
  loop = false,
  label,
}: {
  items: readonly string[]
  index: number
  onChange: (index: number) => void
  loop?: boolean
  label: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const n = items.length
  const copies = loop ? 9 : 1
  const home = loop ? Math.floor(copies / 2) * n : 0
  // The row under the band, so a change made by scrolling is not scrolled to again.
  const shown = React.useRef(index)
  const settle = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = React.useRef({ index, onChange })
  React.useEffect(() => {
    latest.current = { index, onChange }
  })

  React.useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = (home + index) * ROW
    // Only on mount: later changes scroll smoothly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const el = ref.current
    if (!el || shown.current === index) return
    shown.current = index
    const row = Math.round(el.scrollTop / ROW)
    const base = row - (((row % n) + n) % n)
    // The nearest copy of the item, so stepping past 12 keeps going forwards.
    const target = loop
      ? [base - n, base, base + n]
          .map((b) => b + index)
          .reduce((a, b) => (Math.abs(b - row) < Math.abs(a - row) ? b : a))
      : index
    el.scrollTo({ top: target * ROW, behavior: "smooth" })
  }, [index, loop, n])

  const onScroll = () => {
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const row = Math.round(el.scrollTop / ROW)
      const i = loop ? ((row % n) + n) % n : Math.min(Math.max(row, 0), n - 1)
      // Near either end of the copies: jump back to the middle one, which
      // looks identical, so there is always more to scroll.
      if (loop && (row < n || row >= n * (copies - 1))) {
        el.scrollTop = (home + i) * ROW
      }
      shown.current = i
      if (i !== latest.current.index) latest.current.onChange(i)
    }, 90)
  }

  const step = (by: number) => {
    const next = loop
      ? (index + by + n) % n
      : Math.min(Math.max(index + by, 0), n - 1)
    if (next !== index) onChange(next)
  }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuetext={items[index]}
      onScroll={onScroll}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") step(-1)
        else if (event.key === "ArrowDown") step(1)
        else return
        event.preventDefault()
      }}
      className={cn(
        "relative z-10 h-[180px] flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md outline-none",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "[mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]",
        "focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
    >
      <div aria-hidden style={{ height: ROW * 2 }} />
      {Array.from({ length: copies }, (_, copy) =>
        items.map((item, i) => {
          const row = copy * n + i
          return (
            <div
              key={row}
              aria-hidden
              onClick={() =>
                ref.current?.scrollTo({ top: row * ROW, behavior: "smooth" })
              }
              className={cn(
                "flex h-9 cursor-pointer snap-center items-center justify-center text-base tabular-nums transition-colors select-none sm:text-sm",
                i === index
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item}
            </div>
          )
        })
      )}
      <div aria-hidden style={{ height: ROW * 2 }} />
    </div>
  )
}

/**
 * A time field that opens three scrolling wheels — hour, minute (in fives),
 * am/pm — like the iPhone's. The time changes as the wheels settle.
 */
export function TimePicker({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
  "aria-label"?: string
}) {
  const { t } = useT()
  const [open, setOpen] = React.useState(false)
  // Morning flights are the common case, so an empty field opens on 9:00 am.
  const [wheels, setWheels] = React.useState<Wheels>(
    () => wheelsOf(value) ?? { hour: 8, minute: 0, period: 0 }
  )

  const onOpenChange = (next: boolean) => {
    if (next) setWheels(wheelsOf(value) ?? { hour: 8, minute: 0, period: 0 })
    setOpen(next)
  }
  const turn = (part: keyof Wheels) => (index: number) => {
    const next = { ...wheels, [part]: index }
    setWheels(next)
    onChange(timeOf(next))
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        id={id}
        aria-label={
          ariaLabel &&
          `${ariaLabel}: ${value ? formatTime(value) : t("not picked")}`
        }
        aria-invalid={invalid || undefined}
        className={triggerClass}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? formatTime(value) : (placeholder ?? t("Pick a time"))}
        </span>
        <RiTimeLine
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground sm:size-3.5"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className={cn(popupClass, "w-64")}>
            <Popover.Title className="sr-only">
              {ariaLabel ?? t("Pick a time")}
            </Popover.Title>
            {/* Column names, above the wheels they belong to. */}
            <div
              aria-hidden
              className="mb-1 flex gap-1 text-center text-2xs font-medium tracking-wide text-muted-foreground uppercase select-none"
            >
              <span className="flex-1">{t("Hr")}</span>
              <span className="flex-1">{t("Min")}</span>
              <span className="flex-1" />
            </div>
            <div className="relative flex gap-1 select-none">
              {/* The band the picked row sits in. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 rounded-md bg-muted"
                style={{ top: ROW * 2, height: ROW }}
              />
              <Wheel
                items={HOURS}
                index={wheels.hour}
                onChange={turn("hour")}
                loop
                label={t("Hour")}
              />
              <Wheel
                items={MINUTES}
                index={wheels.minute}
                onChange={turn("minute")}
                loop
                label={t("Minutes")}
              />
              <Wheel
                items={PERIODS}
                index={wheels.period}
                onChange={turn("period")}
                label={t("Morning or afternoon")}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
              {value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("")
                    setOpen(false)
                  }}
                  className="rounded-sm px-1 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {t("Clear")}
                </button>
              ) : (
                <span />
              )}
              <Popover.Close
                onClick={() => onChange(timeOf(wheels))}
                className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {t("Done")}
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
