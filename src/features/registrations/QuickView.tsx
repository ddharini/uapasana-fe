import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiEditLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiPhoneLine,
  RiWhatsappLine,
  RiWheelchairLine,
} from "@remixicon/react"
import * as React from "react"
import { Link } from "react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Badge, Skeleton } from "@/components/ui/primitives"
import { canReview, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"
import { formatTime } from "@/lib/time"

import { useRegistrations } from "./api"
import { PersonTravelList, StatusBadge, TravelModeIcon } from "./components"
import {
  comingByText,
  displayName,
  formatIndiaFlight,
  formatStay,
  journeyHomeText,
} from "./format"
import { StatusActions } from "./StatusActions"
import {
  accommodationSummary,
  airportFlights,
  compareStay,
  travelOf,
  travelModesOf,
  wantsBed,
} from "./stay"
import { GENDERS, TRAVEL_MODES, type Registration } from "./types"

/**
 * One registration in a popup, opened from a row of a list (Reports, the
 * Assistant's cards) — so an admin can work through the list without leaving
 * it: read the details, call or WhatsApp the contact, copy the travel details
 * for a driver, check in, and go on to the next one.
 *
 * `queue` is the list's registrations as they were when the popup opened:
 * checking one in may drop it from a "not checked in" list, and Next must still go
 * where the admin expects.
 */

export type QuickViewState = { id: string; queue: string[] } | null

const journeyModes = ["train", "public_bus", "flight"]

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 text-xs/relaxed">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/**
 * The details a driver or a volunteer needs, as plain text to paste into
 * WhatsApp.
 */
function shareText(r: Registration) {
  const contact = r.members[0]
  const t = r.travel
  const lines = [
    `${r.code} · ${displayName(r)} (${r.mandal}) · ${r.members.length} ${r.members.length === 1 ? "person" : "people"}`,
    `Contact: ${contact.fullName}${contact.mobile ? `, ${formatMobile(contact.mobile)}` : ""}`,
    `Arriving: ${formatStay(r.arrival)}`,
    `Leaving: ${formatStay(r.departure)}`,
  ]
  // Travelling separately: one line each, so the driver knows who is on which train.
  const people = t.mode === "separate" ? r.members : [undefined]
  for (const member of people) {
    const own = member ? travelOf(r, member) : t
    const who = member ? `${member.fullName}: ` : ""
    lines.push(
      `By: ${who}${comingByText(own)}${own.needsPickup ? " · pickup needed" : ""}`
    )
    if (own.needsDrop) lines.push(`Drop: ${who}${journeyHomeText(own)}`)
  }
  for (const { who, flights } of airportFlights(r)) {
    if (flights.needsPickup && flights.arrival)
      lines.push(
        `Airport pickup: ${who ? `${who}: ` : ""}${formatIndiaFlight(flights.arrival)}`
      )
  }
  const help = r.members.filter((m) => m.needsAssistance)
  if (help.length)
    lines.push(
      `Assistance: ${help.map((m) => `${m.fullName}${m.assistanceNote ? ` (${m.assistanceNote})` : ""}`).join("; ")}`
    )
  return lines.join("\n")
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => setCopied(true))
      }
    >
      {copied ? <RiCheckLine /> : <RiFileCopyLine />}
      {copied ? "Copied" : "Copy details"}
    </Button>
  )
}

