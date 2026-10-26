import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"

import { useSetRegistrationStatus } from "./api"
import { displayName } from "./format"
import {
  REGISTRATION_STATUSES,
  type Registration,
  type RegistrationStatus,
} from "./types"

/**
 * Check in, cancel, restore: the status buttons, shared by a
 * registration's page and the quick view that opens from a list (Reports,
 * the Assistant). Only for reviewers (staff, admins); the caller checks.
 */

/** The next steps staff can take from each status. */
const ACTIONS: Record<
  RegistrationStatus,
  {
    to: RegistrationStatus
    label: string
    variant?: "outline" | "destructive"
  }[]
> = {
  confirmed: [
    { to: "checked_in", label: "Mark checked in" },
    { to: "cancelled", label: "Cancel", variant: "destructive" },
  ],
  checked_in: [{ to: "confirmed", label: "Undo check-in", variant: "outline" }],
  cancelled: [{ to: "confirmed", label: "Restore", variant: "outline" }],
}

/** The step forward: checking in. Working through a list, it is offered as "… & next". */
const FORWARD: Partial<Record<RegistrationStatus, RegistrationStatus>> = {
  confirmed: "checked_in",
}

export function StatusActions({
  registration,
  onNext,
  inline = false,
}: {
  registration: Registration
  /**
   * Working through a list: the forward step gets a "… & next" button that
   * moves on once it is saved.
   */
  onNext?: () => void
  /**
   * Ask "Cancel this registration?" in place of the buttons rather than in a
   * dialog of its own — for when the buttons are already inside a dialog.
   */
  inline?: boolean
}) {
  const setStatus = useSetRegistrationStatus()
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [done, setDone] = React.useState<RegistrationStatus | null>(null)

  // A different registration (the quick view moved on): start fresh.
  const [shownFor, setShownFor] = React.useState(registration.id)
  if (shownFor !== registration.id) {
    setShownFor(registration.id)
    setConfirmCancel(false)
    setDone(null)
    setStatus.reset()
  }

  const apply = (to: RegistrationStatus, then?: () => void) =>
    setStatus.mutate(
      { id: registration.id, status: to },
      {
        onSuccess: () => {
          setDone(to)
          then?.()
        },
      }
    )

  const people = registration.members.length
  const cancelQuestion = `Cancel ${registration.code}?`
  const cancelDetail = `${displayName(registration)}, ${people} ${people === 1 ? "person" : "people"}. They drop out of the headcounts and the accommodation list. The registration is kept and can be restored later.`

  if (inline && confirmCancel)
    return (
      <div
        role="alertdialog"
        aria-label={cancelQuestion}
        className="flex w-full flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
      >
        <p className="text-xs/relaxed font-medium">{cancelQuestion}</p>
        <p className="text-2xs/relaxed text-muted-foreground">{cancelDetail}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setConfirmCancel(false)}
          >
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={setStatus.isPending}
            onClick={() => apply("cancelled", () => setConfirmCancel(false))}
          >
            Cancel registration
          </Button>
        </div>
      </div>
    )

  const forward = FORWARD[registration.status]

  return (
    <>
      {ACTIONS[registration.status].map((action) => {
        const stepAndNext = onNext && action.to === forward
        return (
          <React.Fragment key={action.to}>
            {stepAndNext && (
              <Button
                size="lg"
                disabled={setStatus.isPending}
                onClick={() => apply(action.to, onNext)}
              >
                {action.label} & next
              </Button>
            )}
            <Button
              size="lg"
              variant={stepAndNext ? "outline" : (action.variant ?? "default")}
              disabled={setStatus.isPending}
              onClick={() =>
                action.to === "cancelled"
                  ? setConfirmCancel(true)
                  : apply(action.to)
              }
            >
              {action.label}
            </Button>
          </React.Fragment>
        )
      })}
      {setStatus.isError && (
        <p role="alert" className="w-full text-2xs/relaxed text-destructive">
          Could not update the status: {setStatus.error.message}
        </p>
      )}
      {done && !setStatus.isPending && !setStatus.isError && (
        <p role="status" className="w-full text-2xs/relaxed text-primary">
          Saved: {REGISTRATION_STATUSES[done].toLowerCase()}.
        </p>
      )}

      {!inline && (
        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent>
            <DialogHeader
              title={cancelQuestion}
              description={`${displayName(registration)}, ${people} ${people === 1 ? "person" : "people"}.`}
            />
            <DialogBody>
              <p className="text-xs/relaxed text-muted-foreground">
                They drop out of the headcounts and the accommodation list. The
                registration is kept and can be restored later.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  apply("cancelled")
                  setConfirmCancel(false)
                }}
              >
                Cancel registration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
