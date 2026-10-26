import {
  RiBus2Line,
  RiBusLine,
  RiCarLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiFileCopyLine,
  RiHome4Line,
  RiPlaneLine,
  RiQuestionLine,
  RiRouteLine,
  RiShuffleLine,
  RiTrainLine,
} from "@remixicon/react"
import * as React from "react"

import { Badge } from "@/components/ui/primitives"
import { EVENT } from "@/config/event"
import { useT } from "@/i18n/context"

import { comingByText, formatStay, journeyHomeText } from "./format"
import { eventDaysCovered, travelOf } from "./stay"
import {
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  type Registration,
  type RegistrationStatus,
  type RegistrationType,
  type TravelMode,
} from "./types"

const STATUS_VARIANT = {
  confirmed: "outline",
  checked_in: "success",
  cancelled: "destructive",
} as const satisfies Record<RegistrationStatus, string>

const TRAVEL_ICONS = {
  personal_vehicle: RiCarLine,
  mandal_bus: RiBusLine,
  train: RiTrainLine,
  flight: RiPlaneLine,
  public_bus: RiBus2Line,
  other: RiRouteLine,
  local: RiHome4Line,
  not_filled: RiQuestionLine,
  separate: RiShuffleLine,
} satisfies Record<TravelMode, React.ComponentType>

/** The icon for how someone is travelling: a train for train, and so on. */
export function TravelModeIcon({
  mode,
  className,
}: {
  mode: TravelMode
  className?: string
}) {
  const Icon = TRAVEL_ICONS[mode]
  return <Icon aria-hidden className={className} />
}

/**
 * Each person's own travel, for a party that travels separately: their way
 * here with its details, the pickup and drop they asked for, and the journey
 * home. Staff screens only, so English.
 */
export function PersonTravelList({
  registration,
}: {
  registration: Registration
}) {
  return (
    <ul className="flex flex-col gap-2">
      {registration.members.map((member) => {
        const travel = travelOf(registration, member)
        return (
          <li key={member.id} className="flex flex-col gap-0.5">
            <span className="font-medium">{member.fullName}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <TravelModeIcon
                mode={travel.mode}
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              {comingByText(travel)}
              {travel.needsPickup && <Badge variant="info">Pickup</Badge>}
              {travel.needsDrop && <Badge variant="info">Drop</Badge>}
            </span>
            {travel.needsDrop && (
              <span className="text-muted-foreground">
                Journey home: {journeyHomeText(travel)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  const { t } = useT()
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {t(REGISTRATION_STATUSES[status])}
    </Badge>
  )
}

export function TypeBadge({ type }: { type: RegistrationType }) {
  return <Badge variant="outline">{REGISTRATION_TYPES[type]}</Badge>
}

/** Shown once a registration is saved. The code is what the devotee quotes at the desk. */
export function RegistrationConfirmation({
  registration,
  actions,
  updated = false,
}: {
  registration: Registration
  actions: React.ReactNode
  /** Changes to a saved registration, rather than a new one. */
  updated?: boolean
}) {
  const primary = registration.members[0]
  const { t, lang } = useT()
  const name = primary?.fullName.split(" ")[0]
  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-border bg-card px-6 py-10 text-center">
      <RiCheckboxCircleLine className="size-10 text-primary" />
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-medium">
          {updated ? t("Changes saved") : t("Registration received")}
        </h2>
        <p className="max-w-sm text-xs/relaxed text-muted-foreground">
          {updated
            ? t(
                "Thank you, {name}. Your registration is updated; the code stays the same.",
                { name }
              )
            : t(
                "Thank you, {name}. Keep this code and show it at the registration desk when you arrive.",
                { name }
              )}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-3xs tracking-wider text-muted-foreground uppercase">
          {registration.type === "family"
            ? t("Family code")
            : t("Registration code")}
        </span>
        <span className="font-mono text-3xl font-semibold tracking-wider tabular-nums">
          {registration.code}
        </span>
      </div>
      {/* Everyone in a family has their own number too. */}
      {registration.type === "family" &&
        registration.members.some((m) => m.code) && (
          <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
            <span className="text-center text-3xs tracking-wider text-muted-foreground uppercase">
              {t("Each person's code")}
            </span>
            <ul className="divide-y divide-border rounded-md border border-border text-xs/relaxed">
              {registration.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-3 py-1.5"
                >
                  <span className="truncate">{m.fullName}</span>
                  <span className="shrink-0 font-mono font-medium tabular-nums">
                    {m.code}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      <dl className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-left text-xs/relaxed">
        <dt className="text-muted-foreground">{t("People")}</dt>
        <dd className="tabular-nums">{registration.members.length}</dd>
        <dt className="text-muted-foreground">{t("Arriving")}</dt>
        <dd>{formatStay(registration.arrival, lang)}</dd>
        <dt className="text-muted-foreground">{t("Leaving")}</dt>
        <dd>{formatStay(registration.departure, lang)}</dd>
        <dt className="text-muted-foreground">{t("Event days")}</dt>
        <dd className="tabular-nums">
          {t("{n} of {total}", {
            n: eventDaysCovered(registration),
            total: EVENT.days.length,
          })}
        </dd>
        <dt className="text-muted-foreground">{t("Status")}</dt>
        <dd>
          <StatusBadge status={registration.status} />
        </dd>
      </dl>
      {registration.accommodationRequired && (
        <p className="max-w-sm text-2xs/relaxed text-muted-foreground">
          {t("Room details follow once accommodation is allotted.")}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  )
}

/**
 * The verification code, shown on screen only by a development server that
 * cannot send WhatsApp yet — with a Copy button, so testing the form does not
 * mean retyping it.
 */
export function DevCodeNote({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard blocked (e.g. plain http on a phone): the code is on screen.
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-amber-500/15 py-0.5 pr-0.5 pl-1.5 text-amber-800 dark:text-amber-300">
      Dev mode — WhatsApp not set up. Code:{" "}
      <span className="font-mono">{code}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Code copied" : "Copy code"}
        className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium hover:bg-amber-500/20"
      >
        {copied ? (
          <RiCheckLine className="size-3" />
        ) : (
          <RiFileCopyLine className="size-3" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  )
}
