// PAUSED 2026-10-11 — per-person room allotment. Not imported anywhere; see README.md.
import {
  RiCheckLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiMapPinLine,
  RiPhoneLine,
  RiWhatsappLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/primitives"
import { formatCreatedAt } from "@/features/registrations/format"
import { GENDERS, type Gender, type Registration } from "@/features/registrations/types"
import { formatMobile } from "@/lib/phone"

import { useSendNotice } from "./api"
import { SHARES_BED_UNDER, formatNight, type RegistrationStay } from "./rules"
import { ROOM_KINDS, type NoticeState, type RoomKind, type StayNotice } from "./types"

export function RoomKindBadge({ kind }: { kind: RoomKind }) {
  return <Badge variant={kind === "family" ? "secondary" : "outline"}>{ROOM_KINDS[kind]}</Badge>
}

/**
 * Beds taken on each night, under a heading that says so. Counting by night
 * is what lets one bed serve someone leaving on the 31st and someone arriving
 * that evening — but a row of "0/3" tiles beside "3 beds" reads as four
 * rooms' worth unless it is labelled.
 */
export function NightOccupancy({
  nights,
  compact,
  selected,
  onSelect,
}: {
  /** `used` counts beds taken: a child under 5 sharing a parent's takes none. */
  nights: { night: string; used: number; beds: number; extraBeds?: number }[]
  /** On a room card: shorter labels, smaller tiles. */
  compact?: boolean
  /** The night picked to see who sleeps there; tiles become buttons with `onSelect`. */
  selected?: string
  /** Picks a night, or clears it when the picked one is pressed again. */
  onSelect?: (night: string | undefined) => void
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      {/* Shorter wording on phones, where both halves share a narrow card. */}
      <span className={cn("flex flex-wrap items-baseline justify-between gap-x-2 text-muted-foreground", compact ? "text-3xs" : "text-2xs")}>
        <span>
          <span className="sm:hidden">Beds each night</span>
          <span className="hidden sm:inline">Beds taken each night</span>
        </span>
        {onSelect &&
          (selected ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelect(undefined)
              }}
              className="text-primary hover:underline"
            >
              Show all
            </button>
          ) : (
            <span>
              <span className="sm:hidden">Tap for names</span>
              <span className="hidden sm:inline">Tap a night to see who's there</span>
            </span>
          ))}
      </span>
      <div className={cn("grid gap-1", compact ? "grid-cols-4" : "grid-cols-2 gap-1.5 sm:grid-cols-4")}>
        {nights.map(({ night, used, beds, extraBeds = 0 }) => {
          const Tile = onSelect ? "button" : "span"
          const picked = selected === night
          return (
            <Tile
              key={night}
              {...(onSelect && {
                type: "button" as const,
                "aria-pressed": picked,
                onClick: (event: React.MouseEvent) => {
                  // On a room card the tile sits inside the card's own click.
                  event.stopPropagation()
                  onSelect(picked ? undefined : night)
                },
              })}
              className={cn(
                "flex flex-col rounded-sm tabular-nums transition",
                compact ? "px-1 py-0.5 text-center text-3xs" : "rounded-md px-2 py-1.5 text-left text-2xs",
                used > beds + extraBeds
                  ? "bg-destructive/15 text-destructive"
                  : used > beds
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                    : used === beds
                      ? "bg-primary/20 text-primary"
                      : used > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                onSelect && "cursor-pointer outline-none hover:ring-1 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50",
                picked && "ring-2 ring-primary",
                selected && !picked && "opacity-50"
              )}
            >
              <span>{compact ? formatNight(night).split(" ").slice(0, 2).join(" ") : formatNight(night)}</span>
              <span className="font-medium">
                {used > beds && used <= beds + extraBeds
                  ? `${beds} + ${used - beds} extra`
                  : `${used} of ${beds}`}
              </span>
            </Tile>
          )
        })}
      </div>
    </div>
  )
}

/**
 * "Male · 33" as a pill, so an age is never read as part of a date beside it.
 * A child under 5 also says they share a parent's bed.
 */
export function PersonPill({ gender, age }: { gender: Gender; age: number }) {
  return (
    <>
      <Badge variant="outline" className="tabular-nums">
        {GENDERS[gender]} · {age}
      </Badge>
      {age < SHARES_BED_UNDER && (
        <Badge variant="secondary">Shares a parent's bed</Badge>
      )}
    </>
  )
}