function Details({ r }: { r: Registration }) {
  const contact = r.members[0]
  const t = r.travel
  const beds = accommodationSummary(r)
  const separate = t.mode === "separate"
  const journey = travelModesOf(r).some((mode) => journeyModes.includes(mode))

  return (
    <>
      {/* Reach them first: most work on a list starts with a call. */}
      <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xs/relaxed font-medium">
            {contact.fullName}
          </span>
          {contact.mobile && (
            <span className="text-2xs text-muted-foreground tabular-nums">
              {formatMobile(contact.mobile)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 *:grow sm:*:grow-0">
          {contact.mobile && (
            <>
              <a
                href={`tel:${contact.mobile}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiPhoneLine />
                Call
              </a>
              <a
                href={`https://wa.me/${contact.mobile.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiWhatsappLine />
                WhatsApp
              </a>
            </>
          )}
          <CopyButton text={shareText(r)} />
        </div>
      </section>

      <dl className="flex flex-col gap-1.5">
        <Row label="Arriving">{formatStay(r.arrival)}</Row>
        <Row label="Leaving">{formatStay(r.departure)}</Row>
        <Row label="Coming by">
          <span className="inline-flex items-center gap-1.5">
            <TravelModeIcon
              mode={t.mode}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            {[TRAVEL_MODES[t.mode], t.reference].filter(Boolean).join(" · ")}
          </span>
          {separate && (
            <span className="mt-1 block">
              <PersonTravelList registration={r} />
            </span>
          )}
          {(t.station || t.arrivalTime) && (
            <span className="block text-muted-foreground">
              {[
                t.station,
                t.arrivalTime && `reaches ${formatTime(t.arrivalTime)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          {(t.mode === "personal_vehicle" || !!t.vehicleCount) && (
            <span className="block text-muted-foreground tabular-nums">
              {t.vehicleCount ?? 1}{" "}
              {(t.vehicleCount ?? 1) === 1 ? "vehicle" : "vehicles"}
              {t.vehicleNumbers?.length
                ? `: ${t.vehicleNumbers.join(", ")}`
                : ""}
            </span>
          )}
        </Row>
        {journey && (
          <Row label="Transport">
            {t.needsPickup || t.needsDrop ? (
              <span className="flex flex-wrap gap-1.5">
                {t.needsPickup && <Badge variant="info">Pickup needed</Badge>}
                {t.needsDrop && <Badge variant="info">Drop needed</Badge>}
              </span>
            ) : (
              "No pickup or drop"
            )}
          </Row>
        )}
        {t.needsDrop && !separate && (
          <Row label="Journey home">
            {[
              t.departureMode && TRAVEL_MODES[t.departureMode],
              t.departureReference,
              t.departureStation,
              t.departureTime && `leaves ${formatTime(t.departureTime)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Row>
        )}
        {/* The party's flights, or each person's when they differ. */}
        {airportFlights(r).map(({ who, flights }, index) => (
          <React.Fragment key={index}>
            {flights.arrival && (
              <Row label="Airport pickup">
                {who && `${who}: `}
                {formatIndiaFlight(flights.arrival)}
              </Row>
            )}
            {flights.departure && (
              <Row label="Flight out">
                {who && `${who}: `}
                {formatIndiaFlight(flights.departure)}
              </Row>
            )}
          </React.Fragment>
        ))}
        <Row label="Accommodation">
          {beds === "Yes"
            ? "Needed"
            : beds === "No"
              ? "Not needed"
              : `Needed for ${beds} people`}
        </Row>
        {r.mobileVerification && (
          <Row label="Number">
            {r.mobileVerification === "otp"
              ? "Confirmed by a WhatsApp code"
              : `Confirmed in person by ${r.verifiedByName ?? "a sanchalak"}`}
          </Row>
        )}
      </dl>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-2xs font-medium text-muted-foreground">
          People ({r.members.length})
        </h3>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {r.members.map((m) => {
            const someBeds = !["Yes", "No"].includes(beds)
            const ownDates =
              compareStay(m.arrival, r.arrival) !== 0 ||
              compareStay(m.departure, r.departure) !== 0
            return (
              <li key={m.id} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="flex flex-wrap items-center gap-1.5 text-xs/relaxed font-medium">
                  {m.fullName}
                  {m.code && m.code !== r.code && (
                    <span className="font-mono text-2xs font-normal text-muted-foreground tabular-nums">
                      {m.code}
                    </span>
                  )}
                  {m.isPrimary && <Badge>Contact</Badge>}
                  {m.relation && <Badge variant="outline">{m.relation}</Badge>}
                  {someBeds && wantsBed(r, m) && (
                    <Badge variant="outline">Needs a bed</Badge>
                  )}
                </span>
                <span className="text-2xs text-muted-foreground tabular-nums">
                  {GENDERS[m.gender]} · {m.age} yrs
                  {m.mobile && (
                    <>
                      {" · "}
                      <a href={`tel:${m.mobile}`} className="hover:underline">
                        {formatMobile(m.mobile)}
                      </a>
                    </>
                  )}
                </span>
                {m.needsAssistance && (
                  <span className="flex items-center gap-1 text-2xs/relaxed text-amber-700 dark:text-amber-400">
                    <RiWheelchairLine className="size-3.5 shrink-0" />
                    {m.assistanceNote ?? "Needs assistance"}
                  </span>
                )}
                {ownDates && (
                  <span className="text-2xs/relaxed text-muted-foreground">
                    Own dates: {formatStay(m.arrival)} →{" "}
                    {formatStay(m.departure)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {r.notes && (
        <section className="flex flex-col gap-1">
          <h3 className="text-2xs font-medium text-muted-foreground">Notes</h3>
          <p className="text-xs/relaxed">{r.notes}</p>
        </section>
      )}
    </>
  )
}

export function RegistrationQuickView({
  state,
  onChange,
}: {
  state: QuickViewState
  onChange: (next: QuickViewState) => void
}) {
  const { data: registrations, isPending } = useRegistrations()
  const { data: session } = useSession()
  const reviewer = canReview(session?.user.role)

  const index = state ? state.queue.indexOf(state.id) : -1
  const go = (step: number) => {
    if (!state) return
    const next = state.queue[index + step]
    if (next) onChange({ ...state, id: next })
  }
  const hasNext = !!state && index + 1 < state.queue.length

  // Keyboard users land inside the popup (on Close, which is safe to press)
  // and go back to the row they opened it from.
  const opened = state !== null
  React.useEffect(() => {
    if (!opened) return
    const before = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("[data-slot='dialog-content'] button")
        ?.focus()
    )
    return () => {
      cancelAnimationFrame(frame)
      before?.focus?.()
    }
  }, [opened])

  // ← and → move through the list, unless someone is typing.
  React.useEffect(() => {
    if (!state) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select")) return
      if (event.key === "ArrowRight") go(1)
      if (event.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!state) return null
  const r = registrations?.find((reg) => reg.id === state.id)
  const close = () => onChange(null)

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title={
            r ? (
              <span className="flex flex-wrap items-center gap-2">
                {displayName(r)}
                <StatusBadge status={r.status} />
                {r.isSample && <Badge variant="outline">Dummy</Badge>}
              </span>
            ) : (
              "Registration"
            )
          }
          description={
            r &&
            `${r.code} · ${r.mandal} · ${r.members.length} ${r.members.length === 1 ? "person" : "people"}`
          }
        />
        <DialogBody>
          {r ? (
            <Details r={r} />
          ) : isPending ? (
            <Skeleton className="h-64" />
          ) : (
            <p className="text-xs/relaxed text-muted-foreground">
              This registration is no longer there. It may have been removed.
            </p>
          )}
        </DialogBody>
        <DialogFooter className="flex-col items-stretch gap-3">
          {r && reviewer && (
            <div className="flex flex-wrap gap-2 *:grow sm:*:grow-0">
              <StatusActions
                registration={r}
                onNext={hasNext ? () => go(1) : undefined}
                inline
              />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {state.queue.length > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Previous"
                  disabled={index <= 0}
                  onClick={() => go(-1)}
                >
                  <RiArrowLeftSLine />
                </Button>
                <span className="min-w-14 text-center text-2xs text-muted-foreground tabular-nums">
                  {index + 1} of {state.queue.length}
                </span>
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Next"
                  disabled={!hasNext}
                  onClick={() => go(1)}
                >
                  <RiArrowRightSLine />
                </Button>
              </div>
            ) : (
              <span />
            )}
            {r && (
              <div className="flex gap-2">
                <Link
                  to={`/registrations/${r.id}/edit`}
                  className={buttonVariants({ variant: "ghost", size: "lg" })}
                >
                  <RiEditLine />
                  Edit
                </Link>
                <Link
                  to={`/registrations/${r.id}`}
                  className={buttonVariants({ variant: "ghost", size: "lg" })}
                >
                  <RiExternalLinkLine />
                  Full page
                </Link>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
