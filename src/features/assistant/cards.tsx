import {
  RiArrowRightSLine,
  RiExternalLinkLine,
  RiFileExcel2Line,
  RiFilePdf2Line,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link } from "react-router"

import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/primitives"
import { formatDay } from "@/config/event"
import { useAccommodation } from "@/features/accommodation/api"
import { PLACE_KINDS } from "@/features/accommodation/types"
import { useGuestVisits } from "@/features/guests/api"
import { useRegistrations } from "@/features/registrations/api"
import { StatusBadge } from "@/features/registrations/components"
import {
  RegistrationQuickView,
  type QuickViewState,
} from "@/features/registrations/QuickView"
import { displayName } from "@/features/registrations/format"
import {
  DIMENSIONS,
  MEALS,
  STATUS_SETS,
  describeReport,
  registrationIdsOf,
  reportExport,
  reportLink,
  walkInLine,
  type Meal,
  type Report,
} from "@/features/reports/model"
import { BreakdownTable, ListTable } from "@/features/reports/tables"
import { formatMobile } from "@/lib/phone"

import {
  computeAccommodation,
  computeGuests,
  computeMeals,
  computeReport,
  guestDaysText,
  type AccommodationInput,
  type Card,
  type GuestsInput,
  type MealInput,
} from "./tools"

/**
 * What the admin sees for each tool the Assistant ran: the answer as a card,
 * recomputed from the latest data with the tool's own functions, with the
 * files to send on and a way into the screen that has the rest.
 */

const number = new Intl.NumberFormat("en-IN")

/** Rows drawn inside the chat; the files and the Reports screen have them all. */
const CARD_ROWS = 50

function Frame({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-heading text-sm font-medium">{title}</h3>
        {subtitle && (
          <div className="text-2xs/relaxed text-muted-foreground">
            {subtitle}
          </div>
        )}
      </header>
      {children}
      {actions && (
        <div className="flex flex-wrap gap-2 *:grow sm:*:grow-0">{actions}</div>
      )}
    </section>
  )
}

function Loading({
  pending,
  error,
  retry,
}: {
  pending: boolean
  error: Error | null
  retry: () => void
}) {
  if (error) return <LoadError error={error} onRetry={retry} />
  return pending ? <Skeleton className="h-32" /> : null
}

const linkButton = buttonVariants({ variant: "outline", size: "lg" })

