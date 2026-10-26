import { RiAddLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Badge,
  EmptyState,
  Progress,
  Skeleton,
} from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import { MANDALS } from "@/config/event"
import { useAccommodation } from "@/features/accommodation/api"
import { MandalStayCard } from "@/features/accommodation/components"
import {
  addOccupancy,
  occupancyOf,
  peopleAskingByMandal,
  placeSummary,
  type Occupancy,
} from "@/features/accommodation/mandal-stays"
import { MandalStayDialog } from "@/features/accommodation/MandalStayDialog"
import { OccupancyDialog } from "@/features/accommodation/OccupancyDialog"
import {
  PLACE_KINDS,
  type MandalStay,
  type Place,
} from "@/features/accommodation/types"
import { useRegistrations } from "@/features/registrations/api"
import { canReview, isAdmin, useSession } from "@/lib/auth-client"

const number = new Intl.NumberFormat("en-IN")

const empty: Occupancy = {
  rooms: 0,
  beds: 0,
  reported: 0,
  occupied: 0,
  people: 0,
}

/** What is open: giving rooms, changing a mandal's rooms, or its occupancy. */
type Open =
  | { kind: "give"; mandal?: string; placeId?: string }
  | { kind: "edit"; stay: MandalStay }
  | { kind: "report"; stay: MandalStay }

function Tile({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="font-heading text-lg font-medium tabular-nums">
        {value}
      </span>
      {detail && (
        <span className="text-3xs text-muted-foreground">{detail}</span>
      )}
    </div>
  )
}

