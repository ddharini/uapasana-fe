import { RiCheckboxCircleLine } from "@remixicon/react"
import * as React from "react"

import { PublicHeader } from "@/components/layout/PublicHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/primitives"
import { formatStayDate } from "@/config/event"
import { formatMeals, type GuestVisit } from "@/features/guests/api"
import { GuestForm } from "@/features/guests/GuestForm"

/** What was sent, so the host can check it before closing the page. */
function Sent({
  visit,
  onAnother,
}: {
  visit: GuestVisit
  onAnother: () => void
}) {
  return (
    <Card className="gap-5">
      <div className="flex items-start gap-3">
        <RiCheckboxCircleLine className="size-6 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base font-medium">
            Thank you, {visit.hostName}
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Your guests are noted. The team will plan seating and meals for
            them. If anything changes, call the seva team.
          </p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-xs/relaxed">
        {visit.days.map((day) => (
          <li
            key={day.date}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2"
          >
            <span>{formatStayDate(day.date)}</span>
            <span className="text-muted-foreground tabular-nums">
              {day.guests} {day.guests === 1 ? "person" : "people"} ·{" "}
              {formatMeals(day.meals)}
            </span>
          </li>
        ))}
      </ul>
      <Button size="lg" variant="outline" onClick={onAnother}>
        Add another group of guests
      </Button>
    </Card>
  )
}

/**
 * The public guest form at /guests/register — the link the team shares with
 * selected devotees who are bringing friends or family for the day. No
 * sign-in; asks only whose guests they are, the days they come, how many,
 * and which meals they take.
 */
export function GuestRegister() {
  const [sent, setSent] = React.useState<GuestVisit>()
  // The host's details carry over to "Add another group".
  const [last, setLast] = React.useState<GuestVisit>()
  const [formKey, setFormKey] = React.useState(0)

  return (
    <div className="flex min-h-svh flex-col">
      <PublicHeader eyebrow="Bringing guests">
        <p className="max-w-prose text-xs/relaxed text-muted-foreground">
          Inviting friends or family to come for a day? Tell us whose guests
          they are, which days they come, how many, and whether they will take
          mahaprasad (lunch, dinner or both). They do not need to register
          themselves.
        </p>
      </PublicHeader>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-5 pb-10 sm:px-6 sm:py-6">
        {sent ? (
          <Sent
            visit={sent}
            onAnother={() => {
              setSent(undefined)
              setFormKey((k) => k + 1)
              window.scrollTo({ top: 0 })
            }}
          />
        ) : (
          <GuestForm
            key={formKey}
            audience="host"
            host={last}
            onSaved={(visit) => {
              setSent(visit)
              setLast(visit)
              window.scrollTo({ top: 0 })
            }}
          />
        )}
      </main>
    </div>
  )
}
