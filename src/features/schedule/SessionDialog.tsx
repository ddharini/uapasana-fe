import { RiAddLine, RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { ChoiceGroup } from "@/components/ui/choice"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Field, Input, Textarea } from "@/components/ui/input"

import {
  SESSION_KINDS,
  useCreateSession,
  useDeleteSession,
  useUpdateSession,
  type Session,
  type SessionInput,
} from "./api"
import { GOOGLE_MAPS_URL, kindStyle, normalizeKind } from "./format"

/** What the dialog opens on: an existing session, or a new one with times filled in. */
export type SessionTarget =
  | { mode: "edit"; dayId: string; dayLabel: string; session: Session }
  | {
      mode: "new"
      dayId: string
      dayLabel: string
      start: string
      end: string
      /** "Between Mahaprasad and Evening Sabha", for the header. */
      position: string
    }

/** The "Custom…" option under Type. Not a real kind: it reveals a field to name one. */
const CUSTOM = "__custom"

type Values = {
  title: string
  /** A built-in key, an existing custom type's name, or CUSTOM. */
  kind: string
  /** The name typed in when `kind` is CUSTOM. */
  customKind: string
  start: string
  end: string
  place: string
  mapUrl: string
  note: string
}

type Errors = Partial<Record<keyof Values, string>>

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Mirrors `sessionSchema` in upasana-be/src/lib/schedule.ts. Every problem at once. */
function validate(v: Values): Errors {
  const errors: Errors = {}
  if (!v.title.trim()) errors.title = "Enter a name"
  else if (v.title.trim().length > 80)
    errors.title = "Keep it under 80 characters"
  if (!TIME.test(v.start)) errors.start = "Enter a start time"
  if (!TIME.test(v.end)) errors.end = "Enter an end time"
  else if (TIME.test(v.start) && v.end <= v.start)
    errors.end = "End after it starts"
  if (v.kind === CUSTOM) {
    if (!v.customKind.trim()) errors.customKind = "Name the type"
    else if (v.customKind.trim().length > 30)
      errors.customKind = "Keep it under 30 characters"
  }
  if (!v.place.trim() && !v.mapUrl.trim())
    errors.place = "Enter a place or a map link"
  else if (v.place.trim().length > 60)
    errors.place = "Keep it under 60 characters"
  if (v.mapUrl.trim() && !GOOGLE_MAPS_URL.test(v.mapUrl.trim()))
    errors.mapUrl = "Paste a Google Maps link"
  if (v.note.trim().length > 300) errors.note = "Keep it under 300 characters"
  return errors
}

/** Built-in types, the custom ones already in the schedule, then "Custom…". */
function kindOptions(customKinds: string[]) {
  return [
    ...[...SESSION_KINDS, ...customKinds].map((kind) => ({
      value: kind,
      label: kindStyle(kind).label,
      icon: (
        <span
          className={`block size-2.5 rounded-full ${kindStyle(kind).dot}`}
        />
      ),
    })),
    { value: CUSTOM, label: "Custom…", icon: <RiAddLine /> },
  ]
}

const looksLikeUrl = (text: string) => /^https?:\/\//i.test(text.trim())

/**
 * Edit one session, or add one, in a popup.
 *
 * Nothing turns red while it is being filled in; after Save is pressed the
 * errors follow the fields live, so each one clears the moment it is fixed.
 */
