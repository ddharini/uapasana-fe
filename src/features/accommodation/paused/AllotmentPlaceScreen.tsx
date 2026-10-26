// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import {
  RiDownload2Line,
  RiEditLine,
  RiErrorWarningLine,
  RiEyeLine,
  RiMapPinLine,
  RiPhoneLine,
  RiPrinterLine,
  RiWheelchairLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { BackLink } from "@/components/layout/BackLink"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives"
import { useAccommodation } from "./api"
import {
  NightOccupancy,
  PersonPill,
  RoomKindBadge,
} from "./components"
import { RoomDialog } from "./RoomDialog"
import {
  NIGHTS,
  bedTakers,
  formatNight,
  formatNights,
  indexAccommodation,
  placeNights,
  roomProblem,
  sortRooms,
  type AccommodationIndex,
} from "./rules"
import {
  PLACE_KINDS,
  ROOM_KINDS,
  floorLabel,
  type Place,
  type Room,
} from "./types"
import { useRegistrations } from "@/features/registrations/api"
import { GENDERS } from "@/features/registrations/types"
import { isAdmin, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"

/** One row per person, for the guest house's own list. */
function downloadCsv(place: Place, index: AccommodationIndex) {
  const header = [
    "Room",
    "Type",
    "Name",
    "Gender",
    "Age",
    "Mobile",
    "Code",
    "Mandal",
    "Arrival",
    "Departure",
    "Nights",
    "Assistance",
  ]
  const rows = sortRooms(place.rooms).flatMap((room) =>
    index
      .occupantsOf(place.id, room.id)
      .map(({ registration: r, member: m, nights }) => [
        room.label,
        ROOM_KINDS[room.kind],
        m.fullName,
        GENDERS[m.gender],
        m.age,
        m.mobile
          ? formatMobile(m.mobile)
          : r.members[0]?.mobile
            ? `${formatMobile(r.members[0].mobile)} (contact)`
            : "",
        r.code,
        r.mandal,
        `${m.arrival.date} ${m.arrival.slot}`,
        `${m.departure.date} ${m.departure.slot}`,
        nights.length,
        m.needsAssistance ? (m.assistanceNote ?? "Yes") : "",
      ])
  )
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `${place.name.replace(/[^\w]+/g, "-").toLowerCase()}-rooms.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * `/accommodation/places/:id`: one place, room by room — who is in each and
 * on which nights, with anything that no longer fits flagged. Prints as the
 * list to hand the guest house.
 */
export function AllotmentPlaceScreen() {
  const { id = "" } = useParams()
  const { data: session } = useSession()
  const registrations = useRegistrations()
  const accommodation = useAccommodation()
  const [openRoomId, setOpenRoomId] = React.useState<string>()

  const index = React.useMemo(
    () =>
      accommodation.data && registrations.data
        ? indexAccommodation(accommodation.data, registrations.data)
        : undefined,
    [accommodation.data, registrations.data]
  )

  const back = (
    <BackLink to="/accommodation" className="print:hidden">
      Accommodation
    </BackLink>
  )

  if (registrations.isError || accommodation.isError) {
    return (
      <>
        {back}
        <LoadError
          title="Could not load this place"
          error={registrations.error ?? accommodation.error}
          onRetry={() => {
            void registrations.refetch()
            void accommodation.refetch()
          }}
        />
      </>
    )
  }
  if (!index) {
    return (
      <>
        {back}
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96" />
      </>
    )
  }

  const place = index.placeById.get(id)
  if (!place) {
    return (
      <>
        {back}
        <EmptyState
          title="Place not found"
          description="It may have been removed."
        />
      </>
    )
  }

  const nights = placeNights(place, index)
  const scoped = session?.user.role === "sanchalak"
  const editable = isAdmin(session?.user.role)
  const openRoom = place.rooms.find((r) => r.id === openRoomId)

  return (
    <>
      {back}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {place.name}
            <Badge variant="outline">{PLACE_KINDS[place.kind]}</Badge>
          </span>
        }
        description={`${place.address}${place.area && !place.address.includes(place.area) ? ` · ${place.area}` : ""} · ${place.rooms.length} rooms · ${nights[0]?.beds ?? 0} beds`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {/* Nobody prints from a phone; it would only crowd the row. */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.print()}
              className="hidden sm:inline-flex"
            >
              <RiPrinterLine />
              Print
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => downloadCsv(place, index)}
            >
              <RiDownload2Line />
              CSV
            </Button>
            {isAdmin(session?.user.role) && (
              <Link
                to={`/accommodation/places/${place.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiEditLine />
                Edit place
              </Link>
            )}
          </div>
        }
      />

      <Card className="gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs/relaxed">
          {place.mapUrl && (
            <a
              href={place.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <RiMapPinLine className="size-3.5" />
              Open in Maps
            </a>
          )}
          {place.coordinatorName || place.coordinatorMobile ? (
            <span className="inline-flex items-center gap-1">
              <RiPhoneLine className="size-3.5 text-muted-foreground" />
              {place.coordinatorName ?? "Coordinator"}
              {place.coordinatorMobile && (
                <a
                  href={`tel:${place.coordinatorMobile}`}
                  className="tabular-nums hover:underline"
                >
                  {formatMobile(place.coordinatorMobile)}
                </a>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">No coordinator yet</span>
          )}
        </div>
        {place.notes && (
          <p className="text-2xs/relaxed text-muted-foreground">
            {place.notes}
          </p>
        )}
        {!scoped && <NightOccupancy nights={nights} />}
        {!scoped && (nights[0]?.extraBeds ?? 0) > 0 && (
          <p className="text-2xs/relaxed text-muted-foreground">
            Plus {nights[0].extraBeds} extra mattresses, used only when a room's
            beds run out.
          </p>
        )}
      </Card>

      {openRoom && (
        <RoomDialog
          place={place}
          room={openRoom}
          index={index}
          editable={editable}
          scoped={scoped}
          onClose={() => setOpenRoomId(undefined)}
        />
      )}

      {place.rooms.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          description="An admin adds them from Edit place."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
          {sortRooms(place.rooms).map((room) => (
            <RoomCard
              key={room.id}
              place={place}
              room={room}
              index={index}
              scoped={scoped}
              editable={editable}
              onOpen={() => setOpenRoomId(room.id)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * One room on the place page. Clicking it opens the room; hovering (or
 * tabbing to it) slides the Edit button up from the bottom. The night tiles
 * pick a night to list only who sleeps there then — pressed again, everyone.
 */
function RoomCard({
  place,
  room,
  index,
  scoped,
  editable,
  onOpen,
}: {
  place: Place
  room: Room
  index: AccommodationIndex
  scoped: boolean
  editable: boolean
  onOpen: () => void
}) {
  const [night, setNight] = React.useState<string>()
  const occupants = index.occupantsOf(place.id, room.id)
  const shown = night
    ? occupants.filter((o) => o.nights.includes(night))
    : occupants
  const problem = roomProblem(room, occupants)

  return (
    <li className="break-inside-avoid">
      {/* A plain click target for the mouse; the Edit button is what the
          keyboard reaches. The night tiles are buttons of their own. */}
      <div
        onClick={onOpen}
        className={cn(
          // Less padding under the Edit bar while it shows, so the bar stays
          // compact; it eases with the card's growth.
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card p-3 text-left transition-[border-color,padding] duration-300 ease-out focus-within:pb-2 hover:border-primary/40 hover:pb-2 motion-reduce:transition-none",
          problem && "border-destructive/40",
          night && "pb-2"
        )}
      >
        {/* Fills the card, so the Edit bar below always sits at the very
            bottom — even when the card is stretched to its row's height. */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5 text-xs/relaxed font-medium">
              Room {room.label}
              <RoomKindBadge kind={room.kind} />
              <Badge variant="outline">{floorLabel(room.floor)}</Badge>
            </span>
            <span className="text-2xs text-muted-foreground tabular-nums">
              {room.beds} {room.beds === 1 ? "bed" : "beds"}
              {room.extraBeds ? ` + ${room.extraBeds} extra` : ""}
            </span>
          </div>
          {!scoped && occupants.length > 0 && (
            <NightOccupancy
              compact
              selected={night}
              onSelect={setNight}
              nights={NIGHTS.map((n) => ({
                night: n,
                beds: room.beds,
                used: bedTakers(occupants, n),
                extraBeds: room.extraBeds,
              }))}
            />
          )}
          {occupants.length === 0 ? (
            <p className="text-2xs/relaxed text-muted-foreground">
              {scoped
                ? "None of your people"
                : `Empty · ${room.beds === 1 ? "its bed is" : `all ${room.beds} beds are`} free every night`}
            </p>
          ) : shown.length === 0 ? (
            <p className="text-2xs/relaxed text-muted-foreground">
              Nobody here on {formatNight(night!)}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {shown.map(({ registration: r, member: m }) => (
                <li
                  key={`${r.id}:${m.id}`}
                  className="flex flex-col text-2xs/relaxed"
                >
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="font-medium text-foreground">
                      {m.fullName}
                    </span>
                    {m.needsAssistance && (
                      <RiWheelchairLine
                        className="size-3.5 text-amber-700 dark:text-amber-400"
                        aria-label={m.assistanceNote ?? "Needs assistance"}
                      />
                    )}
                    <span className="text-muted-foreground tabular-nums">
                      {r.code}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground tabular-nums">
                    <PersonPill gender={m.gender} age={m.age} />
                    {formatNights(m)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {problem && (
            <p className="flex items-start gap-1 text-2xs/relaxed text-destructive">
              <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
              {problem}
            </p>
          )}
        </div>

        {/* Folded away until the card is hovered, tabbed into, or a night is
            picked on it: the card then grows to show it, so it never covers
            anyone. Folded with 0fr rows rather than `hidden`, so the button
            can still be tabbed to, and so the growing can be animated — a
            0fr → 1fr row transitions smoothly where `height: auto` cannot.
            -mx-3 takes the divider to the card's edges. */}
        <div
          className={cn(
            "-mx-3 grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-focus-within:grid-rows-[1fr] group-hover:grid-rows-[1fr] motion-reduce:transition-none print:hidden",
            night && "grid-rows-[1fr]"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            {/* No negative margins in here: inside the clipping box they
                would shave the bottom off the button. */}
            {/* The card grows and the bar slides up and fades in with it. */}
            <div
              className={cn(
                "mt-1 flex translate-y-full justify-center border-t border-border pt-1.5 opacity-0 transition-[translate,opacity] duration-300 ease-out group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100",
                night && "translate-y-0 opacity-100"
              )}
            >
              <Button
                size="sm"
                variant={editable ? "default" : "outline"}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen()
                }}
              >
                {editable ? <RiEditLine /> : <RiEyeLine />}
                {editable ? "Edit room" : "View room"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
