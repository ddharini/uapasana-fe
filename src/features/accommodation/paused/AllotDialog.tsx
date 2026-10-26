// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import {
  RiErrorWarningLine,
  RiLoader4Line,
  RiWheelchairLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/choice"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/input"
import { Badge } from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import { displayName } from "@/features/registrations/format"
import { wantsBed } from "@/features/registrations/stay"
import type { Registration } from "@/features/registrations/types"

import { useAllot, useRelease } from "./api"
import { PersonPill, RoomKindBadge } from "./components"
import {
  NIGHTS,
  bedTakers,
  formatNight,
  formatNights,
  nightsOf,
  roomFit,
  sortRooms,
  stayFor,
  suggestPlaces,
  suggestPlan,
  takesBed,
  wantsGroundFloor,
  type AccommodationIndex,
} from "./rules"
import { ROOM_KINDS, floorLabel } from "./types"

/**
 * Giving a registration's people rooms: pick who, pick a place, and take or
 * change the suggested plan.
 *
 * Everyone still without a room starts ticked. Places where one room takes
 * them all come first, then where their mandal already stays. The plan puts
 * everyone in one room when a room fits them, and otherwise splits them over
 * as few rooms as it can, close together (see `suggestPlan`). Each person has
 * their own room picker to change it, rooms that would break a rule are
 * marked, and one Save allots everyone together. Stays open after saving
 * while anyone is still without a room.
 */
