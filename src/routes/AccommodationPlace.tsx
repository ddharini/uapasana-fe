import {
  RiAddLine,
  RiDownload2Line,
  RiEditLine,
  RiMapPinLine,
  RiPrinterLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { BackLink } from "@/components/layout/BackLink"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives"
import { useAccommodation } from "@/features/accommodation/api"
import {
  Contact,
  MandalStayCard,
  RoomKindBadge,
} from "@/features/accommodation/components"
import {
  holders,
  peopleIn,
  placeSummary,
  sortRooms,
} from "@/features/accommodation/mandal-stays"
import { MandalStayDialog } from "@/features/accommodation/MandalStayDialog"
import { OccupancyDialog } from "@/features/accommodation/OccupancyDialog"
import {
  PLACE_KINDS,
  ROOM_KINDS,
  floorLabel,
  type MandalStay,
  type Place,
} from "@/features/accommodation/types"
import { canReview, isAdmin, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"

/** One row per room, for the guest house's own list. */
function downloadCsv(place: Place, stays: MandalStay[]) {
  const holder = holders(place, stays)
  const header = [
    "Room",
    "Type",
    "Floor",
    "Beds",
    "Extra mattresses",
    "Mandal",
    "Coordinator",
    "Mobile",
    "People",
  ]
  const rows = sortRooms(place.rooms).map((room) => {
    const stay = holder.get(room.id)
    return [
      room.label,
      ROOM_KINDS[room.kind],
      floorLabel(room.floor),
      room.beds,
      room.extraBeds ?? 0,
      stay?.mandal ?? "",
      stay?.coordinatorName ?? "",
      stay ? formatMobile(stay.coordinatorMobile) : "",
      stay ? (peopleIn(stay, room.id) ?? "") : "",
    ]
  })
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

type Open =
  | { kind: "give" }
  | { kind: "edit"; stay: MandalStay }
  | { kind: "report"; stay: MandalStay }

/**
 * `/accommodation/places/:id`: one place — which mandals have its rooms, who
 * coordinates each, how full they are, and every room with its mandal. Prints
 * as the list to hand the guest house. A sanchalak sees only their mandal's.
 */
export function AccommodationPlace() {
  const { id = "" } = useParams()
  const { data: session } = useSession()
  const role = session?.user.role
  const reviewer = canReview(role)
  const scoped = role === "sanchalak"
  const accommodation = useAccommodation()
  const [open, setOpen] = React.useState<Open>()

  const back = (
    <BackLink to="/accommodation" className="print:hidden">
      Accommodation
    </BackLink>
  )

  if (accommodation.isError) {
    return (
      <>
        {back}
        <LoadError
          title="Could not load this place"
          error={accommodation.error}
          onRetry={() => void accommodation.refetch()}
        />
      </>
    )
  }
  if (!accommodation.data) {
    return (
      <>
        {back}
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96" />
      </>
    )
  }

  const { places, mandalStays } = accommodation.data
  const place = places.find((p) => p.id === id)
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

  const summary = placeSummary(place, mandalStays)
  const holder = holders(place, mandalStays)
  const canReport = (stay: MandalStay) =>
    reviewer || (scoped && session?.user.mandal === stay.mandal)
  // A sanchalak is sent only their own mandal's rooms, so the rest would
  // look free; show them only theirs.
  const rooms = sortRooms(
    scoped ? place.rooms.filter((r) => holder.has(r.id)) : place.rooms
  )

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
        description={`${place.address}${place.area && !place.address.includes(place.area) ? ` · ${place.area}` : ""} · ${summary.rooms} rooms · ${summary.beds} beds`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {reviewer && (
              <Button size="lg" onClick={() => setOpen({ kind: "give" })}>
                <RiAddLine />
                Give rooms
              </Button>
            )}
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
            {!scoped && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => downloadCsv(place, mandalStays)}
              >
                <RiDownload2Line />
                CSV
              </Button>
            )}
            {isAdmin(role) && (
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
            <span>
              <span className="mr-1.5 text-2xs text-muted-foreground">
                Place contact
              </span>
              <Contact
                name={place.coordinatorName}
                mobile={place.coordinatorMobile}
              />
            </span>
          ) : (
            <span className="text-muted-foreground">No place contact yet</span>
          )}
        </div>
        {place.notes && (
          <p className="text-2xs/relaxed text-muted-foreground">
            {place.notes}
          </p>
        )}
        {!scoped && (
          <p className="text-2xs/relaxed text-muted-foreground tabular-nums">
            {summary.given.rooms} of {summary.rooms} rooms given to{" "}
            {summary.stays.length}{" "}
            {summary.stays.length === 1 ? "mandal" : "mandals"} · {summary.free}{" "}
            free · {summary.given.occupied} occupied · {summary.given.people}{" "}
            {summary.given.people === 1 ? "person" : "people"} staying
          </p>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-medium">
          {scoped ? "Your mandal's rooms" : "Mandals here"}
        </h2>
        {summary.stays.length === 0 ? (
          <EmptyState
            title="No mandal has rooms here yet"
            description={
              reviewer
                ? "Give rooms to a mandal, with its coordinator to call."
                : "Mandals given rooms here show up with their coordinator."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {summary.stays.map((stay) => (
              <MandalStayCard
                key={stay.id}
                stay={stay}
                place={place}
                canEdit={reviewer}
                canReport={canReport(stay)}
                onEdit={() => setOpen({ kind: "edit", stay })}
                onReport={() => setOpen({ kind: "report", stay })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-medium">Rooms</h2>
        {rooms.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            description={
              scoped
                ? "Your mandal has no rooms here."
                : "An admin adds them from Edit place."
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 print:grid-cols-4">
            {rooms.map((room) => {
              const stay = holder.get(room.id)
              const people = stay ? peopleIn(stay, room.id) : undefined
              return (
                <li
                  key={room.id}
                  className={cn(
                    "flex break-inside-avoid flex-col gap-1 rounded-md border p-2",
                    stay
                      ? "border-border bg-card"
                      : "border-dashed border-border bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs/relaxed font-medium">
                      Room {room.label}
                    </span>
                    <RoomKindBadge kind={room.kind} />
                  </div>
                  <span className="text-3xs text-muted-foreground tabular-nums">
                    {floorLabel(room.floor)} · {room.beds}{" "}
                    {room.beds === 1 ? "bed" : "beds"}
                    {room.extraBeds ? ` + ${room.extraBeds}` : ""}
                  </span>
                  <span
                    className="truncate text-2xs/relaxed"
                    title={stay?.mandal}
                  >
                    {stay ? (
                      stay.mandal
                    ) : (
                      <span className="text-muted-foreground">Free</span>
                    )}
                  </span>
                  {stay && (
                    <span
                      className={cn(
                        "text-3xs tabular-nums",
                        people === undefined
                          ? "text-muted-foreground"
                          : people > 0
                            ? "font-medium text-primary"
                            : "text-muted-foreground"
                      )}
                    >
                      {people === undefined
                        ? "Not reported"
                        : people === 0
                          ? "Empty"
                          : `${people} ${people === 1 ? "person" : "people"}`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {open?.kind === "give" && (
        <MandalStayDialog
          places={places}
          stays={mandalStays}
          placeId={place.id}
          onEditExisting={(stay) => setOpen({ kind: "edit", stay })}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "edit" && (
        <MandalStayDialog
          places={places}
          stays={mandalStays}
          stay={open.stay}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "report" && (
        <OccupancyDialog
          stay={open.stay}
          place={place}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  )
}
