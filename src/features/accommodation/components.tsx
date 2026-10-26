import {
  RiEditLine,
  RiGroupLine,
  RiPhoneLine,
  RiWhatsappLine,
} from "@remixicon/react"
import { cn } from "cn"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Badge, Progress } from "@/components/ui/primitives"
import { formatCreatedAt } from "@/features/registrations/format"
import { formatMobile } from "@/lib/phone"

import { occupancyOf, roomList } from "./mandal-stays"
import { ROOM_KINDS, type MandalStay, type Place, type RoomKind } from "./types"

export function RoomKindBadge({ kind }: { kind: RoomKind }) {
  return (
    <Badge variant={kind === "family" ? "secondary" : "outline"}>
      {ROOM_KINDS[kind]}
    </Badge>
  )
}

/** "Name · 98765 43210" with call and WhatsApp links. */
export function Contact({
  name,
  mobile,
  className,
}: {
  name?: string
  mobile?: string
  className?: string
}) {
  if (!name && !mobile) return null
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1",
        className
      )}
    >
      <span className="font-medium">{name ?? "Contact"}</span>
      {mobile && (
        <>
          <a
            href={`tel:${mobile}`}
            className="inline-flex items-center gap-1 text-primary tabular-nums hover:underline"
          >
            <RiPhoneLine className="size-3.5" />
            {formatMobile(mobile)}
          </a>
          <a
            href={`https://wa.me/${mobile.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp ${name ?? formatMobile(mobile)}`}
            className="inline-flex items-center text-primary hover:opacity-80"
          >
            <RiWhatsappLine className="size-3.5" />
          </a>
        </>
      )}
    </span>
  )
}

/**
 * One mandal's rooms at one place: who to call, which rooms, and how full the
 * coordinator says they are.
 */
export function MandalStayCard({
  stay,
  place,
  heading = "mandal",
  canEdit,
  canReport,
  onEdit,
  onReport,
}: {
  stay: MandalStay
  place?: Place
  /** What the card is titled with: the mandal (on a place's page) or the place (under a mandal). */
  heading?: "mandal" | "place"
  canEdit: boolean
  canReport: boolean
  onEdit: () => void
  onReport: () => void
}) {
  const totals = occupancyOf(stay, place)
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {heading === "mandal" ? (
            <span className="font-heading text-sm font-medium">
              {stay.mandal}
            </span>
          ) : place ? (
            <Link
              to={`/accommodation/places/${place.id}`}
              className="font-heading text-sm font-medium hover:underline"
            >
              {place.name}
            </Link>
          ) : (
            <span className="font-heading text-sm font-medium text-muted-foreground">
              Place removed
            </span>
          )}
          <span className="text-2xs/relaxed text-muted-foreground tabular-nums">
            {place
              ? roomList(place, stay.roomIds)
              : `${stay.roomIds.length} rooms`}{" "}
            · {totals.beds} beds
          </span>
        </div>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <RiEditLine />
            Edit
          </Button>
        )}
      </div>

      <div className="text-xs/relaxed">
        <span className="mr-1.5 text-2xs text-muted-foreground">
          Coordinator
        </span>
        <Contact name={stay.coordinatorName} mobile={stay.coordinatorMobile} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap justify-between gap-x-3 text-2xs text-muted-foreground tabular-nums">
          <span>
            <span className="font-medium text-foreground">
              {totals.occupied} of {totals.rooms}
            </span>{" "}
            rooms occupied · {totals.people}{" "}
            {totals.people === 1 ? "person" : "people"}
          </span>
          {totals.reported < totals.rooms && (
            <span className="text-amber-700 dark:text-amber-400">
              {totals.reported === 0
                ? "Not reported yet"
                : `${totals.rooms - totals.reported} not reported`}
            </span>
          )}
        </div>
        <Progress value={totals.occupied} max={Math.max(totals.rooms, 1)} />
        {stay.occupancyUpdatedAt && (
          <span className="text-3xs text-muted-foreground">
            Updated {formatCreatedAt(stay.occupancyUpdatedAt)}
            {stay.occupancyUpdatedByName &&
              ` by ${stay.occupancyUpdatedByName}`}
          </span>
        )}
      </div>

      {stay.notes && (
        <p className="text-2xs/relaxed text-muted-foreground">{stay.notes}</p>
      )}

      {canReport && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReport}
          className="self-start"
        >
          <RiGroupLine />
          Update occupancy
        </Button>
      )}
    </div>
  )
}