export function AllotDialog({
  registration,
  index,
  open,
  onOpenChange,
}: {
  registration: Registration
  index: AccommodationIndex
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AllotContent
          registration={registration}
          index={index}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function AllotContent({
  registration,
  index,
  onDone,
}: {
  registration: Registration
  index: AccommodationIndex
  onDone: () => void
}) {
  const allot = useAllot()
  const release = useRelease()
  const stay = stayFor(registration, index)

  const [picked, setPicked] = React.useState<Set<string>>(
    () => new Set(stay.missing.map((m) => m.id))
  )
  const members = registration.members.filter((m) => picked.has(m.id))
  const suggestions = suggestPlaces(
    registration,
    members.length ? members : stay.sleepers,
    index
  )
  const [placeId, setPlaceId] = React.useState(
    () => suggestions[0]?.place.id ?? ""
  )
  // Rooms changed by hand, over the suggested plan. Cleared whenever who or
  // where changes, so the plan is suggested afresh.
  const [overrides, setOverrides] = React.useState<Record<string, string>>({})

  const place = index.placeById.get(placeId)
  const moving = new Set(members.map((m) => m.id))
  const suggested = place
    ? suggestPlan(place, registration, members, index)
    : new Map<string, string>()
  const plan = new Map(
    members.map((m) => [m.id, overrides[m.id] ?? suggested.get(m.id) ?? ""])
  )
  const roomsInPlan = place
    ? sortRooms(place.rooms).flatMap((room) => {
        const people = members.filter((m) => plan.get(m.id) === room.id)
        if (people.length === 0) return []
        const fit = roomFit(place, room, registration, people, index, moving)
        // The busiest night once they are in: what makes the room fit or not.
        // Beds, so a child under 5 sharing a parent's does not count.
        const busiest = NIGHTS.map((night) => ({
          night,
          used:
            bedTakers(fit.others, night) +
            people.filter((m) => takesBed(m) && nightsOf(m).includes(night))
              .length,
        })).sort((a, b) => b.used - a.used)[0]
        return [
          {
            room,
            people,
            // Sharing with relatives is the team's call, not a blocker.
            problem: fit.canShare ? null : fit.problem,
            sharesWith: fit.sharesWith,
            extraUsed: fit.extraUsed,
            busiest,
          },
        ]
      })
    : []
  const unplaced = members.filter((m) => !plan.get(m.id))

  /**
   * Why a room cannot take this person, with whoever else the plan puts
   * there — a few words — or undefined when it can.
   */
  const whyNot = (personId: string, roomId: string) => {
    if (!place) return "not here"
    const room = place.rooms.find((r) => r.id === roomId)!
    const group = members.filter(
      (m) => m.id === personId || plan.get(m.id) === roomId
    )
    const fit = roomFit(place, room, registration, group, index, moving)
    return fit.canShare ? undefined : fit.reason
  }

  /** "shares with DM-F-0103", when a room fits only if they share with relatives. */
  const sharing = (personId: string, roomId: string) => {
    if (!place) return []
    const room = place.rooms.find((r) => r.id === roomId)!
    const group = members.filter(
      (m) => m.id === personId || plan.get(m.id) === roomId
    )
    return roomFit(place, room, registration, group, index, moving).sharesWith
  }

  const allottable =
    registration.accommodationRequired &&
    (registration.status === "confirmed" ||
      registration.status === "checked_in")
  const pickedWithRoom = members.filter((m) =>
    index.bedOf(registration.id, m.id)
  )
  const upstairs = roomsInPlan
    .filter((r) => r.room.floor > 0)
    .flatMap((r) => r.people.filter(wantsGroundFloor))
  const ready =
    allottable &&
    !!place &&
    members.length > 0 &&
    unplaced.length === 0 &&
    roomsInPlan.every((r) => !r.problem)
  const busy = allot.isPending || release.isPending
  const error = allot.error ?? release.error

  const toggle = (id: string, on: boolean) => {
    const next = new Set(picked)
    if (on) next.add(id)
    else next.delete(id)
    setPicked(next)
    setOverrides({})
  }

  const save = () => {
    if (!ready || !place) return
    allot.mutate(
      {
        registrationId: registration.id,
        // A room shared with relatives, picked by hand: the team's call.
        allowSharing: roomsInPlan.some((r) => r.sharesWith.length > 0),
        assignments: members.map((m) => ({
          memberId: m.id,
          placeId: place.id,
          roomId: plan.get(m.id)!,
        })),
      },
      {
        onSuccess: () => {
          const left = stay.missing.filter((m) => !picked.has(m.id))
          if (left.length === 0) return onDone()
          // Others still need a room: carry on with them.
          setPicked(new Set(left.map((m) => m.id)))
          setOverrides({})
        },
      }
    )
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        title={`Rooms for ${displayName(registration)}`}
        description={`${registration.code} · ${registration.mandal}`}
      />
      <DialogBody>
        {!allottable && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
            {!registration.accommodationRequired
              ? "They did not ask for accommodation. Tick it on the registration first."
              : "Confirm this registration before giving it rooms."}
          </p>
        )}

        <Field label="Place">
          <NativeSelect
            id="allot-place"
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value)
              setOverrides({})
            }}
          >
            {suggestions.map(
              ({ place: p, free, sameMandal, together, familyHere }) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Math.max(0, free)} beds free
                  {familyHere > 0
                    ? ` · ${familyHere} of their family here`
                    : ""}
                  {together && members.length > 1
                    ? ` · all ${members.length} in one room`
                    : ""}
                  {sameMandal > 0
                    ? ` · ${sameMandal} from ${registration.mandal}`
                    : ""}
                </option>
              )
            )}
          </NativeSelect>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs/relaxed font-medium">
            Who goes where
          </legend>
          {registration.members.map((m) => {
            const bed = index.bedOf(registration.id, m.id)
            const asked = wantsBed(registration, m)
            const sleeps = asked && nightsOf(m).length > 0
            const chosen = plan.get(m.id) ?? ""
            const rooms = place
              ? sortRooms(place.rooms).sort((a, b) =>
                  // Lowest floors first for anyone who needs them.
                  wantsGroundFloor(m) ? a.floor - b.floor : 0
                )
              : []
            return (
              <div
                key={m.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <Checkbox
                  id={`allot-${m.id}`}
                  checked={picked.has(m.id)}
                  disabled={!sleeps}
                  onChange={(e) => toggle(m.id, e.target.checked)}
                  label={
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {m.fullName}
                      {m.needsAssistance && (
                        <RiWheelchairLine
                          className="size-3.5 text-amber-700 dark:text-amber-400"
                          aria-label="Needs assistance"
                        />
                      )}
                    </span>
                  }
                  description={
                    <>
                      <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
                        <PersonPill gender={m.gender} age={m.age} />
                        {formatNights(m)}
                      </span>
                      {!asked
                        ? "Did not ask for accommodation"
                        : !sleeps
                          ? "Leaves the day they arrive — no bed needed"
                          : bed
                            ? `Now in ${bed.place.name} · Room ${bed.room.label}`
                            : "No room yet"}
                    </>
                  }
                />
                {picked.has(m.id) && place && (
                  <NativeSelect
                    aria-label={`Room for ${m.fullName}`}
                    value={chosen}
                    aria-invalid={!chosen || undefined}
                    onChange={(e) =>
                      setOverrides({ ...overrides, [m.id]: e.target.value })
                    }
                    className="shrink-0 sm:w-48"
                  >
                    <option value="" disabled>
                      Pick a room
                    </option>
                    {rooms.map((room) => {
                      const reason = whyNot(m.id, room.id)
                      const shares = reason ? [] : sharing(m.id, room.id)
                      return (
                        <option
                          key={room.id}
                          value={room.id}
                          disabled={!!reason && room.id !== chosen}
                        >
                          Room {room.label} · {ROOM_KINDS[room.kind]} ·{" "}
                          {room.beds} {room.beds === 1 ? "bed" : "beds"}
                          {room.extraBeds ? ` + ${room.extraBeds} extra` : ""}
                          {` · ${floorLabel(room.floor).replace(" floor", "")}`}
                          {reason
                            ? ` — ${reason}`
                            : shares.length > 0
                              ? ` — shares with ${shares.join(", ")}`
                              : ""}
                        </option>
                      )
                    })}
                  </NativeSelect>
                )}
              </div>
            )
          })}
        </fieldset>

        {place && members.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs/relaxed font-medium">
                {roomsInPlan.length === 1
                  ? "Plan: one room"
                  : `Plan: ${roomsInPlan.length} rooms`}
              </p>
              {Object.keys(overrides).length > 0 && (
                <button
                  type="button"
                  onClick={() => setOverrides({})}
                  className="text-2xs text-primary hover:underline"
                >
                  Back to the suggestion
                </button>
              )}
            </div>
            {roomsInPlan.map(
              ({ room, people, problem, busiest, sharesWith, extraUsed }) => (
                <div
                  key={room.id}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md border border-border p-2.5",
                    problem && "border-destructive/40"
                  )}
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-xs/relaxed font-medium">
                    Room {room.label}
                    <RoomKindBadge kind={room.kind} />
                    <Badge variant="outline">{floorLabel(room.floor)}</Badge>
                  </span>
                  <span className="text-2xs/relaxed">
                    {people.map((p) => p.fullName.split(" ")[0]).join(", ")}
                  </span>
                  <span
                    className={cn(
                      "text-2xs/relaxed text-muted-foreground tabular-nums",
                      problem && "text-destructive"
                    )}
                  >
                    {problem ??
                      (extraUsed > 0
                        ? `${room.beds} ${room.beds === 1 ? "bed" : "beds"} + ${extraUsed} extra ${extraUsed === 1 ? "mattress" : "mattresses"} on ${formatNight(busiest.night)}`
                        : `${busiest.used} of ${room.beds} ${room.beds === 1 ? "bed" : "beds"} on the busiest night, ${formatNight(busiest.night)}`)}
                  </span>
                  {!problem && sharesWith.length > 0 && (
                    <span className="flex items-start gap-1 text-2xs/relaxed text-amber-700 dark:text-amber-400">
                      <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
                      Shares with {sharesWith.join(", ")} — only if they are
                      family. Check before saving.
                    </span>
                  )}
                </div>
              )
            )}
            {unplaced.length > 0 && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
                No room left here for{" "}
                {unplaced.map((m) => m.fullName.split(" ")[0]).join(", ")}. Pick
                a room for them above, try another place, or untick them for
                now.
              </p>
            )}
          </div>
        )}

        {upstairs.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
            <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
            {upstairs
              .map((m) => {
                const room = place?.rooms.find((r) => r.id === plan.get(m.id))
                return `${m.fullName.split(" ")[0]} (Room ${room?.label}, ${floorLabel(room?.floor ?? 0).toLowerCase()})`
              })
              .join(", ")}{" "}
            {upstairs.length === 1 ? "needs" : "need"} the ground floor
            (assistance or 60+).
          </p>
        )}
        {error && (
          <p className="text-2xs/relaxed text-destructive">{error.message}</p>
        )}
      </DialogBody>
      <DialogFooter className="flex-wrap">
        {pickedWithRoom.length > 0 && (
          <Button
            variant="destructive"
            className="mr-auto"
            disabled={busy}
            onClick={() =>
              release.mutate(
                {
                  registrationId: registration.id,
                  memberIds: pickedWithRoom.map((m) => m.id),
                },
                {
                  onSuccess: () => {
                    setPicked(new Set())
                    setOverrides({})
                  },
                }
              )
            }
          >
            Take{" "}
            {pickedWithRoom.length === 1
              ? pickedWithRoom[0].fullName.split(" ")[0]
              : `${pickedWithRoom.length}`}{" "}
            out
          </Button>
        )}
        <Button variant="ghost" onClick={onDone}>
          Close
        </Button>
        <Button disabled={!ready || busy} onClick={save}>
          {allot.isPending && <RiLoader4Line className="animate-spin" />}
          {members.length === 0
            ? "Pick who"
            : roomsInPlan.length === 1 && unplaced.length === 0
              ? `Put ${members.length === 1 ? members[0].fullName.split(" ")[0] : members.length} in Room ${roomsInPlan[0].room.label}`
              : `Allot ${members.length} in ${roomsInPlan.length} rooms`}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
