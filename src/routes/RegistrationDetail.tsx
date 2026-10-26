import { RiEditLine, RiWheelchairLine } from "@remixicon/react"
import * as React from "react"
import { Link, useParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { BackLink } from "@/components/layout/BackLink"
import { LoadError } from "@/components/LoadError"
import { buttonVariants } from "@/components/ui/button"
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ui/primitives"
import { EVENT } from "@/config/event"
import { useAccommodation } from "@/features/accommodation/api"
import { Contact } from "@/features/accommodation/components"
import type { AccommodationData } from "@/features/accommodation/types"
// PAUSED 2026-10-11 — per-person room allotment (rooms now go to mandals).
// import { RegistrationStay } from "@/features/accommodation/paused/RegistrationStay"
// import { indexAccommodation } from "@/features/accommodation/paused/rules"
import { useRegistration } from "@/features/registrations/api"
import { StatusActions } from "@/features/registrations/StatusActions"
import {
  PersonTravelList,
  StatusBadge,
  TravelModeIcon,
  TypeBadge,
} from "@/features/registrations/components"
import {
  displayName,
  formatCreatedAt,
  formatIndiaFlight,
  formatStay,
} from "@/features/registrations/format"
import {
  accommodationSummary,
  compareStay,
  eventDaysCovered,
  airportFlights,
  hasSplitSchedule,
  isSevak,
  nightsBetween,
  wantsBed,
} from "@/features/registrations/stay"
import { canReview, isAdmin, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"
import { formatTime } from "@/lib/time"
import {
  GENDERS,
  TRAVEL_MODES,
  type Registration,
} from "@/features/registrations/types"

function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className="text-xs/relaxed break-words">{children}</dd>
    </div>
  )
}

/** "Needed", "Not needed", or "Needed for 2 of 4 people". */
function accommodationText(registration: Registration) {
  const summary = accommodationSummary(registration)
  if (summary === "Yes") return "Needed"
  if (summary === "No") return "Not needed"
  return `Needed for ${summary} people`
}

/**
 * Where the registration's mandal has rooms, with the coordinator to call:
 * the mandal's coordinator decides who sleeps where.
 */
function MandalRooms({
  mandal,
  data,
}: {
  mandal: string
  data: AccommodationData
}) {
  const stays = data.mandalStays.filter((s) => s.mandal === mandal)
  if (stays.length === 0) {
    return (
      <span className="mt-1 block text-2xs/relaxed text-muted-foreground">
        No rooms given to {mandal} yet.
      </span>
    )
  }
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5">
      {stays.map((stay) => {
        const place = data.places.find((p) => p.id === stay.placeId)
        return (
          <li key={stay.id} className="flex flex-col gap-0.5 text-2xs/relaxed">
            <span>
              {place ? (
                <Link
                  to={`/accommodation/places/${place.id}`}
                  className="font-medium hover:underline"
                >
                  {place.name}
                </Link>
              ) : (
                "A removed place"
              )}{" "}
              <span className="text-muted-foreground">
                · {stay.roomIds.length}{" "}
                {stay.roomIds.length === 1 ? "room" : "rooms"} for {mandal}
              </span>
            </span>
            <Contact
              name={stay.coordinatorName}
              mobile={stay.coordinatorMobile}
            />
          </li>
        )
      })}
    </ul>
  )
}

