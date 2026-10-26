// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import {
  RiAddLine,
  RiErrorWarningLine,
  RiHotelBedLine,
  RiLoader4Line,
  RiSearchLine,
  RiWhatsappLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Skeleton,
} from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import { MANDALS, NO_MANDAL, formatDay } from "@/config/event"
import { AllotDialog } from "./AllotDialog"
import {
  useAccommodation,
  useSendAllNotices,
} from "./api"
import {
  NoticeLine,
  SendRoomDetails,
  StayStatusBadge,
} from "./components"
import {
  formatNight,
  indexAccommodation,
  nightTotals,
  placeNights,
  stayFor,
  type AccommodationIndex,
  type RegistrationStay,
} from "./rules"
import { PLACE_KINDS } from "./types"
import { useRegistrations } from "@/features/registrations/api"
import { StatusBadge } from "@/features/registrations/components"
import { displayName } from "@/features/registrations/format"
import type { Registration } from "@/features/registrations/types"
import { canReview, isAdmin, useSession } from "@/lib/auth-client"

const VIEWS = {
  to_allot: "To allot",
  attention: "Needs attention",
  allotted: "Allotted",
} as const
type View = keyof typeof VIEWS

type Row = { registration: Registration; stay: RegistrationStay }

const number = new Intl.NumberFormat("en-IN")

