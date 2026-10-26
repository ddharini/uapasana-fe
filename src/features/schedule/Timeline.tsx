import {
  RiAddLine,
  RiExternalLinkLine,
  RiMapPin2Line,
  RiPencilLine,
  RiTimeLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Badge, EmptyState } from "@/components/ui/primitives"
import { toLocalDate } from "@/config/event"

import type { PublishedDay, Session } from "./api"
import { addMinutes, formatTime, kindStyle } from "./format"
import type { SessionTarget } from "./SessionDialog"

/**
 * The schedule as a timeline: shared by the admin editor and the public page
 * devotees open, so both always look the same.
 */

const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short" })
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" })
const LONG_DATE = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

/**
 * The row of days along the top. With `onEdit`/`onAdd` (the admin editor)
 * each day gets a pencil and an "Add day" card follows; without, it only
 * switches days.
 */
export function DayPicker<D extends PublishedDay>({
  days,
  selected,
  today,
  onSelect,
  onEdit,
  onAdd,
}: {
  days: D[]
  selected: string
  today: string
  onSelect: (date: string) => void
  onEdit?: (day: D) => void
  onAdd?: () => void
}) {
  const canEdit = !!onEdit
  return (
    // Phones scroll sideways when the days don't fit; wider screens share the row out.
    <div
      role="group"
      aria-label="Event days"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1 sm:mx-0 sm:px-0"
    >
      {days.map((day, i) => {
        const d = toLocalDate(day.date)
        const active = day.date === selected
        return (
          <div key={day.date} className="group/day relative shrink-0 sm:flex-1">
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(day.date)}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 rounded-lg border px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                canEdit ? "min-w-[6rem]" : "min-w-[4.75rem]",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : // On the wrapper, so the day stays lit while the pencil is hovered.
                    "border-border bg-card group-hover/day:bg-muted"
              )}
            >
              <span
                className={cn(
                  "text-3xs tracking-wide uppercase",
                  active
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                Day {i + 1}
              </span>
              <span className="font-heading text-xl leading-tight font-semibold tabular-nums">
                {d.getDate()}
              </span>
              <span
                className={cn(
                  "text-2xs",
                  active
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                {day.date === today
                  ? "Today"
                  : `${WEEKDAY.format(d)}, ${MONTH.format(d)}`}
              </span>
            </button>
            {/* A sibling of the day button, not inside it: buttons cannot nest.
                Appears on hover with a mouse; always shown on touch screens,
                which have no hover. Opens the day directly, selected or not. */}
            {onEdit && (
              <button
                type="button"
                aria-label={`Edit day ${i + 1}`}
                onClick={() => onEdit(day)}
                className={cn(
                  "absolute top-1 right-1 flex size-7 items-center justify-center rounded-md opacity-0 transition outline-none group-hover/day:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 sm:size-6 pointer-coarse:opacity-100",
                  active
                    ? "text-primary-foreground/85 hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-primary-foreground/60"
                    : "text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring"
                )}
              >
                <RiPencilLine className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}

      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-3 py-2.5 text-2xs text-muted-foreground transition-colors outline-none hover:border-ring hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex-initial"
        >
          <RiAddLine className="size-5" />
          Add day
        </button>
      )}
    </div>
  )
}

/** Vertical distance from the top of a row to the centre of a session's dot. */
const DOT_Y = "1.1875rem"

/**
 * The rail through one row. Rows draw their own piece so it can start at the
 * first marker and stop at the last one instead of trailing past them.
 * `anchor` is where this row's marker sits: a session's dot, or the middle of
 * an "add" row.
 */
function Rail({
  first,
  last,
  anchor,
}: {
  first: boolean
  last: boolean
  anchor: "dot" | "middle"
}) {
  if (first && last) return null
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-0 w-px -translate-x-1/2 bg-border",
        !first && !last && "inset-y-0",
        first &&
          (anchor === "dot" ? "top-[1.1875rem] bottom-0" : "top-1/2 bottom-0"),
        last && (anchor === "dot" ? "top-0 h-[1.1875rem]" : "top-0 bottom-1/2")
      )}
    />
  )
}

/** Two-column row: time on the left, rail and content on the right. */
function Row({
  time,
  children,
}: {
  time?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-4">
      <div className="text-right">{time}</div>
      <div className="relative pl-5 sm:pl-6">{children}</div>
    </li>
  )
}

function SessionRow({
  session,
  live,
  first,
  last,
  spaced,
  onEdit,
}: {
  session: Session
  live: boolean
  first: boolean
  last: boolean
  /** Leave a gap below — when there is no "add" row to make one. */
  spaced: boolean
  onEdit?: () => void
}) {
  const kind = kindStyle(session.kind)

  const content = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="font-heading text-sm font-medium">
          {session.title}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {live && <Badge variant="success">Now</Badge>}
          <Badge variant={kind.badge}>{kind.label}</Badge>
        </span>
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <RiTimeLine className="size-3.5" />
          {formatTime(session.start)} – {formatTime(session.end)}
        </span>
        {session.mapUrl ? (
          // Above the card's edit button, so it opens the map rather than the popup.
          <a
            href={session.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
          >
            <RiMapPin2Line className="size-3.5" />
            {session.place ?? "View on map"}
            <RiExternalLinkLine className="size-3" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1">
            <RiMapPin2Line className="size-3.5" />
            {session.place}
          </span>
        )}
      </span>
      {session.note && (
        <span className="text-2xs/relaxed text-muted-foreground">
          {session.note}
        </span>
      )}
    </>
  )

  return (
    <Row
      time={
        <time
          dateTime={session.start}
          className={cn(
            "block pt-2.5 text-xs/relaxed font-medium whitespace-nowrap tabular-nums",
            live ? "text-primary" : "text-foreground"
          )}
        >
          {formatTime(session.start)}
        </time>
      }
    >
      <Rail first={first} last={last} anchor="dot" />
      <span
        aria-hidden
        className={cn(
          "absolute left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-background",
          kind.dot,
          live && "animate-pulse"
        )}
        style={{ top: DOT_Y }}
      />
      <div className={cn(spaced && !last && "pb-4")}>
        <div
          className={cn(
            "relative flex w-full flex-col gap-1.5 rounded-lg border bg-card p-3 sm:p-3.5",
            live ? "border-primary shadow-sm" : "border-border",
            onEdit &&
              "transition-colors hover:border-ring hover:bg-muted/30 has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-ring/40"
          )}
        >
          {/* The whole card opens the editor. A button laid over it rather
              than wrapping it, because the map link inside cannot sit in a button. */}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${session.title}, ${formatTime(session.start)}`}
              className="absolute inset-0 cursor-pointer rounded-lg outline-none"
            />
          )}
          {content}
        </div>
      </div>
    </Row>
  )
}

/** The "+" on the rail: before the first session, between two, or after the last. */
function AddRow({
  label,
  first,
  last,
  onAdd,
}: {
  label: string
  first: boolean
  last: boolean
  onAdd: () => void
}) {
  return (
    <Row>
      <Rail first={first} last={last} anchor="middle" />
      <div className="h-10 sm:h-9">
        <button
          type="button"
          onClick={onAdd}
          aria-label={label}
          className="group/add absolute inset-y-0 left-0 flex -translate-x-3 items-center gap-2 pr-3 outline-none"
        >
          <span className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover/add:border-primary group-hover/add:bg-primary group-hover/add:text-primary-foreground group-focus-visible/add:border-primary group-focus-visible/add:ring-2 group-focus-visible/add:ring-ring/40">
            <RiAddLine className="size-3.5" />
          </span>
          <span className="text-2xs text-muted-foreground opacity-0 transition-opacity group-hover/add:opacity-100 group-focus-visible/add:opacity-100">
            {label}
          </span>
        </button>
      </div>
    </Row>
  )
}

/** Times to prefill a new session with, so it lands where its "+" was. */
function slotFor(prev: Session | undefined, next: Session | undefined) {
  if (prev && next) {
    const start = prev.end
    return {
      start,
      end: next.start > start ? next.start : addMinutes(start, 30),
    }
  }
  if (next) return { start: addMinutes(next.start, -60), end: next.start }
  if (prev) return { start: prev.end, end: addMinutes(prev.end, 60) }
  return { start: "10:00", end: "11:00" }
}

function positionLabel(prev: Session | undefined, next: Session | undefined) {
  if (prev && next) return `Between ${prev.title} and ${next.title}`
  if (next) return `Before ${next.title}`
  if (prev) return `After ${prev.title}`
  return "The first session of the day"
}

/**
 * One day's sessions down a rail. With `editor` every card opens the session
 * popup and a "+" sits before, between and after them; without, read-only.
 */
export function Timeline({
  day,
  now,
  editor,
}: {
  day: PublishedDay
  now: { date: string; time: string }
  editor?: {
    dayId: string
    dayLabel: string
    onOpen: (target: SessionTarget) => void
  }
}) {
  const { sessions } = day
  const isToday = day.date === now.date
  const canEdit = !!editor

  if (!editor && sessions.length === 0) {
    return (
      <EmptyState
        title="Nothing planned yet"
        description="Sessions for this day will be listed here soon."
      />
    )
  }

  const addRow = (
    index: number,
    { dayId, dayLabel, onOpen }: NonNullable<typeof editor>
  ) => {
    const prev = sessions[index - 1]
    const next = sessions[index]
    const position = positionLabel(prev, next)
    return (
      <AddRow
        key={`add-${index}`}
        label={
          sessions.length === 0
            ? "Add the first session"
            : `Add ${position[0].toLowerCase()}${position.slice(1)}`
        }
        first={index === 0}
        last={index === sessions.length}
        onAdd={() =>
          onOpen({
            mode: "new",
            dayId,
            dayLabel,
            position,
            ...slotFor(prev, next),
          })
        }
      />
    )
  }

  return (
    <ol className="flex flex-col">
      {editor && addRow(0, editor)}
      {sessions.map((session, i) => (
        <React.Fragment key={session.id}>
          <SessionRow
            session={session}
            live={
              isToday && session.start <= now.time && now.time < session.end
            }
            first={!canEdit && i === 0}
            last={!canEdit && i === sessions.length - 1}
            spaced={!canEdit}
            onEdit={
              editor
                ? () =>
                    editor.onOpen({
                      mode: "edit",
                      dayId: editor.dayId,
                      dayLabel: editor.dayLabel,
                      session,
                    })
                : undefined
            }
          />
          {editor && addRow(i + 1, editor)}
        </React.Fragment>
      ))}
    </ol>
  )
}

/** "Day 2 · Saturday, 2 January 2027", with the theme and session count. */
export function DayHeading({
  day,
  number,
}: {
  day: PublishedDay
  number: number
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="font-heading text-base font-medium">
        Day {number} · {LONG_DATE.format(toLocalDate(day.date))}
      </h2>
      <span className="text-2xs text-muted-foreground">
        {day.theme && <>{day.theme} · </>}
        {day.sessions.length}{" "}
        {day.sessions.length === 1 ? "session" : "sessions"}
      </span>
    </div>
  )
}
