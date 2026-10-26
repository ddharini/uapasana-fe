import {
  RiAddLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiUploadCloud2Line,
  RiWhatsappLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
import { EVENT } from "@/config/event"
import {
  usePublishSchedule,
  useSchedule,
  type DraftState,
} from "@/features/schedule/api"
import { DayDialog, type DayTarget } from "@/features/schedule/DayDialog"
import {
  formatShortDate,
  isBuiltInKind,
  nextDate,
} from "@/features/schedule/format"
import { nowParts, useNow } from "@/features/schedule/now"
import {
  SessionDialog,
  type SessionTarget,
} from "@/features/schedule/SessionDialog"
import { DayHeading, DayPicker, Timeline } from "@/features/schedule/Timeline"

const PUBLISHED_AT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

/** The public page devotees are sent to. */
const publicUrl = () => `${window.location.origin}/schedule`

/**
 * Where the draft stands against what devotees see, the Publish button, and
 * the link to share. Edits only reach devotees when Publish is pressed.
 */
function PublishBar({ state }: { state: DraftState }) {
  const publish = usePublishSchedule()
  const [copied, setCopied] = React.useState(false)
  const { publication, unpublishedChanges } = state

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard refused (an http page, or permission denied): the link is
      // still one click away through "Open".
    }
  }

  const whatsappText = `${EVENT.name} — the full schedule, day by day:\n${publicUrl()}`

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
        unpublishedChanges
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-card"
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs/relaxed font-medium">
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              unpublishedChanges ? "bg-amber-500" : "bg-primary"
            )}
          />
          {!publication
            ? "Not published yet"
            : unpublishedChanges
              ? "Unpublished changes"
              : "Devotees see this version"}
        </span>
        <span className="text-2xs/relaxed text-muted-foreground">
          {!publication
            ? "Devotees see an empty page until you publish."
            : `${unpublishedChanges ? "Devotees still see the version published" : "Published"} ${PUBLISHED_AT.format(new Date(publication.publishedAt))} by ${publication.publishedByName}.`}
        </span>
        {publish.error && (
          <span className="text-2xs/relaxed text-destructive">
            {publish.error.message}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={copy}
          aria-label="Copy the public link"
        >
          {copied ? <RiCheckLine /> : <RiFileCopyLine />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <RiWhatsappLine />
          Share
        </a>
        <a
          href="/schedule"
          target="_blank"
          rel="noreferrer"
          aria-label="Open the public page"
          className={buttonVariants({ variant: "outline", size: "icon-lg" })}
        >
          <RiExternalLinkLine />
        </a>
        <Button
          size="lg"
          disabled={!unpublishedChanges || publish.isPending}
          onClick={() => publish.mutate()}
        >
          {publish.isPending ? (
            <RiLoader4Line className="animate-spin" />
          ) : (
            <RiUploadCloud2Line />
          )}
          Publish changes
        </Button>
      </div>
    </div>
  )
}

/** The admin editor for the programme. Devotees see the published copy at /schedule. */
export function Schedule() {
  const now = nowParts(useNow())
  const { data: state, isPending, isError, error, refetch } = useSchedule()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessionTarget, setSessionTarget] =
    React.useState<SessionTarget | null>(null)
  const [dayTarget, setDayTarget] = React.useState<DayTarget | null>(null)

  const header = (
    <PageHeader
      title="Events Schedule"
      description="Tap a session to edit it, or + to add one. Changes stay here until you publish them."
    />
  )

  if (isError) {
    return (
      <>
        {header}
        <LoadError error={error} onRetry={() => void refetch()} />
      </>
    )
  }

  if (isPending || !state) {
    return (
      <>
        {header}
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </>
    )
  }

  const { days } = state
  const select = (date: string) =>
    setSearchParams({ day: date }, { replace: true, preventScrollReset: true })

  // The chosen day lives in the URL so a refresh keeps it. Without one, open
  // on today during the event and on the first day otherwise.
  const requested = searchParams.get("day")
  const selectedDay =
    days.find((d) => d.date === requested) ??
    days.find((d) => d.date === now.date) ??
    days[0]

  const sessions = days.flatMap((d) => d.sessions)
  const places = [
    ...new Set(sessions.flatMap((s) => (s.place ? [s.place] : []))),
  ].sort()
  const customKinds = [
    ...new Set(sessions.map((s) => s.kind).filter((k) => !isBuiltInKind(k))),
  ].sort()

  const dialogs = (
    <>
      <SessionDialog
        target={sessionTarget}
        places={places}
        customKinds={customKinds}
        onClose={() => setSessionTarget(null)}
      />
      <DayDialog
        target={dayTarget}
        takenDates={days.map((d) => d.date)}
        onSaved={select}
        onClose={() => setDayTarget(null)}
      />
    </>
  )

  if (!selectedDay) {
    return (
      <>
        {header}
        <PublishBar state={state} />
        <EmptyState
          title="No days in the schedule yet"
          description="Add the first day of the event, then fill in its sessions."
          action={
            <Button
              size="lg"
              onClick={() => setDayTarget({ mode: "new", date: now.date })}
            >
              <RiAddLine />
              Add day
            </Button>
          }
        />
        {dialogs}
      </>
    )
  }

  const dayNumber = days.indexOf(selectedDay) + 1
  const dayLabel = `Day ${dayNumber} · ${formatShortDate(selectedDay.date)}`

  return (
    <>
      {header}

      <PublishBar state={state} />

      <DayPicker
        days={days}
        selected={selectedDay.date}
        today={now.date}
        onSelect={select}
        onEdit={(day) => setDayTarget({ mode: "edit", day })}
        onAdd={() =>
          setDayTarget({
            mode: "new",
            date: nextDate(days[days.length - 1].date),
          })
        }
      />

      <section aria-label={dayLabel} className="flex flex-col gap-4">
        <DayHeading day={selectedDay} number={dayNumber} />
        <Timeline
          day={selectedDay}
          now={now}
          editor={{
            dayId: selectedDay.id,
            dayLabel,
            onOpen: setSessionTarget,
          }}
        />
      </section>

      {dialogs}
    </>
  )
}
