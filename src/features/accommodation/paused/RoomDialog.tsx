// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import {
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiWheelchairLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { DigitsInput, Field, Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"

import { asPlaceInput, useSavePlace } from "./api"
import { NightOccupancy, PersonPill, RoomKindBadge } from "./components"
import {
  NIGHTS,
  bedTakers,
  formatNight,
  formatNights,
  roomProblem,
  type AccommodationIndex,
} from "./rules"
import {
  FLOORS,
  ROOM_KINDS,
  floorLabel,
  type Place,
  type Room,
  type RoomKind,
} from "./types"

/**
 * One room, from its card on the place page: who is in it on which nights,
 * and — for an admin — its number, beds, type and floor, saved on their own
 * without opening the whole place editor. The server refuses a change the
 * people in it would no longer fit, and says who to move first.
 */
export function RoomDialog({
  place,
  room,
  index,
  editable,
  scoped = false,
  onClose,
}: {
  place: Place
  room: Room
  index: AccommodationIndex
  editable: boolean
  /** A sanchalak: only their own mandal's people are known, so no bed counts. */
  scoped?: boolean
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <RoomContent place={place} room={room} index={index} editable={editable} scoped={scoped} onClose={onClose} />
    </Dialog>
  )
}

function RoomContent({
  place,
  room,
  index,
  editable,
  scoped,
  onClose,
}: {
  place: Place
  room: Room
  index: AccommodationIndex
  editable: boolean
  scoped: boolean
  onClose: () => void
}) {
  const save = useSavePlace(place.id)
  const [label, setLabel] = React.useState(room.label)
  const [beds, setBeds] = React.useState(String(room.beds))
  const [extraBeds, setExtraBeds] = React.useState(String(room.extraBeds ?? 0))
  const [kind, setKind] = React.useState<RoomKind>(room.kind)
  const [floor, setFloor] = React.useState(room.floor)
  const [error, setError] = React.useState<string>()
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  const occupants = index.occupantsOf(place.id, room.id)
  // A night picked on the tiles: only who sleeps here that night.
  const [night, setNight] = React.useState<string>()
  const shown = night ? occupants.filter((o) => o.nights.includes(night)) : occupants
  const problem = roomProblem(room, occupants)
  const changed =
    label.trim() !== room.label ||
    Number(beds) !== room.beds ||
    Number(extraBeds || 0) !== (room.extraBeds ?? 0) ||
    kind !== room.kind ||
    floor !== room.floor

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const name = label.trim()
    const count = Number(beds)
    if (!name) return setError("Give the room a number or name")
    if (
      place.rooms.some(
        (r) => r.id !== room.id && r.label.toLowerCase() === name.toLowerCase()
      )
    ) {
      return setError(`There is already a Room ${name} here`)
    }
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return setError("Beds must be 1 to 50")
    }
    const extra = Number(extraBeds || 0)
    if (!Number.isInteger(extra) || extra > 20) {
      return setError("Extra mattresses must be 0 to 20")
    }
    setError(undefined)
    save.mutate(
      asPlaceInput(
        place,
        place.rooms.map((r) =>
          r.id === room.id
            ? { ...r, label: name, beds: count, extraBeds: extra, kind, floor }
            : r
        )
      ),
      { onSuccess: onClose }
    )
  }

  const removeRoom = () =>
    save.mutate(
      asPlaceInput(
        place,
        place.rooms.filter((r) => r.id !== room.id)
      ),
      { onSuccess: onClose }
    )

  return (
    <DialogContent className="max-w-lg">
      <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader
          title={
            <span className="flex flex-wrap items-center gap-1.5">
              Room {room.label}
              <RoomKindBadge kind={room.kind} />
              <Badge variant="outline">{floorLabel(room.floor)}</Badge>
            </span>
          }
          description={`${place.name} · ${room.beds} ${room.beds === 1 ? "bed" : "beds"}${room.extraBeds ? ` + ${room.extraBeds} extra` : ""}`}
        />
        <DialogBody>
          {editable && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_4.5rem_4.5rem_1fr]">
              <Field label="Room number or name">
                <Input
                  id="room-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </Field>
              <Field label="Beds">
                <DigitsInput
                  id="room-beds"
                  maxLength={2}
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                />
              </Field>
              <Field label="Extra">
                <DigitsInput
                  id="room-extra"
                  maxLength={2}
                  value={extraBeds}
                  onChange={(e) => setExtraBeds(e.target.value)}
                  aria-describedby="room-extra-hint"
                />
              </Field>
              <Field label="Type">
                <NativeSelect
                  id="room-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as RoomKind)}
                >
                  {Object.entries(ROOM_KINDS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Floor" className="col-span-2">
                <NativeSelect
                  id="room-floor"
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value))}
                >
                  {FLOORS.map((text, value) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <p id="room-extra-hint" className="col-span-2 self-end text-2xs/relaxed text-muted-foreground">
                Extra: mattresses used only when the beds run out. People who
                need assistance or are 60+ are offered the lowest floors first.
              </p>
            </div>
          )}

          <div className={cn("flex flex-col gap-1.5", scoped && "hidden")}>
            <NightOccupancy
              selected={night}
              onSelect={setNight}
              nights={NIGHTS.map((n) => ({
                night: n,
                beds: room.beds,
                used: bedTakers(occupants, n),
                extraBeds: room.extraBeds,
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs/relaxed font-medium">
              {scoped ? "Your people" : "People"}
              {night ? ` on ${formatNight(night)}` : ""} ({shown.length})
            </p>
            {night && shown.length === 0 ? (
              <p className="text-2xs/relaxed text-muted-foreground">
                Nobody sleeps here that night.
              </p>
            ) : occupants.length === 0 ? (
              <p className="text-2xs/relaxed text-muted-foreground">
                Nobody yet. Rooms are given from a registration's page or the
                Accommodation list.
              </p>
            ) : (
              <ul className="-mx-4 divide-y divide-border border-y border-border">
                {shown.map(({ registration: r, member: m }) => (
                  <li key={`${r.id}:${m.id}`} className="flex flex-col gap-0.5 px-4 py-2 text-2xs/relaxed">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs/relaxed font-medium">{m.fullName}</span>
                      <Link
                        to={`/registrations/${r.id}`}
                        className="text-primary tabular-nums hover:underline"
                      >
                        {r.code}
                      </Link>
                      <span className="text-muted-foreground">{r.mandal}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground tabular-nums">
                      <PersonPill gender={m.gender} age={m.age} />
                      {formatNights(m)}
                    </span>
                    {m.needsAssistance && (
                      <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <RiWheelchairLine className="size-3.5 shrink-0" />
                        {m.assistanceNote ?? "Needs assistance"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {problem && (
            <p className="flex items-start gap-1 text-2xs/relaxed text-destructive">
              <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
              {problem}
            </p>
          )}
          {(error || save.error) && (
            <p className="text-2xs/relaxed text-destructive">
              {error ?? save.error?.message}
            </p>
          )}
        </DialogBody>
        <DialogFooter className="flex-wrap">
          {editable &&
            (confirmRemove ? (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                disabled={save.isPending}
                onClick={removeRoom}
              >
                Remove Room {room.label}?
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto"
                disabled={occupants.length > 0 || save.isPending}
                title={occupants.length > 0 ? "Move its people to another room first" : undefined}
                onClick={() => setConfirmRemove(true)}
              >
                <RiDeleteBinLine />
                Remove room
              </Button>
            ))}
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {editable && (
            <Button type="submit" disabled={!changed || save.isPending}>
              {save.isPending && <RiLoader4Line className="animate-spin" />}
              Save room
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
