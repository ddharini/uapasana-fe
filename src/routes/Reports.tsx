import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiFileExcel2Line,
  RiFilePdf2Line,
  RiLayoutColumnLine,
  RiWhatsappLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/choice"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import { useGuestVisits } from "@/features/guests/api"
import { useRegistrations } from "@/features/registrations/api"
import { Chip, FilterPicker } from "@/features/reports/FilterBar"
import {
  RegistrationQuickView,
  type QuickViewState,
} from "@/features/registrations/QuickView"
import {
  COLUMNS,
  DEFAULT_COLUMNS,
  DIMENSIONS,
  FILTERS,
  PRESETS,
  STATUS_SETS,
  applyReport,
  breakDown,
  filterValueLabel,
  fromPreset,
  isBlank,
  listRows,
  readReport,
  registrationIdsOf,
  reportExport,
  walkInGuests,
  walkInLine,
  withDataDays,
  writeReport,
  type Column,
  type Dimension,
  type Report,
} from "@/features/reports/model"
import { BreakdownTable, ListTable } from "@/features/reports/tables"

const number = new Intl.NumberFormat("en-IN")

/** Rows drawn on screen. The exports always carry every row. */
const SHOWN_ROWS = 200

/** Two or more options side by side, one picked: Breakdown/List, per person/registration. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex rounded-md border border-border p-0.5", className)}
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

/** Picks which details the list shows, in the order they are listed here. */
function ColumnsDialog({
  open,
  onOpenChange,
  columns,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: Column[]
  onChange: (columns: Column[]) => void
}) {
  const [picked, setPicked] = React.useState(columns)
  // Start from what is showing each time it opens.
  const [openedWith, setOpenedWith] = React.useState(columns)
  if (open && openedWith !== columns) {
    setOpenedWith(columns)
    setPicked(columns)
  }
  const all = Object.keys(COLUMNS) as Column[]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title="Columns"
          description="The details in the list and in the exported files."
        />
        <DialogBody>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {all.map((column) => (
              <Checkbox
                key={column}
                label={COLUMNS[column].label}
                checked={picked.includes(column)}
                onChange={(e) =>
                  setPicked(
                    e.target.checked
                      ? all.filter((c) => c === column || picked.includes(c))
                      : picked.filter((c) => c !== column)
                  )
                }
              />
            ))}
          </div>
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={() => setPicked(DEFAULT_COLUMNS)}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={picked.length === 0}
              onClick={() => {
                onChange(picked)
                onOpenChange(false)
              }}
            >
              Show {picked.length} columns
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Where a report starts: the common questions, or everyone. */
function StartScreen({ onPick }: { onPick: (next: Report) => void }) {
  const [params] = useSearchParams()
  const current = readReport(params)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-medium">
        What do you want to know?
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {PRESETS.map((preset) => (
          <li key={preset.label}>
            <button
              type="button"
              onClick={() => onPick(fromPreset(preset, current))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs/relaxed font-medium">
                  {preset.label}
                </span>
                <span className="text-2xs/relaxed text-muted-foreground">
                  {preset.question}
                </span>
              </span>
              <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="lg"
        className="self-start"
        onClick={() =>
          onPick(
            fromPreset(
              { label: "All devotees", question: "", report: {} },
              current
            )
          )
        }
      >
        <RiAddLine />
        Start from all devotees and filter
      </Button>
    </section>
  )
}

/**
 * Admins' reports. It starts with the common questions; picking one (or
 * "all devotees") opens the report: its filters as chips, the answer in one
 * number, then either the breakdown or the list — and Excel or PDF of it.
 * The whole report lives in the URL, so it can be bookmarked or shared.
 */
export function Reports() {
  const {
    data: registrations,
    isPending,
    isError,
    error,
    refetch,
  } = useRegistrations()
  const [params, setParams] = useSearchParams()
  const report = React.useMemo(() => readReport(params), [params])
  const replace = (next: Report) =>
    setParams(writeReport(next), { replace: true })
  const set = (next: Partial<Report>) => replace({ ...report, ...next })

  const [picker, setPicker] = React.useState<string | null>(null)
  const [columnsOpen, setColumnsOpen] = React.useState(false)
  const [quickView, setQuickView] = React.useState<QuickViewState>(null)
  const [exporting, setExporting] = React.useState<"excel" | "pdf" | null>(null)
  const [exportError, setExportError] = React.useState<string | null>(null)

  const everyone = React.useMemo(
    () =>
      (registrations ?? []).flatMap((registration) =>
        registration.members.map((member) => ({ registration, member }))
      ),
    [registrations]
  )
  const filters = React.useMemo(
    () => withDataDays(FILTERS, everyone),
    [everyone]
  )
  const people = React.useMemo(
    () => applyReport(registrations ?? [], report),
    [registrations, report]
  )
  const registrationCount = new Set(people.map((p) => p.registration.id)).size
  const breakdown = React.useMemo(
    () => breakDown(people, report.by, report.across),
    [people, report.by, report.across]
  )
  const list = React.useMemo(
    () => listRows(people, report.columns, report.mode),
    [people, report.columns, report.mode]
  )
  const dummyCount = (registrations ?? []).filter((r) => r.isSample).length
  const male = people.filter((p) => p.member.gender === "male").length

  // Walk-in guests only count towards meals.
  const { meal, mealDay } = report.filters
  const { data: guestVisits } = useGuestVisits({
    enabled: Boolean(meal || mealDay),
  })
  const walkIns = React.useMemo(
    () => (guestVisits ? walkInGuests(guestVisits, report) : null),
    [guestVisits, report]
  )
  const walkIn = walkInLine(walkIns, report)

  const blank = isBlank(report)

  const runExport = async (kind: "excel" | "pdf") => {
    setExporting(kind)
    setExportError(null)
    const file = reportExport(report, people, walkIn ? [walkIn] : [], filters)
    try {
      const { download, excelFile, pdfFile } =
        await import("@/features/reports/export")
      download(await (kind === "excel" ? excelFile(file) : pdfFile(file)))
    } catch (cause) {
      console.error(cause)
      setExportError("Could not create the file. Please try again.")
    } finally {
      setExporting(null)
    }
  }

  const dimensionSelect = (
    label: string,
    value: Dimension | undefined,
    onChange: (value: string) => void,
    empty?: string
  ) => (
    <NativeSelect
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="sm:w-44"
    >
      {empty && <option value="">{empty}</option>}
      {(Object.keys(DIMENSIONS) as Dimension[]).map((d) => (
        <option key={d} value={d}>
          {DIMENSIONS[d].label}
        </option>
      ))}
    </NativeSelect>
  )

  const exportDisabled = isPending || people.length === 0 || !!exporting

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          blank
            ? "Count and list devotees any way you need, then export to Excel or PDF."
            : undefined
        }
        actions={
          !blank && (
            <>
              <Link
                to={`/admin/messages/new?${writeReport({ ...report, name: null, dummy: false })}`}
                title="Send a WhatsApp message to the people in this report"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiWhatsappLine />
                WhatsApp
              </Link>
              <Button
                variant="outline"
                size="lg"
                disabled={exportDisabled}
                onClick={() => void runExport("excel")}
              >
                <RiFileExcel2Line />
                {exporting === "excel" ? "Preparing…" : "Excel"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={exportDisabled}
                onClick={() => void runExport("pdf")}
              >
                <RiFilePdf2Line />
                {exporting === "pdf" ? "Preparing…" : "PDF"}
              </Button>
            </>
          )
        }
      />
      {exportError && (
        <p role="alert" className="-mt-2 text-xs text-destructive">
          {exportError}
        </p>
      )}

      {blank ? (
        <StartScreen onPick={replace} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="All reports"
                title="All reports"
                onClick={() =>
                  replace({
                    ...report,
                    name: null,
                    status: "active",
                    filters: {},
                  })
                }
              >
                <RiArrowLeftLine />
              </Button>
              {/* The title is the report's name, renamed in place. */}
              <input
                aria-label="Report name"
                value={report.name ?? ""}
                placeholder="Devotees report"
                onChange={(e) => set({ name: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-heading text-base font-medium outline-none hover:border-border focus-visible:border-ring"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Chip
                label="Counting"
                value={`${STATUS_SETS[report.status].label}${report.dummy ? " + dummy" : ""}`}
                onEdit={() => setPicker("status")}
              />
              {filters
                .filter((f) => report.filters[f.key])
                .map((f) => {
                  const value = report.filters[f.key]
                  return (
                    <Chip
                      key={f.key}
                      label={f.label}
                      value={filterValueLabel(f, value)}
                      onEdit={() => setPicker(f.key)}
                      onRemove={() =>
                        set({ filters: { ...report.filters, [f.key]: "" } })
                      }
                    />
                  )
                })}
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setPicker("")}
                className="text-primary"
              >
                <RiAddLine />
                Filter
              </Button>
            </div>
          </section>

          {isError ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : isPending ? (
            <Skeleton className="h-72" />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-heading text-3xl font-semibold tabular-nums">
                    {number.format(people.length)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {people.length === 1 ? "person" : "people"}
                  </span>
                </p>
                <p className="text-xs/relaxed text-muted-foreground tabular-nums">
                  in {number.format(registrationCount)}{" "}
                  {registrationCount === 1 ? "registration" : "registrations"} ·{" "}
                  {number.format(male)} male ·{" "}
                  {number.format(people.length - male)} female
                </p>
                {walkIn && (
                  <p className="text-xs/relaxed text-muted-foreground">
                    {walkIn}
                  </p>
                )}
                {(meal || mealDay) && (
                  <p className="text-2xs/relaxed text-muted-foreground">
                    Everyone eats every meal between arriving and leaving; the
                    meal as they arrive and as they leave counts only if they
                    said they would take it.
                  </p>
                )}
              </div>

              {people.length === 0 ? (
                <EmptyState
                  title="Nobody matches"
                  description="Remove a filter, or count more registrations (tap “Counting”)."
                />
              ) : (
                <section className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Segmented
                      label="Show"
                      value={report.view}
                      options={[
                        ["summary", "Breakdown"],
                        ["list", `List · ${number.format(list.rows.length)}`],
                      ]}
                      onChange={(view) => set({ view })}
                      className="sm:w-64"
                    />
                    {report.view === "summary" ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">By</span>
                        {dimensionSelect("Break down by", report.by, (value) =>
                          set({ by: value as Dimension })
                        )}
                        <span className="shrink-0">and</span>
                        {dimensionSelect(
                          "And across",
                          report.across,
                          (value) =>
                            set({ across: (value || undefined) as Dimension }),
                          "Nothing"
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Segmented
                          label="One row per"
                          value={report.mode}
                          options={[
                            ["people", "Per person"],
                            ["registrations", "Per registration"],
                          ]}
                          onChange={(mode) => set({ mode })}
                          className="flex-1 sm:flex-none"
                        />
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setColumnsOpen(true)}
                        >
                          <RiLayoutColumnLine />
                          Columns
                        </Button>
                      </div>
                    )}
                  </div>

                  {report.view === "summary" ? (
                    <BreakdownTable
                      breakdown={breakdown}
                      label={DIMENSIONS[report.by].label}
                      people={people.length}
                      registrations={registrationCount}
                    />
                  ) : (
                    <ListTable
                      list={list}
                      linkFirst={report.columns[0] === "code"}
                      limit={SHOWN_ROWS}
                      onOpen={(id) =>
                        setQuickView({
                          id,
                          queue: registrationIdsOf(list.rows),
                        })
                      }
                    />
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      <FilterPicker
        target={picker}
        onClose={() => setPicker(null)}
        filters={filters}
        report={report}
        dummyCount={dummyCount}
        onApply={set}
      />
      <RegistrationQuickView state={quickView} onChange={setQuickView} />
      <ColumnsDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        columns={report.columns}
        onChange={(columns) => set({ columns })}
      />
    </>
  )
}