export function SessionDialog({
  target,
  places,
  customKinds,
  onClose,
}: {
  target: SessionTarget | null
  /** Places already in the schedule, offered as suggestions. */
  places: string[]
  /** Custom types already in the schedule, offered next to the built-in ones. */
  customKinds: string[]
  onClose: () => void
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target && (
          <SessionForm
            target={target}
            places={places}
            customKinds={customKinds}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SessionForm({
  target,
  places,
  customKinds,
  onClose,
}: {
  target: SessionTarget
  places: string[]
  customKinds: string[]
  onClose: () => void
}) {
  const createSession = useCreateSession()
  const updateSession = useUpdateSession()
  const deleteSession = useDeleteSession()

  const [values, setValues] = React.useState<Values>(() =>
    target.mode === "edit"
      ? {
          ...target.session,
          customKind: "",
          place: target.session.place ?? "",
          mapUrl: target.session.mapUrl ?? "",
          note: target.session.note ?? "",
        }
      : {
          title: "",
          kind: "sabha",
          customKind: "",
          start: target.start,
          end: target.end,
          place: "",
          mapUrl: "",
          note: "",
        }
  )
  /** Set when a link pasted into Place was moved to the map link field. */
  const [movedLink, setMovedLink] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  const errors = submitted ? validate(values) : {}
  const pending =
    createSession.isPending ||
    updateSession.isPending ||
    deleteSession.isPending
  const serverError = (
    createSession.error ??
    updateSession.error ??
    deleteSession.error
  )?.message

  const set = <K extends keyof Values>(field: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [field]: value }))

  /** A typed type that already exists, in any case, reuses it rather than adding a near-twin. */
  const customKindFor = (text: string) => {
    const kind = normalizeKind(text)
    return (
      customKinds.find((k) => k.toLowerCase() === kind.toLowerCase()) ?? kind
    )
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validate(values)).length > 0) return

    const input: SessionInput = {
      title: values.title.trim(),
      kind:
        values.kind === CUSTOM ? customKindFor(values.customKind) : values.kind,
      start: values.start,
      end: values.end,
      place: values.place.trim() || undefined,
      mapUrl: values.mapUrl.trim() || undefined,
      note: values.note.trim() || undefined,
    }
    if (target.mode === "edit") {
      updateSession.mutate(
        { ...input, dayId: target.dayId, id: target.session.id },
        { onSuccess: onClose }
      )
    } else {
      createSession.mutate(
        { ...input, dayId: target.dayId },
        { onSuccess: onClose }
      )
    }
  }

  const remove = () => {
    if (target.mode !== "edit") return
    deleteSession.mutate(
      { dayId: target.dayId, id: target.session.id },
      { onSuccess: onClose }
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader
        title={target.mode === "edit" ? "Edit session" : "Add a session"}
        description={
          target.mode === "edit"
            ? target.dayLabel
            : `${target.dayLabel} · ${target.position}. It sits on the timeline by its start time.`
        }
      />
      <DialogBody>
        <Field label="Name" required error={errors.title}>
          <Input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Morning Sabha"
            maxLength={80}
            autoComplete="off"
            aria-invalid={!!errors.title}
            autoFocus={target.mode === "new"}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" required error={errors.start}>
            <Input
              type="time"
              value={values.start}
              onChange={(e) => set("start", e.target.value)}
              aria-invalid={!!errors.start}
            />
          </Field>
          <Field label="Ends" required error={errors.end}>
            <Input
              type="time"
              value={values.end}
              onChange={(e) => set("end", e.target.value)}
              aria-invalid={!!errors.end}
            />
          </Field>
        </div>

        <Field label="Type" required>
          <ChoiceGroup
            name="kind"
            value={values.kind}
            onChange={(kind) => set("kind", kind)}
            options={kindOptions(customKinds)}
            className="grid-cols-2"
          />
        </Field>

        {values.kind === CUSTOM && (
          <Field
            label="Custom type"
            required
            hint="It gets its own colour, and is offered for other sessions too."
            error={errors.customKind}
          >
            <Input
              value={values.customKind}
              onChange={(e) => set("customKind", e.target.value)}
              placeholder="e.g. Yoga Shibir"
              maxLength={30}
              autoComplete="off"
              aria-invalid={!!errors.customKind}
              autoFocus
            />
          </Field>
        )}

        <Field
          label="Place"
          required
          hint="A name, a Google Maps link, or both."
          error={errors.place}
        >
          <Input
            value={values.place}
            onChange={(e) => {
              // A link pasted here belongs in the map link field.
              if (looksLikeUrl(e.target.value)) {
                set("mapUrl", e.target.value.trim())
                setMovedLink(true)
                return
              }
              set("place", e.target.value)
            }}
            placeholder="e.g. Main Sabha Mandap"
            list="schedule-places"
            maxLength={60}
            autoComplete="off"
            aria-invalid={!!errors.place}
          />
          <datalist id="schedule-places">
            {places.map((place) => (
              <option key={place} value={place} />
            ))}
          </datalist>
        </Field>

        <Field label="Google Maps link" error={errors.mapUrl}>
          {movedLink && !errors.mapUrl && (
            <p className="text-2xs/relaxed text-primary">
              Moved the link you pasted here. Add a place name above if you
              like.
            </p>
          )}
          <Input
            type="url"
            inputMode="url"
            value={values.mapUrl}
            onChange={(e) => {
              set("mapUrl", e.target.value)
              setMovedLink(false)
            }}
            placeholder="https://maps.app.goo.gl/…"
            autoComplete="off"
            aria-invalid={!!errors.mapUrl}
          />
        </Field>

        <Field
          label="Note"
          hint="Optional. Shown under the session on the timeline."
          error={errors.note}
        >
          <Textarea
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="e.g. Natak by the Surat mandal"
            maxLength={300}
            aria-invalid={!!errors.note}
          />
        </Field>

        <p className="text-2xs text-muted-foreground">
          <span className="text-destructive">*</span> Required
        </p>

        {serverError && (
          <p className="text-2xs/relaxed text-destructive">{serverError}</p>
        )}
      </DialogBody>

      <DialogFooter className="justify-between">
        {confirmingDelete ? (
          <>
            <span className="text-xs/relaxed">Delete this session?</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={pending}
                onClick={remove}
              >
                {deleteSession.isPending && (
                  <RiLoader4Line className="animate-spin" />
                )}
                Delete
              </Button>
            </div>
          </>
        ) : (
          <>
            {target.mode === "edit" ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <RiDeleteBinLine />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="lg" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={pending}>
                {(createSession.isPending || updateSession.isPending) && (
                  <RiLoader4Line className="animate-spin" />
                )}
                {target.mode === "edit" ? "Save" : "Add session"}
              </Button>
            </div>
          </>
        )}
      </DialogFooter>
    </form>
  )
}
