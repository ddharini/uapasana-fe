import { RiLoader4Line } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { DigitsInput } from "@/components/ui/input"

import { useSaveOccupancy } from "./api"
import { capacityOf, peopleIn, sortRooms } from "./mandal-stays"
import { ROOM_KINDS, floorLabel, type MandalStay, type Place } from "./types"

/** Mirrors MAX_PEOPLE_IN_ROOM in upasana-be src/lib/mandal-stays.ts. */
const MAX_PEOPLE_IN_ROOM = 50

/**
 * The coordinator's report: how many people are in each of the mandal's
 * rooms right now. A blank room is "not reported"; 0 means empty. More than
 * the room's beds and mattresses is allowed — they know their rooms — but
 * flagged.
 */
export function OccupancyDialog({
  stay,
  place,
  onClose,
}: {
  stay: MandalStay
  place: Place
  onClose: () => void
}) {
  const save = useSaveOccupancy(stay.id)
  const rooms = sortRooms(
    place.rooms.filter((r) => stay.roomIds.includes(r.id))
  )
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      rooms.map((r) => [r.id, String(peopleIn(stay, r.id) ?? "")])
    )
  )
  // Nothing is red until Save is pressed; after that errors follow every change.
  const [submitted, setSubmitted] = React.useState(false)

  const errorFor = (roomId: string) => {
    const value = values[roomId] ?? ""
    if (value === "") {
      // Once reported, a room can't go back to "not reported" — only to 0.
      return peopleIn(stay, roomId) !== undefined
        ? "Enter 0 if it's empty"
        : undefined
    }
    return Number(value) > MAX_PEOPLE_IN_ROOM
      ? `At most ${MAX_PEOPLE_IN_ROOM}`
      : undefined
  }
  const errors = submitted
    ? Object.fromEntries(
        rooms.flatMap((r) => (errorFor(r.id) ? [[r.id, errorFor(r.id)!]] : []))
      )
    : {}

  const filled = rooms.filter((r) => values[r.id] !== "")
  const people = filled.reduce((sum, r) => sum + Number(values[r.id]), 0)
  const occupied = filled.filter((r) => Number(values[r.id]) > 0).length

  /** Every room not filled in yet: 0. */
  const restEmpty = () =>
    setValues((current) =>
      Object.fromEntries(
        rooms.map((r) => [r.id, current[r.id] === "" ? "0" : current[r.id]])
      )
    )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (rooms.some((r) => errorFor(r.id))) return
    save.mutate(
      filled.map((r) => ({ roomId: r.id, people: Number(values[r.id]) })),
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader
            title={`${stay.mandal} · ${place.name}`}
            description="How many people are in each room now. Leave a room blank if you don't know yet; 0 if it's empty."
          />
          <DialogBody className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-muted-foreground tabular-nums">
              <span>
                <span className="font-medium text-foreground">
                  {occupied} of {rooms.length}
                </span>{" "}
                rooms occupied · {people} {people === 1 ? "person" : "people"}
              </span>
              {filled.length < rooms.length && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={restEmpty}
                >
                  Mark the rest empty
                </Button>
              )}
            </div>
            <ul className="-mx-4 flex flex-col divide-y divide-border border-y border-border">
              {rooms.map((room) => {
                const value = values[room.id] ?? ""
                const over = value !== "" && Number(value) > capacityOf(room)
                const error = errors[room.id]
                return (
                  <li key={room.id} className="flex flex-col gap-1 px-4 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={`occupancy-${room.id}`}
                        className="flex min-w-0 flex-col"
                      >
                        <span className="text-xs/relaxed font-medium">
                          Room {room.label}
                        </span>
                        <span className="truncate text-2xs text-muted-foreground">
                          {ROOM_KINDS[room.kind]} · {floorLabel(room.floor)} ·{" "}
                          {room.beds} {room.beds === 1 ? "bed" : "beds"}
                          {room.extraBeds ? ` + ${room.extraBeds} extra` : ""}
                        </span>
                      </label>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <DigitsInput
                          id={`occupancy-${room.id}`}
                          maxLength={2}
                          value={value}
                          placeholder="–"
                          aria-invalid={!!error}
                          onChange={(e) =>
                            setValues((current) => ({
                              ...current,
                              [room.id]: e.target.value,
                            }))
                          }
                          className="w-16 text-center sm:w-12"
                        />
                        <span className="w-12 text-2xs text-muted-foreground">
                          people
                        </span>
                      </div>
                    </div>
                    {(error || over) && (
                      <p
                        className={cn(
                          "text-2xs/relaxed",
                          error
                            ? "text-destructive"
                            : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {error ??
                          `More people than its ${capacityOf(room)} beds and mattresses`}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
            {save.isError && (
              <p className="text-2xs/relaxed text-destructive">
                {save.error.message}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <RiLoader4Line className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
