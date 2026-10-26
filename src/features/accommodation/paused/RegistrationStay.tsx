// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import { RiErrorWarningLine, RiHotelBedLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import type { Registration } from "@/features/registrations/types"

import { AllotDialog } from "./AllotDialog"
import { NoticeLine, SendRoomDetails, StayStatusBadge } from "./components"
import { stayFor, type AccommodationIndex } from "./rules"

/**
 * Accommodation on a registration's page: where everyone sleeps, anything to
 * sort out, whether they were told — and, for the seva team, the buttons to
 * allot rooms and send the details.
 */
export function RegistrationStay({
  registration,
  index,
  reviewer,
}: {
  registration: Registration
  index: AccommodationIndex
  reviewer: boolean
}) {
  const [allotting, setAllotting] = React.useState(false)
  const stay = stayFor(registration, index)
  const notice = index.notices.get(registration.id)
  const allottable =
    registration.accommodationRequired &&
    (registration.status === "confirmed" || registration.status === "checked_in")

  const rooms = new Map<string, { place: string; placeId: string; room: string; people: string[] }>()
  for (const a of stay.allotted) {
    const key = `${a.place.id}:${a.room.id}`
    const entry = rooms.get(key) ?? { place: a.place.name, placeId: a.place.id, room: a.room.label, people: [] }
    entry.people.push(a.member.fullName.split(" ")[0])
    rooms.set(key, entry)
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <StayStatusBadge stay={stay} />
      </div>
      {rooms.size > 0 && (
        <ul className="flex flex-col gap-0.5">
          {[...rooms.values()].map((r) => (
            <li key={`${r.placeId}:${r.room}`}>
              <Link to={`/accommodation/places/${r.placeId}`} className="hover:underline">
                {r.place} · Room {r.room}
              </Link>
              <span className="text-muted-foreground"> — {r.people.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      {[...stay.problems, ...stay.warnings].map((text) => (
        <span
          key={text}
          className={cn(
            "flex items-start gap-1 text-2xs/relaxed",
            stay.problems.includes(text) ? "text-destructive" : "text-amber-700 dark:text-amber-400"
          )}
        >
          <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
          {text}
        </span>
      ))}
      {stay.allotted.length > 0 && (
        <span className="text-2xs/relaxed">
          <NoticeLine notice={notice} />
        </span>
      )}
      {reviewer && (allottable || stay.allotted.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setAllotting(true)}>
            <RiHotelBedLine />
            {stay.allotted.length > 0 ? "Change rooms" : "Allot rooms"}
          </Button>
          {stay.status === "allotted" && stay.problems.length === 0 && (
            <SendRoomDetails registration={registration} notice={notice} size="sm" />
          )}
        </div>
      )}
      <AllotDialog
        registration={registration}
        index={index}
        open={allotting}
        onOpenChange={setAllotting}
      />
    </div>
  )
}