/** Accommodation at a glance: asked for, waiting, partly or fully allotted. */
export function StayStatusBadge({ stay }: { stay: RegistrationStay }) {
  switch (stay.status) {
    case "not_needed":
      return <span className="text-muted-foreground">Not needed</span>
    case "unconfirmed":
      return <Badge variant="outline">Needed · confirm first</Badge>
    case "to_allot":
      return <Badge variant="warning">Needed · no room yet</Badge>
    case "partly":
      return (
        <Badge variant="warning">
          {stay.allotted.length} of {stay.sleepers.length} have a room
        </Badge>
      )
    case "allotted":
      return <Badge variant="info">Room allotted</Badge>
  }
}

/** "Sent 10 Oct, 4:41 am by Harit", or that it has changed since, or not sent. */
export function NoticeLine({ notice }: { notice?: NoticeState }) {
  if (!notice?.sentAt) return <span className="text-muted-foreground">Room details not sent</span>
  if (!notice.upToDate) {
    return (
      <span className="text-amber-700 dark:text-amber-400">
        Rooms changed since the details were sent — send again
      </span>
    )
  }
  return (
    <span className="text-muted-foreground">
      Room details sent {formatCreatedAt(notice.sentAt)}
      {notice.sentByName && ` by ${notice.sentByName}`}
    </span>
  )
}

/** Each place and room, and who is in it. */
export function StayDetails({ notice }: { notice: StayNotice }) {
  return (
    <div className="flex flex-col gap-3">
      {notice.places.map((place) => (
        <div key={place.name} className="flex flex-col gap-1 text-xs/relaxed">
          <p className="font-medium">{place.name}</p>
          <p className="text-2xs/relaxed text-muted-foreground">{place.address}</p>
          <ul className="flex flex-col gap-0.5">
            {place.rooms.map((room) => (
              <li key={room.label}>
                <span className="font-medium">Room {room.label}</span> · {room.people.join(", ")}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs/relaxed">
            {place.mapUrl && (
              <a
                href={place.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <RiMapPinLine className="size-3.5" />
                Open in Maps
              </a>
            )}
            {place.coordinatorMobile && (
              <a
                href={`tel:${place.coordinatorMobile}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <RiPhoneLine className="size-3.5" />
                {place.coordinatorName ? `${place.coordinatorName}, ` : ""}
                {formatMobile(place.coordinatorMobile)}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Sends a registration its room details on WhatsApp. Without WhatsApp on the
 * server, shows the message to send from your own phone — "Open WhatsApp"
 * fills it in — and then "Mark as sent" records it.
 */
export function SendRoomDetails({
  registration,
  notice,
  size = "lg",
}: {
  registration: Registration
  notice?: NoticeState
  size?: "lg" | "sm"
}) {
  const send = useSendNotice()
  const [manual, setManual] = React.useState<{ message: string; whatsappUrl: string }>()
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const again = notice?.sentAt && !notice.upToDate
  const done = notice?.sentAt && notice.upToDate

  return (
    <>
      <Button
        size={size}
        variant={done ? "outline" : "default"}
        disabled={send.isPending}
        onClick={() =>
          send.mutate(
            { registrationId: registration.id },
            { onSuccess: (result) => !result.sent && setManual(result) }
          )
        }
      >
        {send.isPending ? <RiLoader4Line className="animate-spin" /> : <RiWhatsappLine />}
        {again ? "Send again" : done ? "Resend" : "Send room details"}
      </Button>
      {send.isError && !manual && (
        <p className="w-full text-2xs/relaxed text-destructive">{send.error.message}</p>
      )}

      <Dialog open={!!manual} onOpenChange={(open) => !open && setManual(undefined)}>
        <DialogContent>
          <DialogHeader
            title="Send from your phone"
            description={`WhatsApp is not set up on the server yet. Send this to ${registration.members[0]?.fullName ?? "the contact"} yourself, then mark it as sent.`}
          />
          <DialogBody>
            <pre className="rounded-md bg-muted p-3 font-sans text-xs/relaxed whitespace-pre-wrap">
              {manual?.message}
            </pre>
            <div className="flex flex-wrap gap-2">
              <a
                href={manual?.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiWhatsappLine />
                Open WhatsApp
              </a>
              <Button
                variant="outline"
                size="lg"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(manual?.message ?? "")
                    setCopied(true)
                  } catch {
                    // Clipboard blocked: the message is on screen to select.
                  }
                }}
              >
                {copied ? <RiCheckLine /> : <RiFileCopyLine />}
                {copied ? "Copied" : "Copy message"}
              </Button>
            </div>
            {send.isError && (
              <p className="text-2xs/relaxed text-destructive">{send.error.message}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManual(undefined)}>
              Not now
            </Button>
            <Button
              disabled={send.isPending}
              onClick={() =>
                send.mutate(
                  { registrationId: registration.id, manual: true },
                  { onSuccess: () => setManual(undefined) }
                )
              }
            >
              Mark as sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
