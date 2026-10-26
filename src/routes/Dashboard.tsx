import { RiUserAddLine } from "@remixicon/react"
import { cn } from "cn"
import { Link } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { useSession } from "@/lib/auth-client"
import { LoadError } from "@/components/LoadError"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui/primitives"
import { formatStayDate } from "@/config/event"
import { useAccommodation } from "@/features/accommodation/api"
import type { AccommodationData } from "@/features/accommodation/types"
import { useRegistrations } from "@/features/registrations/api"
import { StatusBadge, TypeBadge } from "@/features/registrations/components"
import { displayName, formatCreatedAt } from "@/features/registrations/format"
import { summarize, type Summary } from "@/features/registrations/stats"
import { TRAVEL_MODES } from "@/features/registrations/types"

const number = new Intl.NumberFormat("en-IN")

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: number
  detail: string
  tone?: "warning"
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-2xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-2xl font-semibold tabular-nums",
          tone === "warning" && "text-amber-700 dark:text-amber-400"
        )}
      >
        {number.format(value)}
      </span>
      <span className="text-2xs/relaxed text-muted-foreground">{detail}</span>
    </div>
  )
}

/** A horizontal bar for a value out of a maximum. */
function Bar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full bg-primary", className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function DayByDay({ summary }: { summary: Summary }) {
  const peak = Math.max(...summary.days.map((d) => d.total))
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Day by day</CardTitle>
        <CardDescription>
          Devotees on site each day, for meal and seating planning. Beds counts
          people with accommodation who stay that night.
        </CardDescription>
      </CardHeader>
      {/* Phones: one block per day. The seven-column table needs a wider screen. */}
      <ul className="-mx-4 divide-y divide-border border-t border-border sm:hidden">
        {summary.days.map((day) => (
          <li key={day.day} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2 text-xs/relaxed">
              <span>{formatStayDate(day.day)}</span>
              <span className="font-heading text-base font-semibold tabular-nums">
                {number.format(day.total)}
              </span>
            </div>
            <Bar value={day.total} max={peak} />
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted-foreground tabular-nums">
              <span>{day.male} male</span>
              <span>{day.female} female</span>
              <span>+{day.arriving} arriving</span>
              <span>−{day.leaving} leaving</span>
              <span>{day.overnight} beds</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="-mx-4 hidden overflow-x-auto px-4 sm:block">
        <table className="w-full min-w-[36rem] text-left text-xs/relaxed tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1.5 pr-3 font-medium">Day</th>
              <th className="w-full py-1.5 pr-3 font-medium">On site</th>
              <th className="py-1.5 pr-3 text-right font-medium">Male</th>
              <th className="py-1.5 pr-3 text-right font-medium">Female</th>
              <th className="py-1.5 pr-3 text-right font-medium">Arriving</th>
              <th className="py-1.5 pr-3 text-right font-medium">Leaving</th>
              <th className="py-1.5 text-right font-medium">Beds</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {summary.days.map((day) => (
              <tr key={day.day}>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {formatStayDate(day.day)}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Bar value={day.total} max={peak} />
                    <span className="w-10 shrink-0 text-right font-medium">
                      {number.format(day.total)}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right">{day.male}</td>
                <td className="py-2 pr-3 text-right">{day.female}</td>
                <td className="py-2 pr-3 text-right">{day.arriving}</td>
                <td className="py-2 pr-3 text-right">{day.leaving}</td>
                <td className="py-2 text-right">{day.overnight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Breakdown({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: { label: string; value: number; detail?: string }[]
}) {
  const max = Math.max(...rows.map((r) => r.value), 0)
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs/relaxed">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{number.format(row.value)}</span>
                {row.detail && (
                  <span className="text-muted-foreground"> · {row.detail}</span>
                )}
              </span>
            </div>
            <Bar value={row.value} max={max} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Rooms given to mandals, across every place. */
const roomsGiven = (data: AccommodationData) =>
  data.mandalStays.reduce((sum, s) => sum + s.roomIds.length, 0)

export function Dashboard() {
  const {
    data: registrations,
    isPending,
    isError,
    error,
    refetch,
  } = useRegistrations()
  const accommodation = useAccommodation()
  const { data: session } = useSession()
  // A sanchalak's numbers are their own mandal's: the server only sends those.
  const scope =
    session?.user.role === "sanchalak" ? session.user.mandal : undefined

  const header = (
    <PageHeader
      title={scope ? `Overview · ${scope}` : "Overview"}
      description={`Who is coming${scope ? ` from ${scope}` : ""}, when, and what they need. Cancelled registrations are left out of the counts.`}
      actions={
        <Link
          to="/registrations/new"
          className={buttonVariants({ size: "lg" })}
        >
          <RiUserAddLine />
          New registration
        </Link>
      }
    />
  )

  if (isError) {
    return (
      <>
        {header}
        <LoadError error={error} onRetry={() => void refetch()} />
      </>
    )
  }

  if (isPending || !registrations) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </>
    )
  }

  const summary = summarize(registrations)
  const recent = registrations.slice(0, 6)

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Devotees"
          value={summary.people}
          detail={`${summary.activeRegistrations} registrations · ${summary.male} male, ${summary.female} female`}
        />
        <Stat
          label="Need a stay"
          value={summary.needsAccommodation}
          detail={
            accommodation.data
              ? `People who asked for accommodation · ${roomsGiven(accommodation.data)} rooms given to mandals`
              : "People who asked for accommodation"
          }
        />
        <Stat
          label="Checked in"
          value={summary.byStatus.checked_in}
          detail="Registrations checked in at the desk"
        />
        <Stat
          label="Need assistance"
          value={summary.needsAssistance}
          detail={`${summary.seniors} seniors (60+) · ${summary.children} children under 12`}
        />
      </div>

      <DayByDay summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown
          title="By mandal"
          description="Devotees per mandal, with the number of registrations."
          rows={summary.mandals.map((m) => ({
            label: m.mandal,
            value: m.people,
            detail: `${m.registrations} reg.`,
          }))}
        />
        <div className="flex flex-col gap-4">
          <Breakdown
            title="Travel"
            description={`Devotees by how they are travelling. ${summary.vehicles} personal vehicles need parking; ${summary.needsPickup} people need a station or airport pickup, and ${summary.needsDrop} a drop when leaving.`}
            rows={summary.travel.map((t) => ({
              label: TRAVEL_MODES[t.mode],
              value: t.people,
            }))}
          />

          <Card className="gap-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Latest registrations</CardTitle>
              <Link
                to="/registrations"
                className="text-2xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <ul className="-mx-4 divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/registrations/${r.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs/relaxed font-medium">
                        {displayName(r)}
                      </span>
                      <span className="truncate text-2xs text-muted-foreground">
                        {r.code} · {r.members.length}{" "}
                        {r.members.length === 1 ? "person" : "people"} ·{" "}
                        {r.mandal} · {formatCreatedAt(r.createdAt)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="hidden sm:inline-flex">
                        <TypeBadge type={r.type} />
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