export function RegistrationDetail() {
  const { id = "" } = useParams()
  const { data: session } = useSession()
  const {
    data: registration,
    isPending,
    isError,
    error,
    refetch,
  } = useRegistration(id)
  // Where their mandal's rooms are, and who to call about them.
  const accommodation = useAccommodation()
  // PAUSED 2026-10-11 — per-person allotment needed every registration, for
  // who else is in the rooms this one could go to.
  // const all = useRegistrations()
  // const index = React.useMemo(
  //   () =>
  //     accommodation.data && all.data
  //       ? indexAccommodation(accommodation.data, all.data)
  //       : undefined,
  //   [accommodation.data, all.data]
  // )

  const back = <BackLink to="/registrations">All registrations</BackLink>

  if (isError) {
    return (
      <>
        {back}
        <LoadError error={error} onRetry={() => void refetch()} />
      </>
    )
  }

  if (isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-80" />
      </>
    )
  }

  if (!registration) {
    return (
      <>
        {back}
        <EmptyState
          title="Registration not found"
          description="It may have been removed, or the link is wrong. Search for it by name or mobile number in the list."
        />
      </>
    )
  }

  const r = registration
  const primary = r.members[0]
  // Only the seva team checks in and cancels; a sanchalak edits.
  const reviewer = canReview(session?.user.role)
  const split = hasSplitSchedule(r)
  const males = r.members.filter((m) => m.gender === "male").length

  return (
    <>
      {back}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {displayName(r)}
            <TypeBadge type={r.type} />
            <StatusBadge status={r.status} />
          </span>
        }
        description={
          <>
            {r.code} · registered {formatCreatedAt(r.createdAt)}{" "}
            {r.source === "staff" ? "at the desk" : "online"}
            {r.editedAt && (
              <>
                {" "}
                · changed {formatCreatedAt(r.editedAt)} by{" "}
                {r.editedByName ?? "the team"}
                {isAdmin(session?.user.role) && (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      to={`/admin/logs?registration=${r.id}`}
                      className="text-primary hover:underline"
                    >
                      See what changed
                    </Link>
                  </>
                )}
              </>
            )}
          </>
        }
        actions={
          <>
            <Link
              to={`/registrations/${r.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <RiEditLine />
              Edit
            </Link>
            {reviewer && <StatusActions registration={r} />}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="gap-3 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>People ({r.members.length})</CardTitle>
            <span className="text-2xs text-muted-foreground tabular-nums">
              {males} male · {r.members.length - males} female
            </span>
          </div>
          <ul className="-mx-4 divide-y divide-border border-t border-border">
            {r.members.map((m) => {
              const someWantBeds = !["Yes", "No"].includes(
                accommodationSummary(r)
              )
              const ownDates =
                compareStay(m.arrival, r.arrival) !== 0 ||
                compareStay(m.departure, r.departure) !== 0
              // const bed = index?.bedOf(r.id, m.id) // paused: per-person allotment
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-xs/relaxed font-medium">
                    {m.fullName}
                    {m.code && m.code !== r.code && (
                      <span className="font-mono text-2xs font-normal text-muted-foreground tabular-nums">
                        {m.code}
                      </span>
                    )}
                    {m.isPrimary && <Badge>Contact</Badge>}
                    {m.relation && (
                      <Badge variant="outline">{m.relation}</Badge>
                    )}
                    {/* Paused with per-person allotment:
                    {bed && (
                      <Badge variant="info">
                        {bed.place.name} · Room {bed.room.label}
                      </Badge>
                    )} */}
                    {/* Only worth saying when the party is split on it. */}
                    {someWantBeds && wantsBed(r, m) && (
                      <Badge variant="outline">Needs a bed</Badge>
                    )}
                    {isSevak(r, m) && (
                      <Badge variant="info">Swayam Sevak · early seva</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 text-2xs/relaxed text-muted-foreground tabular-nums">
                    <span>{GENDERS[m.gender]}</span>
                    <span aria-hidden>·</span>
                    <span>{m.age} yrs</span>
                    {m.mobile && (
                      <>
                        <span aria-hidden>·</span>
                        <a
                          href={`tel:${m.mobile}`}
                          className="text-foreground hover:underline"
                        >
                          {formatMobile(m.mobile)}
                        </a>
                      </>
                    )}
                  </div>
                  {m.needsAssistance && (
                    <div className="flex items-center gap-1 text-2xs/relaxed text-amber-700 dark:text-amber-400">
                      <RiWheelchairLine className="size-3.5 shrink-0 sm:size-3" />
                      {m.assistanceNote ?? "Needs assistance"}
                    </div>
                  )}
                  {m.attendsYouthConvention !== undefined &&
                    m.attendsYouthConvention !== null && (
                      <div className="text-2xs/relaxed text-muted-foreground">
                        Youth Convention:{" "}
                        {m.attendsYouthConvention
                          ? "Attending"
                          : "Not attending"}
                      </div>
                    )}
                  {split && ownDates && (
                    <div className="text-2xs/relaxed text-muted-foreground">
                      Own dates: {formatStay(m.arrival)} →{" "}
                      {formatStay(m.departure)}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="gap-3">
            <CardTitle>Contact</CardTitle>
            <dl className="grid grid-cols-2 gap-3">
              <Detail label="Primary contact">{primary.fullName}</Detail>
              <Detail label="Mobile">
                {primary.mobile ? (
                  <a
                    href={`tel:${primary.mobile}`}
                    className="tabular-nums hover:underline"
                  >
                    {formatMobile(primary.mobile)}
                  </a>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail label="Mandal">{r.mandal}</Detail>
              {r.mobileVerification && (
                <div className="col-span-2">
                  <Detail label="Number confirmed">
                    {r.mobileVerification === "otp"
                      ? "By a code on WhatsApp"
                      : `In person by ${r.verifiedByName ?? "a sanchalak"}`}
                  </Detail>
                </div>
              )}
            </dl>
          </Card>

          <Card className="gap-3">
            <CardTitle>Stay</CardTitle>
            <dl className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Detail label="Arriving">{formatStay(r.arrival)}</Detail>
              </div>
              <div className="col-span-2">
                <Detail label="Leaving">{formatStay(r.departure)}</Detail>
              </div>
              <Detail label="Nights">
                <span className="tabular-nums">
                  {nightsBetween(r.arrival, r.departure)}
                </span>
              </Detail>
              <Detail label="Event days">
                <span className="tabular-nums">
                  {eventDaysCovered(r)} of {EVENT.days.length}
                </span>
              </Detail>
              <div className="col-span-2">
                <Detail label="Accommodation">
                  {accommodationText(r)}
                  {r.accommodationRequired && accommodation.data && (
                    <MandalRooms mandal={r.mandal} data={accommodation.data} />
                  )}
                </Detail>
              </div>
            </dl>
          </Card>

          <Card className="gap-3">
            <CardTitle>Travel</CardTitle>
            <dl className="grid grid-cols-2 gap-3">
              <Detail label="Mode">
                <span className="inline-flex items-center gap-1.5">
                  <TravelModeIcon
                    mode={r.travel.mode}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  {TRAVEL_MODES[r.travel.mode]}
                </span>
              </Detail>
              {(r.travel.mode === "personal_vehicle" ||
                !!r.travel.vehicleCount) && (
                <Detail label={`Vehicles (${r.travel.vehicleCount ?? 1})`}>
                  {r.travel.vehicleNumbers?.length ? (
                    <span className="flex flex-col tabular-nums">
                      {r.travel.vehicleNumbers.map((number, index) => (
                        <span key={index}>{number}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Numbers not given
                    </span>
                  )}
                </Detail>
              )}
              {/* Travelling separately: each person's way, pickup and drop. */}
              {r.travel.mode === "separate" && (
                <div className="col-span-2 text-xs/relaxed">
                  <PersonTravelList registration={r} />
                </div>
              )}
              {r.travel.reference && (
                <Detail label="Details">{r.travel.reference}</Detail>
              )}
              {r.travel.station && (
                <Detail label="Arriving at">{r.travel.station}</Detail>
              )}
              {r.travel.arrivalTime && (
                <Detail label="Arrival time">
                  {formatTime(r.travel.arrivalTime)}
                </Detail>
              )}
              {r.travel.departureMode && (
                <Detail label="Leaving by">
                  {TRAVEL_MODES[r.travel.departureMode]}
                </Detail>
              )}
              {r.travel.departureReference && (
                <Detail label="Journey home">
                  {r.travel.departureReference}
                </Detail>
              )}
              {r.travel.departureStation && (
                <Detail label="Leaving from">
                  {r.travel.departureStation}
                </Detail>
              )}
              {r.travel.departureTime && (
                <Detail label="Departure time">
                  {formatTime(r.travel.departureTime)}
                </Detail>
              )}
              {(r.travel.mode === "train" ||
                r.travel.mode === "public_bus" ||
                r.travel.mode === "flight") && (
                <div className="col-span-2">
                  <Detail label="Transport">
                    {r.travel.needsPickup || r.travel.needsDrop ? (
                      <span className="flex flex-wrap gap-1.5">
                        {r.travel.needsPickup && (
                          <Badge variant="info">Pickup needed</Badge>
                        )}
                        {r.travel.needsDrop && (
                          <Badge variant="info">Drop needed</Badge>
                        )}
                      </span>
                    ) : (
                      "No pickup or drop"
                    )}
                  </Detail>
                </div>
              )}
            </dl>
          </Card>

          {/* The party's flights, or each person's when they differ. */}
          {airportFlights(r).length > 0 && (
            <Card className="gap-3">
              <CardTitle>Ahmedabad airport</CardTitle>
              {airportFlights(r).map(({ who, flights }, index) => (
                <dl key={index} className="grid grid-cols-2 gap-3">
                  {who && (
                    <p className="col-span-2 text-xs/relaxed font-medium">
                      {who}
                    </p>
                  )}
                  <div className="col-span-2">
                    <Detail label="Pickup when landing">
                      {flights.arrival
                        ? formatIndiaFlight(flights.arrival)
                        : "Not needed"}
                    </Detail>
                  </div>
                  <div className="col-span-2">
                    <Detail label="Flight out">
                      {flights.departure
                        ? formatIndiaFlight(flights.departure)
                        : "Not given"}
                    </Detail>
                  </div>
                </dl>
              ))}
            </Card>
          )}

          {r.notes && (
            <Card className="gap-2">
              <CardTitle>Notes</CardTitle>
              <p className="text-xs/relaxed">{r.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