/** Breakdown or List, as on the Reports screen. */
function Toggle({
  value,
  listCount,
  onChange,
}: {
  value: Report["view"]
  listCount: number
  onChange: (view: Report["view"]) => void
}) {
  const options = [
    ["summary", "Breakdown"],
    ["list", `List · ${number.format(listCount)}`],
  ] as const
  return (
    <div
      role="radiogroup"
      aria-label="Show"
      className="flex rounded-md border border-border p-0.5 sm:w-64"
    >
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-9 flex-1 rounded-sm px-3 text-xs whitespace-nowrap text-muted-foreground transition-colors sm:h-6",
            value === option && "bg-primary/10 font-medium text-primary"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function ReportCard({ report }: { report: Report }) {
  const registrations = useRegistrations()
  const { meal, mealDay } = report.filters
  const guests = useGuestVisits({ enabled: Boolean(meal || mealDay) })
  const [view, setView] = React.useState(report.view)
  const [quickView, setQuickView] = React.useState<QuickViewState>(null)
  const [exporting, setExporting] = React.useState<"excel" | "pdf" | null>(null)
  const [exportError, setExportError] = React.useState<string | null>(null)

  const result = React.useMemo(
    () =>
      registrations.data &&
      computeReport(
        {
          registrations: registrations.data,
          guestVisits: guests.data ?? [],
          accommodation: { places: [], mandalStays: [] },
        },
        report
      ),
    [registrations.data, guests.data, report]
  )
  const title = report.name || "Devotees report"
  const [counting, ...filterLines] = describeReport(report)

  if (!result)
    return (
      <Frame title={title}>
        <Loading
          pending={registrations.isPending}
          error={registrations.error}
          retry={() => void registrations.refetch()}
        />
      </Frame>
    )

  const { people, breakdown, list, walkIns } = result
  const walkIn = walkInLine(walkIns, report)

  const runExport = async (kind: "excel" | "pdf") => {
    setExporting(kind)
    setExportError(null)
    try {
      const { download, excelFile, pdfFile } =
        await import("@/features/reports/export")
      const file = reportExport(report, people, walkIn ? [walkIn] : [])
      download(await (kind === "excel" ? excelFile(file) : pdfFile(file)))
    } catch (cause) {
      console.error(cause)
      setExportError("Could not create the file. Please try again.")
    } finally {
      setExporting(null)
    }
  }

  return (
    <Frame
      title={title}
      subtitle={
        <>
          {filterLines.length > 0 && <p>{filterLines.join(" · ")}</p>}
          <p>{counting}</p>
        </>
      }
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            disabled={people.length === 0 || !!exporting}
            onClick={() => void runExport("excel")}
          >
            <RiFileExcel2Line />
            {exporting === "excel" ? "Preparing…" : "Excel"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={people.length === 0 || !!exporting}
            onClick={() => void runExport("pdf")}
          >
            <RiFilePdf2Line />
            {exporting === "pdf" ? "Preparing…" : "PDF"}
          </Button>
          <Link to={reportLink({ ...report, view })} className={linkButton}>
            <RiExternalLinkLine />
            Open in Reports
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-0.5">
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {number.format(people.length)}
          </span>
          <span className="text-xs text-muted-foreground">
            {people.length === 1 ? "person" : "people"} in{" "}
            {number.format(result.registrations)}{" "}
            {result.registrations === 1 ? "registration" : "registrations"}
          </span>
        </p>
        {walkIn && (
          <p className="text-2xs/relaxed text-muted-foreground">{walkIn}</p>
        )}
      </div>
      {exportError && (
        <p role="alert" className="text-xs text-destructive">
          {exportError}
        </p>
      )}

      {people.length > 0 && (
        <>
          <Toggle
            value={view}
            listCount={list.rows.length}
            onChange={setView}
          />
          {view === "summary" ? (
            <BreakdownTable
              breakdown={breakdown}
              label={DIMENSIONS[report.by].label}
              people={people.length}
              registrations={result.registrations}
            />
          ) : (
            <ListTable
              list={list}
              linkFirst={report.columns[0] === "code"}
              limit={CARD_ROWS}
              onOpen={(id) =>
                setQuickView({ id, queue: registrationIdsOf(list.rows) })
              }
            />
          )}
        </>
      )}
      <RegistrationQuickView state={quickView} onChange={setQuickView} />
    </Frame>
  )
}

const MEAL_KEYS = Object.keys(MEALS) as Meal[]

function MealsCard({ input }: { input: MealInput }) {
  const registrations = useRegistrations()
  const guests = useGuestVisits()
  const days = React.useMemo(
    () =>
      registrations.data &&
      guests.data &&
      computeMeals(
        {
          registrations: registrations.data,
          guestVisits: guests.data,
          accommodation: { places: [], mandalStays: [] },
        },
        input
      ),
    [registrations.data, guests.data, input]
  )
  const scope = [input.mandal, STATUS_SETS[input.counting].label]
    .filter(Boolean)
    .join(" · ")

  /** The people behind one number, on the Reports screen. */
  const link = (day: string, meal: Meal) =>
    reportLink({
      name: `${MEALS[meal]} · ${formatDay(day)}`,
      status: input.counting,
      dummy: input.dummy,
      filters: {
        mealDay: day,
        meal,
        ...(input.mandal ? { mandal: input.mandal } : {}),
        ...(input.region ? { region: input.region } : {}),
      },
      by: "mandal",
      across: "gender",
      mode: "people",
      view: "summary",
      columns: [
        "code",
        "name",
        "gender",
        "age",
        "mandal",
        "arrival",
        "departure",
      ],
    })

  return (
    <Frame
      title="Meal counts"
      subtitle={`${scope}. Tap a number for the people behind it.`}
    >
      {!days ? (
        <Loading
          pending={registrations.isPending || guests.isPending}
          error={registrations.error ?? guests.error}
          retry={() => {
            void registrations.refetch()
            void guests.refetch()
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs/relaxed tabular-nums">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                {MEAL_KEYS.map((meal) => (
                  <th key={meal} className="px-3 py-2 text-right font-medium">
                    {MEALS[meal]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {days.map(({ day, meals }) => (
                <tr key={day}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDay(day)}
                  </td>
                  {meals.map((m) => (
                    <td key={m.meal} className="px-3 py-2 text-right">
                      <Link
                        to={link(day, m.meal)}
                        className="font-medium hover:underline"
                      >
                        {number.format(m.devotees + m.guests)}
                      </Link>
                      {m.guests > 0 && (
                        <span className="block text-3xs text-muted-foreground">
                          incl. {number.format(m.guests)} walk-in
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  )
}

function RegistrationsCard({ ids }: { ids: string[] }) {
  const registrations = useRegistrations()
  const found = (registrations.data ?? []).filter((r) => ids.includes(r.id))
  const [quickView, setQuickView] = React.useState<QuickViewState>(null)
  return (
    <Frame title={ids.length === 1 ? "Registration" : "Registrations"}>
      {!registrations.data ? (
        <Loading
          pending={registrations.isPending}
          error={registrations.error}
          retry={() => void registrations.refetch()}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {found.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() =>
                  setQuickView({ id: r.id, queue: found.map((f) => f.id) })
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs/relaxed font-medium">
                    {r.code} · {displayName(r)}
                  </span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {r.mandal} · {r.members.length}{" "}
                    {r.members.length === 1 ? "person" : "people"}
                    {r.isSample ? " · dummy" : ""}
                  </span>
                </span>
                <StatusBadge status={r.status} />
                <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
          {found.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-muted-foreground">
              No longer found.
            </li>
          )}
        </ul>
      )}
      <RegistrationQuickView state={quickView} onChange={setQuickView} />
    </Frame>
  )
}

function AccommodationCard({ input }: { input: AccommodationInput }) {
  const registrations = useRegistrations()
  const accommodation = useAccommodation()
  const result = React.useMemo(
    () =>
      registrations.data &&
      accommodation.data &&
      computeAccommodation(
        {
          registrations: registrations.data,
          guestVisits: [],
          accommodation: accommodation.data,
        },
        input
      ),
    [registrations.data, accommodation.data, input]
  )
  return (
    <Frame
      title={input.mandal ? `Accommodation · ${input.mandal}` : "Accommodation"}
      subtitle="Beds asked for, from registrations not cancelled. People in rooms, as coordinators report."
      actions={
        <Link to="/accommodation" className={linkButton}>
          <RiExternalLinkLine />
          Open Accommodation
        </Link>
      }
    >
      {!result ? (
        <Loading
          pending={registrations.isPending || accommodation.isPending}
          error={registrations.error ?? accommodation.error}
          retry={() => {
            void registrations.refetch()
            void accommodation.refetch()
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs/relaxed tabular-nums">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Mandal</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  Need a bed
                </th>
                <th className="px-3 py-2 font-medium">Rooms given</th>
                <th className="px-3 py-2 text-right font-medium">Beds</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  In rooms
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.mandals.map((m) => {
                const beds = m.stays.reduce((n, s) => n + s.occupancy.beds, 0)
                const inRooms = m.stays.reduce(
                  (n, s) => n + s.occupancy.people,
                  0
                )
                return (
                  <tr key={m.mandal} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{m.mandal}</td>
                    <td className="px-3 py-2 text-right">
                      {number.format(m.askingForBed)}
                    </td>
                    <td className="px-3 py-2">
                      {m.stays.length === 0 ? (
                        <span className="text-muted-foreground">None yet</span>
                      ) : (
                        m.stays.map((s) => (
                          <span key={s.stay.id} className="block">
                            {s.place?.name ?? "Place removed"}: {s.rooms}
                            <span className="block text-3xs text-muted-foreground">
                              {s.stay.coordinatorName} ·{" "}
                              {formatMobile(s.stay.coordinatorMobile)}
                            </span>
                          </span>
                        ))
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right",
                        beds < m.askingForBed && "text-destructive"
                      )}
                    >
                      {number.format(beds)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {number.format(inRooms)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!input.mandal && result.places.length > 0 && (
            <p className="border-t border-border px-3 py-2 text-2xs/relaxed text-muted-foreground">
              {result.places
                .map(
                  (p) =>
                    `${p.place.name} (${PLACE_KINDS[p.place.kind].toLowerCase()}): ${p.roomsGiven} of ${p.rooms} rooms given`
                )
                .join(" · ")}
            </p>
          )}
        </div>
      )}
    </Frame>
  )
}

function GuestsCard({ input }: { input: GuestsInput }) {
  const guests = useGuestVisits()
  const result = React.useMemo(
    () => guests.data && computeGuests(guests.data, input),
    [guests.data, input]
  )
  return (
    <Frame
      title={[
        "Walk-in guests",
        input.date && formatDay(input.date),
        input.mandal,
      ]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <Link to="/guests" className={linkButton}>
          <RiExternalLinkLine />
          Open Guests
        </Link>
      }
    >
      {!result ? (
        <Loading
          pending={guests.isPending}
          error={guests.error}
          retry={() => void guests.refetch()}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs/relaxed tabular-nums">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 text-right font-medium">Guests</th>
                  <th className="px-3 py-2 text-right font-medium">Lunch</th>
                  <th className="px-3 py-2 text-right font-medium">Dinner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.days.map((d) => (
                  <tr key={d.day}>
                    <td className="px-3 py-2">{formatDay(d.day)}</td>
                    <td className="px-3 py-2 text-right">
                      {number.format(d.guests)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {number.format(d.lunch)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {number.format(d.dinner)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.entries.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {result.entries.slice(0, CARD_ROWS).map((v) => (
                <li key={v.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="text-xs/relaxed font-medium">
                    {v.hostName} · {formatMobile(v.hostMobile)}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {v.hostMandal} · {guestDaysText(v, input.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Frame>
  )
}

export function ResultCard({ card }: { card: Card }) {
  switch (card.kind) {
    case "report":
      return <ReportCard report={card.report} />
    case "meals":
      return <MealsCard input={card.input} />
    case "registrations":
      return <RegistrationsCard ids={card.ids} />
    case "accommodation":
      return <AccommodationCard input={card.input} />
    case "guests":
      return <GuestsCard input={card.input} />
  }
}
