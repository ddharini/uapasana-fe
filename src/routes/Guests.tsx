import {
  RiDeleteBinLine,
  RiDownload2Line,
  RiLoader4Line,
  RiPencilLine,
  RiSearchLine,
  RiUserAddLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { MandalSelect } from "@/components/MandalSelect"
import { ShareLink } from "@/components/ShareLink"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import { EVENT, NO_MANDAL, formatDay, formatStayDate } from "@/config/event"
import {
  dayTotals,
  formatMeals,
  useDeleteGuestVisit,
  useGuestVisits,
  type GuestVisit,
} from "@/features/guests/api"
import { formatCreatedAt } from "@/features/registrations/format"
import { canReview, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"

const number = new Intl.NumberFormat("en-IN")

/** People, lunches and dinners per day. A day can be tapped to list only its guests. */
function DayTotals({
  visits,
  selected,
  onSelect,
}: {
  visits: GuestVisit[]
  selected: string
  onSelect: (date: string) => void
}) {
  const totals = dayTotals(visits, EVENT.days)
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {totals.map((day) => {
        const active = selected === day.date
        return (
          <button
            key={day.date}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? "" : day.date)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60 sm:flex-col sm:items-start sm:gap-1",
              active && "border-primary bg-primary/5 hover:bg-primary/5"
            )}
          >
            <span className="text-2xs text-muted-foreground">
              {formatStayDate(day.date)}
            </span>
            <span className="flex items-baseline gap-3 sm:flex-col sm:gap-0.5">
              <span className="font-heading text-xl font-semibold tabular-nums">
                {number.format(day.guests)}
                <span className="ml-1 text-2xs font-normal text-muted-foreground">
                  guests
                </span>
              </span>
              <span className="text-2xs text-muted-foreground tabular-nums">
                {number.format(day.lunch)} lunch · {number.format(day.dinner)}{" "}
                dinner
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function matches(visit: GuestVisit, query: string) {
  if (!query) return true
  const q = query.toLowerCase()
  const digits = q.replace(/\D/g, "")
  return (
    visit.hostName.toLowerCase().includes(q) ||
    (visit.guestNames ?? "").toLowerCase().includes(q) ||
    (digits.length >= 3 && visit.hostMobile.includes(digits))
  )
}

/** One row per entry and day, which is how the kitchen counts. */
function downloadCsv(visits: GuestVisit[]) {
  const header = [
    "Day",
    "Host",
    "Host mobile",
    "Mandal",
    "Guests",
    "Lunch",
    "Dinner",
    "Guest names",
    "Notes",
    "Sent by",
    "Sent at",
  ]
  const rows = visits.flatMap((v) =>
    v.days.map((d) => [
      d.date,
      v.hostName,
      formatMobile(v.hostMobile),
      v.hostMandal,
      d.guests,
      d.meals.includes("lunch") ? "Yes" : "",
      d.meals.includes("dinner") ? "Yes" : "",
      v.guestNames ?? "",
      v.notes ?? "",
      v.source === "staff" ? "Desk" : "Host",
      v.createdAt,
    ])
  )
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `guests-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function DeleteButton({ visit }: { visit: GuestVisit }) {
  const remove = useDeleteGuestVisit()
  const [confirming, setConfirming] = React.useState(false)
  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${visit.hostName}'s guests`}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <RiDeleteBinLine />
      </Button>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-2xs">Remove?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={remove.isPending}
        onClick={() => remove.mutate(visit.id)}
      >
        {remove.isPending && <RiLoader4Line className="animate-spin" />}
        Remove
      </Button>
      {remove.error && (
        <span className="text-2xs text-destructive">
          {remove.error.message}
        </span>
      )}
    </span>
  )
}

function VisitCard({
  visit,
  day,
  canDelete,
}: {
  visit: GuestVisit
  /** The day being looked at: shown first and highlighted. */
  day: string
  canDelete: boolean
}) {
  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs/relaxed font-medium">
              {visit.hostName}'s guests
            </span>
            {visit.source === "staff" && <Badge variant="outline">Desk</Badge>}
          </span>
          <span className="text-2xs/relaxed text-muted-foreground">
            <a
              href={`tel:${visit.hostMobile}`}
              className="tabular-nums hover:text-foreground hover:underline"
            >
              {formatMobile(visit.hostMobile)}
            </a>{" "}
            · {visit.hostMandal}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to={`/guests/${visit.id}/edit`}
            aria-label={`Edit ${visit.hostName}'s guests`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <RiPencilLine />
          </Link>
          {canDelete && <DeleteButton visit={visit} />}
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {visit.days.map((d) => (
          <li
            key={d.date}
            className={cn(
              "rounded-md border border-border px-2 py-1 text-2xs tabular-nums",
              d.date === day && "border-primary bg-primary/5"
            )}
          >
            <span className="font-medium">{formatDay(d.date)}</span> ·{" "}
            {d.guests} · {formatMeals(d.meals)}
          </li>
        ))}
      </ul>

      {(visit.guestNames || visit.notes) && (
        <div className="flex flex-col gap-0.5 text-2xs/relaxed">
          {visit.guestNames && <span>{visit.guestNames}</span>}
          {visit.notes && (
            <span className="text-muted-foreground">Note: {visit.notes}</span>
          )}
        </div>
      )}

      <span className="text-3xs text-muted-foreground">
        Sent {formatCreatedAt(visit.createdAt)}
        {visit.editedAt &&
          ` · edited ${formatCreatedAt(visit.editedAt)} by ${visit.editedByName}`}
      </span>
    </li>
  )
}

/**
 * `/guests`: walk-in guests — friends and family devotees bring for the day.
 * Per-day totals for the kitchen, every entry, and the link to share with
 * hosts. A sanchalak sees their own mandal's hosts.
 */
export function Guests() {
  const { data: session } = useSession()
  const sanchalak = session?.user.role === "sanchalak"
  const { data: visits, isPending, isError, error, refetch } = useGuestVisits()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = React.useState("")

  const day = params.get("day") ?? ""
  const mandal = params.get("mandal") ?? ""
  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true, preventScrollReset: true }
    )

  const inMandal = (visits ?? []).filter(
    (v) => !mandal || v.hostMandal === mandal
  )
  const shown = inMandal.filter(
    (v) => (!day || v.days.some((d) => d.date === day)) && matches(v, query)
  )

  const header = (
    <PageHeader
      title="Walk-in guests"
      description={
        sanchalak
          ? `Friends and family hosts from ${session?.user.mandal ?? "your mandal"} are bringing for the day, and the meals they take.`
          : "Friends and family devotees are bringing for the day, and the meals they take."
      }
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            disabled={!visits?.length}
            onClick={() => downloadCsv(shown)}
          >
            <RiDownload2Line />
            CSV
          </Button>
          <Link to="/guests/new" className={buttonVariants({ size: "lg" })}>
            <RiUserAddLine />
            Add guests
          </Link>
        </>
      }
    />
  )

  if (isError) {
    return (
      <>
        {header}
        <LoadError
          title="Could not load guests"
          error={error}
          onRetry={() => void refetch()}
        />
      </>
    )
  }

  return (
    <>
      {header}
      <ShareLink
        title="Guest form link"
        description="Share it only with the devotees who are bringing guests. No sign-in needed."
        path="/guests/register"
        whatsappText={`${EVENT.name} — bringing friends or family for a day? Tell us whose guests they are, which days, how many, and whether they take mahaprasad:`}
        openLabel="Open the guest form"
      />

      {isPending ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </>
      ) : (
        <>
          <DayTotals
            visits={inMandal}
            selected={day}
            onSelect={(date) => setParam("day", date)}
          />

          <Card className="gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-3.5" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Host, guest or mobile"
                  aria-label="Search guests"
                  className="pl-9 sm:pl-7"
                />
              </div>
              <NativeSelect
                value={day}
                onChange={(e) => setParam("day", e.target.value)}
                aria-label="Day"
                className="sm:w-48"
              >
                <option value="">Every day</option>
                {EVENT.days.map((d) => (
                  <option key={d} value={d}>
                    {formatStayDate(d)}
                  </option>
                ))}
              </NativeSelect>
              {!sanchalak && (
                <MandalSelect
                  value={mandal}
                  onChange={(value) => setParam("mandal", value)}
                  first={[{ value: "", label: "Every mandal" }]}
                  last={[{ value: NO_MANDAL, label: NO_MANDAL }]}
                  aria-label="Mandal"
                  className="sm:w-48"
                />
              )}
            </div>
            <span className="text-2xs text-muted-foreground">
              {shown.length === (visits?.length ?? 0)
                ? `${shown.length} ${shown.length === 1 ? "entry" : "entries"}`
                : `${shown.length} of ${visits?.length ?? 0} entries`}
            </span>
          </Card>

          {shown.length === 0 ? (
            <EmptyState
              title={visits?.length ? "No guests match" : "No guests yet"}
              description={
                visits?.length
                  ? "Try another day, mandal or search."
                  : "Share the guest form link with the devotees who are bringing guests. What they send shows up here."
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  day={day}
                  canDelete={canReview(session?.user.role)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