/** Each night: who needs a bed, who has one, and whether the beds go round. */
function Nights({ totals }: { totals: ReturnType<typeof nightTotals> }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Night by night</CardTitle>
        <CardDescription>
          People who asked for accommodation and sleep over that night, against
          the beds in every place.
        </CardDescription>
      </CardHeader>
      {/* Phones: one block per night. The five-column table needs a wider screen. */}
      <ul className="-mx-4 divide-y divide-border border-t border-border sm:hidden">
        {totals.map((n) => {
          const spare = n.beds - n.needed
          return (
            <li key={n.night} className="flex flex-col gap-0.5 px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs/relaxed">
                <span>{formatNight(n.night)}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    spare < 0 && "font-medium text-destructive"
                  )}
                >
                  {spare < 0
                    ? `Short by ${number.format(-spare)}`
                    : `${number.format(spare)} spare`}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground tabular-nums">
                <span>{number.format(n.needed)} need a bed</span>
                <span>{number.format(n.allotted)} have a room</span>
                <span>{number.format(n.beds)} beds</span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="-mx-4 hidden overflow-x-auto px-4 sm:block">
        <table className="w-full min-w-[28rem] text-left text-xs/relaxed tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1.5 pr-3 font-medium">Night</th>
              <th className="py-1.5 pr-3 text-right font-medium">Need a bed</th>
              <th className="py-1.5 pr-3 text-right font-medium">
                Have a room
              </th>
              <th className="py-1.5 pr-3 text-right font-medium">Beds</th>
              <th className="py-1.5 text-right font-medium">Spare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {totals.map((n) => {
              const spare = n.beds - n.needed
              return (
                <tr key={n.night}>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {formatNight(n.night)}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">
                    {number.format(n.needed)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {number.format(n.allotted)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {number.format(n.beds)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right",
                      spare < 0 && "font-medium text-destructive"
                    )}
                  >
                    {spare < 0
                      ? `Short by ${number.format(-spare)}`
                      : number.format(spare)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Places({
  index,
  scoped,
}: {
  index: AccommodationIndex
  scoped: boolean
}) {
  if (index.places.length === 0) {
    return (
      <EmptyState
        title="No places yet"
        description="Add the guest houses and hotels people will stay in, with their rooms."
      />
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {index.places.map((place) => {
        const nights = placeNights(place, index)
        const beds = nights[0]?.beds ?? 0
        const people = new Set(
          place.rooms.flatMap((room) =>
            index
              .occupantsOf(place.id, room.id)
              .map((o) => `${o.registration.id}:${o.member.id}`)
          )
        ).size
        return (
          <Link
            key={place.id}
            to={`/accommodation/places/${place.id}`}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 font-heading text-sm font-medium">
                {place.name}
                {place.kind === "hotel" && (
                  <Badge variant="outline">{PLACE_KINDS.hotel}</Badge>
                )}
              </span>
              <span className="text-2xs text-muted-foreground">
                {place.area ?? place.address} · {place.rooms.length} rooms ·{" "}
                {beds} beds
              </span>
            </div>
            {scoped ? (
              <span className="text-2xs/relaxed text-muted-foreground">
                {people === 0
                  ? "None of your people here"
                  : `${people} of your ${people === 1 ? "person" : "people"} here`}
              </span>
            ) : (
              <ul className="flex flex-col gap-1.5">
                <li className="text-3xs text-muted-foreground">
                  Beds taken each night
                </li>
                {nights.map((n) => (
                  <li key={n.night} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-2 text-2xs text-muted-foreground tabular-nums">
                      <span>{formatNight(n.night)}</span>
                      <span
                        className={cn(
                          n.used > n.beds && "font-medium text-destructive"
                        )}
                      >
                        {n.used} / {n.beds}
                      </span>
                    </div>
                    <Progress value={n.used} max={n.beds} />
                  </li>
                ))}
              </ul>
            )}
          </Link>
        )
      })}
    </div>
  )
}

/** Where everyone in a registration sleeps, as "Gurukul – Memnagar · Rooms 4, 5". */
function WhereTheyStay({ stay }: { stay: RegistrationStay }) {
  const byPlace = new Map<string, Set<string>>()
  for (const a of stay.allotted) {
    byPlace.set(
      a.place.name,
      (byPlace.get(a.place.name) ?? new Set()).add(a.room.label)
    )
  }
  return (
    <span className="text-2xs/relaxed">
      {[...byPlace]
        .map(
          ([place, rooms]) =>
            `${place} · ${rooms.size === 1 ? "Room" : "Rooms"} ${[...rooms].join(", ")}`
        )
        .join("; ")}
    </span>
  )
}

function RegistrationRow({
  row,
  view,
  reviewer,
  index,
  onAllot,
}: {
  row: Row
  view: View
  reviewer: boolean
  index: AccommodationIndex
  onAllot: () => void
}) {
  const { registration: r, stay } = row
  const unconfirmed = stay.status === "unconfirmed"
  const notice = index.notices.get(r.id)
  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        unconfirmed && "bg-muted/30"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/registrations/${r.id}`}
            className="truncate text-xs/relaxed font-medium hover:underline"
          >
            {displayName(r)}
          </Link>
          {r.status !== "confirmed" && <StatusBadge status={r.status} />}
          <StayStatusBadge stay={stay} />
        </div>
        <span className="text-2xs text-muted-foreground tabular-nums">
          {r.code} · {r.mandal} · {stay.sleepers.length}{" "}
          {stay.sleepers.length === 1 ? "bed" : "beds"} ·{" "}
          {formatDay(r.arrival.date)} → {formatDay(r.departure.date)}
          {stay.sleepers.some((m) => m.gender === "female") &&
            stay.sleepers.some((m) => m.gender === "male") &&
            " · mixed"}
        </span>
        {stay.allotted.length > 0 && <WhereTheyStay stay={stay} />}
        {view !== "to_allot" &&
          [...stay.problems, ...stay.warnings].map((text) => (
            <span
              key={text}
              className={cn(
                "flex items-start gap-1 text-2xs/relaxed",
                stay.problems.includes(text)
                  ? "text-destructive"
                  : "text-amber-700 dark:text-amber-400"
              )}
            >
              <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
              {text}
            </span>
          ))}
        {view === "allotted" && (
          <span className="text-2xs/relaxed">
            <NoticeLine notice={notice} />
          </span>
        )}
      </div>
      {reviewer && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {unconfirmed ? (
            <Link
              to={`/registrations/${r.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Confirm first
            </Link>
          ) : (
            <Button
              size="sm"
              variant={view === "to_allot" ? "default" : "outline"}
              onClick={onAllot}
            >
              <RiHotelBedLine />
              {stay.allotted.length > 0 ? "Change rooms" : "Allot"}
            </Button>
          )}
          {view === "allotted" &&
            stay.status === "allotted" &&
            stay.problems.length === 0 && (
              <SendRoomDetails registration={r} notice={notice} size="sm" />
            )}
        </div>
      )}
    </li>
  )
}

/** "Send all room details", after a confirmation: it messages many people at once. */
function SendAll({ index, rows }: { index: AccommodationIndex; rows: Row[] }) {
  const sendAll = useSendAllNotices()
  const [open, setOpen] = React.useState(false)
  const due = rows.filter(
    (row) =>
      row.stay.status === "allotted" &&
      row.stay.problems.length === 0 &&
      !index.notices.get(row.registration.id)?.upToDate
  )

  if (!index.whatsApp) {
    return (
      <span
        className="text-2xs/relaxed text-muted-foreground"
        title="Sending to everyone at once needs WhatsApp set up on the server. Until then, send room details one by one."
      >
        Send all: needs WhatsApp
      </span>
    )
  }

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        disabled={due.length === 0}
        onClick={() => {
          sendAll.reset()
          setOpen(true)
        }}
      >
        <RiWhatsappLine />
        Send all room details{due.length > 0 && ` (${due.length})`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader
            title={`Send room details to ${due.length} ${due.length === 1 ? "registration" : "registrations"}?`}
            description="Each contact gets one WhatsApp message with their place, rooms, map and coordinator. Only registrations where everyone has a room and nothing needs attention."
          />
          <DialogBody>
            {sendAll.isSuccess ? (
              <p className="text-xs/relaxed">
                Sent {sendAll.data.sent}.
                {sendAll.data.failed.length > 0 &&
                  ` Not sent: ${sendAll.data.failed.join(", ")} — try those one by one.`}
              </p>
            ) : (
              <p className="text-xs/relaxed text-muted-foreground">
                Registrations already told, with nothing changed since, are
                skipped.
              </p>
            )}
            {sendAll.isError && (
              <p className="text-2xs/relaxed text-destructive">
                {sendAll.error.message}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {sendAll.isSuccess ? "Close" : "Cancel"}
            </Button>
            {!sendAll.isSuccess && (
              <Button
                disabled={sendAll.isPending}
                onClick={() => sendAll.mutate()}
              >
                {sendAll.isPending && (
                  <RiLoader4Line className="animate-spin" />
                )}
                Send {due.length}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * `/accommodation`: the places and how full they are each night, and the
 * registrations to give rooms to, to fix, and to tell.
 */
export function AllotmentScreen() {
  const { data: session } = useSession()
  const role = session?.user.role
  const reviewer = canReview(role)
  const scope = role === "sanchalak" ? session?.user.mandal : undefined
  // Polled, so registrations confirmed meanwhile appear under To allot.
  const registrations = useRegistrations({ poll: true })
  const accommodation = useAccommodation()
  const [params, setParams] = useSearchParams()
  const [allottingId, setAllottingId] = React.useState<string>()

  const view = (params.get("view") as View | null) ?? "to_allot"
  const query = (params.get("q") ?? "").toLowerCase()
  const mandal = params.get("mandal") ?? ""
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const index = React.useMemo(
    () =>
      accommodation.data && registrations.data
        ? indexAccommodation(accommodation.data, registrations.data)
        : undefined,
    [accommodation.data, registrations.data]
  )
  const rows = React.useMemo<Row[]>(
    () =>
      index && registrations.data
        ? registrations.data
            .filter((r) => r.accommodationRequired && r.status !== "cancelled")
            .map((registration) => ({
              registration,
              stay: stayFor(registration, index),
            }))
        : [],
    [index, registrations.data]
  )

  if (registrations.isError || accommodation.isError) {
    return (
      <>
        <PageHeader title="Accommodation" />
        <LoadError
          title="Could not load accommodation"
          error={registrations.error ?? accommodation.error}
          onRetry={() => {
            void registrations.refetch()
            void accommodation.refetch()
          }}
        />
      </>
    )
  }
  if (!index || !registrations.data) {
    return (
      <>
        <PageHeader title="Accommodation" description="Loading…" />
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </>
    )
  }

  const lists: Record<View, Row[]> = {
    to_allot: rows
      .filter((row) =>
        ["to_allot", "partly", "unconfirmed"].includes(row.stay.status)
      )
      // Ready to allot first, then those waiting on a confirmation.
      .sort(
        (a, b) =>
          Number(a.stay.status === "unconfirmed") -
            Number(b.stay.status === "unconfirmed") ||
          a.registration.arrival.date.localeCompare(
            b.registration.arrival.date
          ) ||
          a.registration.code.localeCompare(b.registration.code)
      ),
    attention: rows.filter((row) => row.stay.problems.length > 0),
    allotted: rows
      .filter((row) => row.stay.allotted.length > 0)
      .sort((a, b) => a.registration.code.localeCompare(b.registration.code)),
  }
  const shown = lists[view].filter(
    ({ registration: r }) =>
      (!mandal || r.mandal === mandal) &&
      (!query ||
        r.code.toLowerCase().includes(query) ||
        (r.groupName ?? "").toLowerCase().includes(query) ||
        r.members.some((m) => m.fullName.toLowerCase().includes(query)))
  )

  const needing = rows.reduce((sum, row) => sum + row.stay.sleepers.length, 0)
  const housed = rows.reduce((sum, row) => sum + row.stay.allotted.length, 0)
  const beds = index.places.reduce(
    (sum, p) => sum + p.rooms.reduce((s, r) => s + r.beds, 0),
    0
  )
  const allotting = allottingId
    ? registrations.data.find((r) => r.id === allottingId)
    : undefined

  return (
    <>
      <PageHeader
        title={scope ? `Accommodation · ${scope}` : "Accommodation"}
        description={
          scope
            ? `${housed} of ${needing} people have a room.`
            : `${housed} of ${needing} people have a room · ${beds} beds in ${index.places.length} places.`
        }
        actions={
          <>
            {reviewer && <SendAll index={index} rows={rows} />}
            {isAdmin(role) && (
              <Link
                to="/accommodation/places/new"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiAddLine />
                Add place
              </Link>
            )}
          </>
        }
      />

      {!scope && <Nights totals={nightTotals(registrations.data, index)} />}
      <Places index={index} scoped={!!scope} />

      <div className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Registrations"
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {(Object.keys(VIEWS) as View[]).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={view === key}
              onClick={() => setParam("view", key === "to_allot" ? "" : key)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2 text-xs/relaxed whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                view === key && "border-primary font-medium text-foreground"
              )}
            >
              {VIEWS[key]}
              <span
                className={cn(
                  "rounded-sm bg-muted px-1.5 text-3xs tabular-nums",
                  key === "attention" &&
                    lists.attention.length > 0 &&
                    "bg-destructive/10 text-destructive"
                )}
              >
                {lists[key].length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:min-w-56 sm:flex-1">
            <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-3.5" />
            <Input
              id="accommodation-search"
              type="search"
              value={params.get("q") ?? ""}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search name or code"
              className="pl-10 sm:pl-8"
            />
          </div>
          {!scope && (
            <NativeSelect
              id="accommodation-mandal"
              aria-label="Mandal"
              value={mandal}
              onChange={(e) => setParam("mandal", e.target.value)}
              className="sm:w-48"
            >
              <option value="">Mandal: all</option>
              {[...MANDALS, NO_MANDAL].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>

        {shown.length === 0 ? (
          <EmptyState
            title={
              lists[view].length > 0
                ? "Nothing matches"
                : view === "to_allot"
                  ? "Everyone who asked has a room"
                  : view === "attention"
                    ? "Nothing needs attention"
                    : "No rooms allotted yet"
            }
            description={
              lists[view].length > 0
                ? "Try a different name or code, or another mandal."
                : view === "attention"
                  ? "Rooms that stop fitting after a change, and registrations back to pending, show up here."
                  : "Registrations that asked for accommodation are listed under To allot."
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {shown.map((row) => (
              <RegistrationRow
                key={row.registration.id}
                row={row}
                view={view}
                reviewer={reviewer}
                index={index}
                onAllot={() => setAllottingId(row.registration.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {allotting && (
        <AllotDialog
          registration={allotting}
          index={index}
          open
          onOpenChange={(open) => !open && setAllottingId(undefined)}
        />
      )}
    </>
  )
}
