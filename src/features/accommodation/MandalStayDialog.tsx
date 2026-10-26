import { RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
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
import {
  DigitsInput,
  Field,
  Input,
  RequiredMark,
  Textarea,
} from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { NativeSelect } from "@/components/ui/select"
import { MandalSelect } from "@/components/MandalSelect"
import {
  DEFAULT_COUNTRY_CODE,
  fromE164,
  mobileError,
  toE164,
} from "@/lib/phone"

import { useDeleteMandalStay, useSaveMandalStay } from "./api"
import { holders, sortRooms } from "./mandal-stays"
import { ROOM_KINDS, floorLabel, type MandalStay, type Place } from "./types"

/**
 * Gives a mandal rooms at a place, or changes them: the mandal, its
 * coordinator for these rooms, and which rooms. A room another mandal has
 * cannot be picked. Opened from a place or a mandal, that one starts
 * selected — still changeable. A saved entry's place can't change.
 */
export function MandalStayDialog({
  places,
  stays,
  stay,
  placeId: initialPlaceId,
  mandal: initialMandal,
  onEditExisting,
  onClose,
}: {
  places: Place[]
  /** Every mandal's rooms, to know which are taken. */
  stays: MandalStay[]
  /** Editing these; absent to give new rooms. */
  stay?: MandalStay
  /** Selected to start with. */
  placeId?: string
  /** Selected to start with. */
  mandal?: string
  /** Switches to the entry a mandal already has at the picked place. */
  onEditExisting?: (stay: MandalStay) => void
  onClose: () => void
}) {
  const save = useSaveMandalStay(stay?.id)
  const remove = useDeleteMandalStay()
  // Usually the same coordinator at every place: a mandal picked up front
  // starts from the one it has elsewhere.
  const coordinatorFrom =
    stay ??
    (initialMandal ? stays.find((s) => s.mandal === initialMandal) : undefined)
  const phone = coordinatorFrom
    ? fromE164(coordinatorFrom.coordinatorMobile)
    : undefined

  const [placeId, setPlaceId] = React.useState(
    stay?.placeId ?? initialPlaceId ?? ""
  )
  const [mandal, setMandal] = React.useState(
    stay?.mandal ?? initialMandal ?? ""
  )
  const [coordinatorName, setCoordinatorName] = React.useState(
    coordinatorFrom?.coordinatorName ?? ""
  )
  const [country, setCountry] = React.useState<string>(
    phone?.code ?? DEFAULT_COUNTRY_CODE
  )
  const [mobile, setMobile] = React.useState(phone?.national ?? "")
  const [notes, setNotes] = React.useState(stay?.notes ?? "")
  const [roomIds, setRoomIds] = React.useState<Set<string>>(
    () => new Set(stay?.roomIds)
  )
  const [quickCount, setQuickCount] = React.useState("")
  // Nothing is red until Save is pressed; after that errors follow every change.
  const [submitted, setSubmitted] = React.useState(false)
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  const confirmRef = React.useRef<HTMLDivElement>(null)

  // The confirmation sits at the bottom of a long, scrolling form: bring it
  // into view, and focus its button so Enter confirms.
  React.useEffect(() => {
    if (!confirmRemove) return
    confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    confirmRef.current?.querySelector("button")?.focus({ preventScroll: true })
  }, [confirmRemove])

  const place = places.find((p) => p.id === placeId)
  const taken = React.useMemo(() => {
    if (!place) return new Map<string, MandalStay>()
    const map = holders(place, stays)
    for (const [roomId, holder] of map)
      if (holder.id === stay?.id) map.delete(roomId)
    return map
  }, [place, stays, stay?.id])
  const rooms = place ? sortRooms(place.rooms) : []
  const free = rooms.filter((r) => !taken.has(r.id))
  const picked = rooms.filter((r) => roomIds.has(r.id))
  const pickedBeds = picked.reduce((sum, r) => sum + r.beds, 0)
  const mandalsHere = new Set(
    stays
      .filter((s) => s.placeId === placeId && s.id !== stay?.id)
      .map((s) => s.mandal)
  )

  /** The picked mandal's rooms already at the picked place — edit those instead. */
  const existingHere = stay
    ? undefined
    : stays.find((s) => s.placeId === placeId && s.mandal === mandal)

  const errors: Record<string, string> = {}
  if (submitted) {
    if (!placeId) errors.place = "Pick a place"
    if (!mandal) errors.mandal = "Pick a mandal"
    else if (mandalsHere.has(mandal))
      errors.mandal = `${mandal} already has rooms here — edit those instead`
    if (coordinatorName.trim().length < 2)
      errors.coordinatorName = "Enter the coordinator's name"
    if (!mobile) errors.mobile = "Enter the coordinator's mobile"
    else {
      const problem = mobileError(mobile, country)
      if (problem) errors.mobile = problem
    }
    if (placeId && picked.length === 0) errors.rooms = "Pick at least one room"
  }

  const toggle = (id: string) =>
    setRoomIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  /** Adds the first N free rooms not already picked, in number order. */
  const pickFirst = () => {
    const count = Number(quickCount) || 0
    if (count < 1) return
    setRoomIds((current) => {
      const next = new Set(current)
      for (const room of free) {
        if (next.size >= current.size + count) break
        next.add(room.id)
      }
      return next
    })
  }

  const pickMandal = (value: string) => {
    setMandal(value)
    // Usually the same coordinator at every place: start from theirs.
    const elsewhere = stays.find((s) => s.mandal === value && s.id !== stay?.id)
    const theirs = elsewhere && fromE164(elsewhere.coordinatorMobile)
    if (elsewhere && theirs && !coordinatorName && !mobile) {
      setCoordinatorName(elsewhere.coordinatorName)
      setCountry(theirs.code)
      setMobile(theirs.national)
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    const problems =
      !placeId ||
      !mandal ||
      mandalsHere.has(mandal) ||
      coordinatorName.trim().length < 2 ||
      !mobile ||
      mobileError(mobile, country) ||
      picked.length === 0
    if (problems) return
    save.mutate(
      {
        placeId,
        mandal,
        coordinatorName: coordinatorName.trim(),
        coordinatorMobile: toE164(country, mobile),
        notes: notes.trim() || undefined,
        roomIds: picked.map((r) => r.id),
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form
          noValidate
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader
            title={stay ? `${stay.mandal}'s rooms` : "Give rooms to a mandal"}
            description="The mandal's coordinator decides who sleeps in which room, and reports how many people are in each."
          />
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Place"
                required
                hint={stay ? "Rooms can't move to another place." : undefined}
                error={errors.place}
                className="sm:col-span-2"
              >
                <NativeSelect
                  id="stay-place"
                  value={placeId}
                  disabled={!!stay}
                  aria-invalid={!!errors.place}
                  onChange={(e) => {
                    setPlaceId(e.target.value)
                    setRoomIds(new Set())
                  }}
                >
                  <option value="">Pick a place</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {!stay &&
                      mandal &&
                      stays.some(
                        (s) => s.placeId === p.id && s.mandal === mandal
                      )
                        ? ` (${mandal} has rooms here)`
                        : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label="Coordinator's mandal"
                required
                error={errors.mandal}
                className="sm:col-span-2"
              >
                <MandalSelect
                  id="stay-mandal"
                  value={mandal}
                  onChange={pickMandal}
                  placeholder="Pick a mandal"
                  // The chosen one stays enabled, so it doesn't look blank.
                  isDisabled={(m) => mandalsHere.has(m) && m !== mandal}
                  note={(m) => (mandalsHere.has(m) ? " (has rooms here)" : "")}
                  invalid={!!errors.mandal}
                />
                {existingHere && !submitted && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
                    <span>
                      {mandal} already has rooms at {place?.name}.
                    </span>
                    {onEditExisting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onEditExisting(existingHere)}
                      >
                        Edit their rooms
                      </Button>
                    )}
                  </div>
                )}
                {existingHere && submitted && onEditExisting && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => onEditExisting(existingHere)}
                  >
                    Edit their rooms
                  </Button>
                )}
              </Field>
              <Field
                label="Coordinator"
                required
                error={errors.coordinatorName}
              >
                <Input
                  id="stay-coordinator"
                  value={coordinatorName}
                  aria-invalid={!!errors.coordinatorName}
                  onChange={(e) => setCoordinatorName(e.target.value)}
                />
              </Field>
              <Field
                label="Coordinator's mobile"
                required
                error={errors.mobile}
              >
                <PhoneInput
                  id="stay-coordinator-mobile"
                  countryCode={country}
                  placeholder="9876543210"
                  invalid={!!errors.mobile}
                  codeProps={{
                    value: country,
                    onChange: (e) => setCountry(e.target.value),
                  }}
                  numberProps={{
                    value: mobile,
                    onChange: (e) => setMobile(e.target.value),
                  }}
                />
              </Field>
            </div>

            {place && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs/relaxed font-medium">
                    Rooms
                    <RequiredMark />
                  </span>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {picked.length} picked · {pickedBeds} beds · {free.length}{" "}
                    of {rooms.length} free
                  </span>
                </div>
                {rooms.length === 0 ? (
                  <p className="text-2xs/relaxed text-muted-foreground">
                    {place.name} has no rooms yet. An admin adds them from Edit
                    place.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xs text-muted-foreground">
                        Pick the first
                      </span>
                      <DigitsInput
                        aria-label="How many free rooms to pick"
                        maxLength={3}
                        value={quickCount}
                        onChange={(e) => setQuickCount(e.target.value)}
                        className="w-16 sm:w-12"
                      />
                      <span className="text-2xs text-muted-foreground">
                        free rooms
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!Number(quickCount)}
                        onClick={pickFirst}
                      >
                        Pick
                      </Button>
                      {roomIds.size > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRoomIds(new Set())}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                      {rooms.map((room) => {
                        const holder = taken.get(room.id)
                        const on = roomIds.has(room.id)
                        return (
                          <li key={room.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              disabled={!!holder}
                              title={
                                holder ? `Given to ${holder.mandal}` : undefined
                              }
                              onClick={() => toggle(room.id)}
                              className={cn(
                                "flex w-full flex-col rounded-md border px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                holder
                                  ? // Taken by another mandal: tinted, so it never reads as free.
                                    "cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                                  : on
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/40"
                              )}
                            >
                              <span className="flex items-baseline justify-between gap-1">
                                <span className="text-xs/relaxed font-medium">
                                  {room.label}
                                </span>
                                <span
                                  className={cn(
                                    "text-3xs",
                                    holder
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {holder
                                    ? "Taken"
                                    : room.floor === 0
                                      ? "Ground"
                                      : floorLabel(room.floor).replace(
                                          " floor",
                                          ""
                                        )}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "truncate text-3xs",
                                  !holder && "text-muted-foreground"
                                )}
                              >
                                {holder
                                  ? holder.mandal
                                  : `${room.beds} ${room.beds === 1 ? "bed" : "beds"} · ${ROOM_KINDS[room.kind]}`}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
                {errors.rooms && (
                  <p className="text-2xs/relaxed text-destructive">
                    {errors.rooms}
                  </p>
                )}
              </div>
            )}

            <Field label="Notes">
              <Textarea
                id="stay-notes"
                value={notes}
                placeholder="Keys with the guest house office, check-in after 2 pm…"
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {save.isError && (
              <p className="text-2xs/relaxed text-destructive">
                {save.error.message}
              </p>
            )}
            {confirmRemove && (
              <div
                ref={confirmRef}
                className="flex flex-col gap-2 rounded-md bg-destructive/10 p-3"
              >
                <p className="text-xs/relaxed">
                  Take back all {stay?.roomIds.length} rooms from {stay?.mandal}
                  ? Their occupancy goes with them.
                </p>
                {remove.isError && (
                  <p className="text-2xs/relaxed text-destructive">
                    {remove.error.message}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() =>
                      stay && remove.mutate(stay.id, { onSuccess: onClose })
                    }
                  >
                    Take back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(false)}
                  >
                    Keep them
                  </Button>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {stay && !confirmRemove && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                <RiDeleteBinLine />
                Take back
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <RiLoader4Line className="animate-spin" />}
              {stay ? "Save" : "Give rooms"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