function Places({
  places,
  stays,
  scoped,
  onGive,
}: {
  places: Place[]
  stays: MandalStay[]
  scoped: boolean
  /** Opens "Give rooms" with the place picked; absent for those who can't give. */
  onGive?: (placeId: string) => void
}) {
  if (places.length === 0) {
    return (
      <EmptyState
        title={scoped ? "No rooms for your mandal yet" : "No places yet"}
        description={
          scoped
            ? "The seva team will give your mandal rooms; they show up here."
            : "Add the guest houses and hotels people will stay in, with their rooms."
        }
      />
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {places.map((place) => {
        const s = placeSummary(place, stays)
        return (
          // The whole card opens the place; the button sits above that link.
          <div
            key={place.id}
            className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <Link
              to={`/accommodation/places/${place.id}`}
              aria-label={place.name}
              className="absolute inset-0 rounded-lg"
            />
            <div className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 font-heading text-sm font-medium">
                {place.name}
                {place.kind === "hotel" && (
                  <Badge variant="outline">{PLACE_KINDS.hotel}</Badge>
                )}
              </span>
              <span className="text-2xs text-muted-foreground">
                {place.area ?? place.address} · {s.rooms} rooms · {s.beds} beds
              </span>
            </div>
            <div className="flex flex-col gap-1 text-2xs text-muted-foreground tabular-nums">
              {scoped ? (
                <span>{s.given.rooms} rooms for your mandal</span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">
                    {s.given.rooms}
                  </span>{" "}
                  given to {s.stays.length}{" "}
                  {s.stays.length === 1 ? "mandal" : "mandals"} ·{" "}
                  <span className={cn(s.free > 0 && "text-foreground")}>
                    {s.free} free
                  </span>
                </span>
              )}
              {s.given.rooms > 0 && (
                <>
                  <Progress value={s.given.occupied} max={s.given.rooms} />
                  <span>
                    {s.given.occupied} of {s.given.rooms} occupied ·{" "}
                    {s.given.people}{" "}
                    {s.given.people === 1 ? "person" : "people"}
                  </span>
                </>
              )}
            </div>
            {onGive && s.free > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onGive(place.id)}
                className="relative mt-auto self-start"
              >
                <RiAddLine />
                Give rooms
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * `/accommodation`: the places, how many of their rooms are given to mandals
 * and how full the coordinators say they are, and each mandal's rooms with
 * its coordinator to call. A sanchalak sees only their own mandal's.
 *
 * Per-person allotment, which this replaced on 2026-10-11, is kept in
 * src/features/accommodation/paused.
 */
export function Accommodation() {
  const { data: session } = useSession()
  const role = session?.user.role
  const reviewer = canReview(role)
  const mandalScope =
    role === "sanchalak" ? (session?.user.mandal ?? undefined) : undefined
  const accommodation = useAccommodation()
  const registrations = useRegistrations()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = React.useState<Open>()

  const mandalFilter = params.get("mandal") ?? ""

  if (accommodation.isError) {
    return (
      <>
        <PageHeader title="Accommodation" />
        <LoadError
          title="Could not load accommodation"
          error={accommodation.error}
          onRetry={() => void accommodation.refetch()}
        />
      </>
    )
  }
  if (!accommodation.data) {
    return (
      <>
        <PageHeader title="Accommodation" description="Loading…" />
        <Skeleton className="h-32" />
        <Skeleton className="h-80" />
      </>
    )
  }

  const { places, mandalStays: stays } = accommodation.data
  const placeById = new Map(places.map((p) => [p.id, p]))
  // Registrations only add "people asking"; the screen works without them.
  const asking = registrations.data
    ? peopleAskingByMandal(registrations.data)
    : undefined
  const canReport = (stay: MandalStay) =>
    reviewer || (role === "sanchalak" && session?.user.mandal === stay.mandal)

  const shownPlaces = mandalScope
    ? places.filter((p) => stays.some((s) => s.placeId === p.id))
    : places
  const totalRooms = places.reduce((sum, p) => sum + p.rooms.length, 0)
  const given = stays.reduce(
    (sum, s) => addOccupancy(sum, occupancyOf(s, placeById.get(s.placeId))),
    empty
  )
  const totalAsking = asking
    ? [...asking.values()].reduce((a, b) => a + b, 0)
    : undefined

  // Every mandal with rooms or with people asking for a bed, in list order.
  const mandals = mandalScope
    ? [mandalScope]
    : [
        ...MANDALS.filter(
          (m) => stays.some((s) => s.mandal === m) || asking?.get(m)
        ),
        ...new Set(
          stays
            .map((s) => s.mandal)
            .filter((m) => !(MANDALS as readonly string[]).includes(m))
        ),
      ]
  const shownMandals = mandalFilter
    ? mandals.filter((m) => m === mandalFilter)
    : mandals

  const openPlace =
    open && open.kind !== "give" ? placeById.get(open.stay.placeId) : undefined

  return (
    <>
      <PageHeader
        title={mandalScope ? `Accommodation · ${mandalScope}` : "Accommodation"}
        description={
          mandalScope
            ? `${given.rooms} rooms for your mandal · ${given.occupied} occupied · ${given.people} people`
            : `${given.rooms} of ${totalRooms} rooms given to mandals · ${places.length} places`
        }
        actions={
          <>
            {reviewer && places.length > 0 && (
              <Button size="lg" onClick={() => setOpen({ kind: "give" })}>
                <RiAddLine />
                Give rooms
              </Button>
            )}
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

      {!mandalScope && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Rooms given"
            value={`${number.format(given.rooms)} / ${number.format(totalRooms)}`}
            detail={`${number.format(totalRooms - given.rooms)} still free`}
          />
          <Tile
            label="Occupied"
            value={`${number.format(given.occupied)} / ${number.format(given.rooms)}`}
            detail={
              given.reported < given.rooms
                ? `${number.format(given.rooms - given.reported)} rooms not reported`
                : "Every room reported"
            }
          />
          <Tile
            label="People staying"
            value={number.format(given.people)}
            detail={`In ${number.format(given.beds)} beds given`}
          />
          <Tile
            label="Asked for a stay"
            value={totalAsking === undefined ? "–" : number.format(totalAsking)}
            detail="People in registrations"
          />
        </div>
      )}

      <Places
        places={shownPlaces}
        stays={stays}
        scoped={!!mandalScope}
        onGive={
          reviewer ? (placeId) => setOpen({ kind: "give", placeId }) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-sm font-medium">
            {mandalScope ? "Your rooms" : "Mandals"}
          </h2>
          {!mandalScope && mandals.length > 1 && (
            <NativeSelect
              id="accommodation-mandal"
              aria-label="Mandal"
              value={mandalFilter}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value) next.set("mandal", e.target.value)
                else next.delete("mandal")
                setParams(next, { replace: true })
              }}
              className="sm:w-56"
            >
              <option value="">Mandal: all</option>
              {mandals.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>

        {shownMandals.length === 0 ? (
          <EmptyState
            title="No mandal has rooms yet"
            description={
              reviewer
                ? "Give a mandal rooms at a place — its coordinator then decides who sleeps where."
                : "Mandals given rooms show up here."
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {shownMandals.map((mandal) => {
              const theirs = stays.filter((s) => s.mandal === mandal)
              const totals = theirs.reduce(
                (sum, s) =>
                  addOccupancy(sum, occupancyOf(s, placeById.get(s.placeId))),
                empty
              )
              const people = asking?.get(mandal) ?? 0
              return (
                <li key={mandal} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs/relaxed font-medium">
                        {mandal}
                        {theirs.length === 0 && (
                          <Badge variant="warning">No rooms yet</Badge>
                        )}
                      </span>
                      <span className="text-2xs text-muted-foreground tabular-nums">
                        {asking &&
                          `${people} ${people === 1 ? "person" : "people"} asked for a stay · `}
                        {totals.rooms} {totals.rooms === 1 ? "room" : "rooms"} ·{" "}
                        {totals.beds} beds
                        {asking && people > totals.beds && totals.rooms > 0 && (
                          <span className="text-amber-700 dark:text-amber-400">
                            {" "}
                            · {people - totals.beds} more people than beds
                          </span>
                        )}
                      </span>
                    </div>
                    {reviewer && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpen({ kind: "give", mandal })}
                      >
                        <RiAddLine />
                        Give rooms
                      </Button>
                    )}
                  </div>
                  {theirs.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {theirs.map((stay) => (
                        <MandalStayCard
                          key={stay.id}
                          stay={stay}
                          place={placeById.get(stay.placeId)}
                          heading="place"
                          canEdit={reviewer}
                          canReport={
                            canReport(stay) && placeById.has(stay.placeId)
                          }
                          onEdit={() => setOpen({ kind: "edit", stay })}
                          onReport={() => setOpen({ kind: "report", stay })}
                        />
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {open?.kind === "give" && (
        <MandalStayDialog
          places={places}
          stays={stays}
          mandal={open.mandal}
          placeId={open.placeId}
          onEditExisting={(stay) => setOpen({ kind: "edit", stay })}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "edit" && (
        <MandalStayDialog
          places={places}
          stays={stays}
          stay={open.stay}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "report" && openPlace && (
        <OccupancyDialog
          stay={open.stay}
          place={openPlace}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  )
}
