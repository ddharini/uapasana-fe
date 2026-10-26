import { RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"

import {
  useCreateDay,
  useDeleteDay,
  useUpdateDay,
  type ScheduleDay,
} from "./api"
import { formatShortDate } from "./format"

export type DayTarget =
  { mode: "edit"; day: ScheduleDay } | { mode: "new"; date: string }

type Values = { date: string; theme: string }
type Errors = Partial<Record<keyof Values, string>>

/**
 * Add a day to the programme, or change a day's date or theme.
 *
 * `onSaved` gets the saved date, so the screen can switch to it — a day whose
 * date just changed would otherwise vanish from under the person editing it.
 */
export function DayDialog({
  target,
  takenDates,
  onSaved,
  onClose,
}: {
  target: DayTarget | null
  /** Every date already in the schedule. */
  takenDates: string[]
  onSaved: (date: string) => void
  onClose: () => void
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        {target && (
          <DayForm
            target={target}
            takenDates={takenDates}
            onSaved={onSaved}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DayForm({
  target,
  takenDates,
  onSaved,
  onClose,
}: {
  target: DayTarget
  takenDates: string[]
  onSaved: (date: string) => void
  onClose: () => void
}) {
  const createDay = useCreateDay()
  const updateDay = useUpdateDay()
  const deleteDay = useDeleteDay()

  const [values, setValues] = React.useState<Values>(() =>
    target.mode === "edit"
      ? { date: target.day.date, theme: target.day.theme ?? "" }
      : { date: target.date, theme: "" }
  )
  const [submitted, setSubmitted] = React.useState(false)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  const ownDate = target.mode === "edit" ? target.day.date : null
  const validate = (v: Values): Errors => {
    const errors: Errors = {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) errors.date = "Pick a date"
    else if (v.date !== ownDate && takenDates.includes(v.date))
      errors.date = `${formatShortDate(v.date)} is already in the schedule`
    if (v.theme.trim().length > 60) errors.theme = "Keep it under 60 characters"
    return errors
  }

  const errors = submitted ? validate(values) : {}
  const pending =
    createDay.isPending || updateDay.isPending || deleteDay.isPending
  const serverError = (createDay.error ?? updateDay.error ?? deleteDay.error)
    ?.message
  const sessionCount = target.mode === "edit" ? target.day.sessions.length : 0

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validate(values)).length > 0) return

    const input = { date: values.date, theme: values.theme.trim() || undefined }
    const onSuccess = () => {
      onSaved(input.date)
      onClose()
    }
    if (target.mode === "edit")
      updateDay.mutate({ ...input, id: target.day.id }, { onSuccess })
    else createDay.mutate(input, { onSuccess })
  }

  const remove = () => {
    if (target.mode !== "edit") return
    deleteDay.mutate(target.day.id, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader
        title={target.mode === "edit" ? "Edit day" : "Add a day"}
        description={
          target.mode === "edit"
            ? "Changing the date moves all of this day's sessions with it."
            : "Days are listed in date order. Add sessions to it afterwards."
        }
      />
      <DialogBody>
        <Field label="Date" required error={errors.date}>
          <Input
            type="date"
            value={values.date}
            onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
            aria-invalid={!!errors.date}
          />
        </Field>
        <Field
          label="Theme"
          hint="Optional, e.g. Opening day."
          error={errors.theme}
        >
          <Input
            value={values.theme}
            onChange={(e) =>
              setValues((v) => ({ ...v, theme: e.target.value }))
            }
            maxLength={60}
            autoComplete="off"
            aria-invalid={!!errors.theme}
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
            <span className="text-xs/relaxed">
              Delete this day
              {sessionCount > 0 &&
                ` and its ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`}
              ?
            </span>
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
                {deleteDay.isPending && (
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
                {(createDay.isPending || updateDay.isPending) && (
                  <RiLoader4Line className="animate-spin" />
                )}
                {target.mode === "edit" ? "Save" : "Add day"}
              </Button>
            </div>
          </>
        )}
      </DialogFooter>
    </form>
  )
}
