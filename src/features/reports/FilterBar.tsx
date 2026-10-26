import {
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiCloseLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/choice"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { DigitsInput, Label } from "@/components/ui/input"
import {
  FILTER_GROUPS,
  FILTERS,
  STATUS_SETS,
  ageRangeLabel,
  parseAgeRange,
  parseRange,
  partySizeLabel,
  rangeValue,
  type Range,
  type Report,
  type StatusSet,
} from "@/features/reports/model"

/*
 * Choosing who a report is about: the chips for the filters that are on, and
 * the dialog that adds or changes one. Shared by Reports and Send messages, so
 * "everyone arriving by train from Surat" means the same people on both.
 */

type Filter = (typeof FILTERS)[number]

/** A filter that is on, as a chip: tap to change it, × to drop it. */
export function Chip({
  label,
  value,
  onEdit,
  onRemove,
}: {
  label: string
  value: string
  onEdit: () => void
  onRemove?: () => void
}) {
  return (
    <span className="inline-flex h-9 max-w-full items-center rounded-full border border-border bg-card text-xs sm:h-7">
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "flex h-full min-w-0 items-center gap-1 rounded-full pl-3 hover:bg-muted/60",
          onRemove ? "pr-1.5" : "pr-2.5"
        )}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="truncate font-medium">{value}</span>
        {!onRemove && (
          <RiArrowDownSLine className="size-3.5 text-muted-foreground" />
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="flex h-full items-center rounded-full pr-2.5 pl-1 text-muted-foreground hover:text-foreground"
        >
          <RiCloseLine className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/** The big option buttons in the filter picker. */
function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-md border border-border px-3 py-2 text-left text-xs/relaxed transition-colors hover:bg-muted/60 sm:min-h-8",
        selected && "border-primary bg-primary/5 font-medium text-primary"
      )}
    >
      {children}
    </button>
  )
}

/**
 * Any range, beside a range filter's fixed choices: age "From 80" for 80 and
 * over, party size "To 2" for 2 or fewer. Opens on the range already set.
 */
const RANGE_FORMS: Record<
  string,
  {
    noun: string
    parse: (value: string) => Range | null
    describe: (range: Range) => string
  }
> = {
  age: { noun: "age", parse: parseAgeRange, describe: ageRangeLabel },
  size: { noun: "people", parse: parseRange, describe: partySizeLabel },
}

function RangeForm({
  filterKey,
  value,
  onApply,
}: {
  filterKey: string
  value: string | undefined
  onApply: (value: string) => void
}) {
  const { noun, parse, describe } = RANGE_FORMS[filterKey]
  const current = value ? parse(value) : null
  const [from, setFrom] = React.useState(current?.min ? `${current.min}` : "")
  const [to, setTo] = React.useState(
    current && current.max !== Infinity ? `${current.max}` : ""
  )
  const range =
    from || to
      ? parseRange(from && !to ? `${Number(from)}+` : `${from}-${to}`)
      : null
  const invalid = (from !== "" || to !== "") && range == null

  return (
    <form
      className="flex flex-col gap-2 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (range) onApply(rangeValue(range))
      }}
    >
      <p className="text-xs/relaxed font-medium">Or any range</p>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`${filterKey}-from`}>From</Label>
          <DigitsInput
            id={`${filterKey}-from`}
            maxLength={3}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-invalid={invalid || undefined}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`${filterKey}-to`}>To</Label>
          <DigitsInput
            id={`${filterKey}-to`}
            maxLength={3}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Any"
            aria-invalid={invalid || undefined}
          />
        </div>
        <Button type="submit" size="lg" disabled={!range}>
          Apply
        </Button>
      </div>
      <p
        className={cn(
          "text-2xs/relaxed",
          invalid ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {invalid
          ? "“From” must not be more than “To”."
          : range
            ? `${describe(range)}, both ends counted.`
            : `Leave “To” empty for that ${noun === "age" ? "age" : "many"} and over.`}
      </p>
    </form>
  )
}

/**
 * Adding or changing a filter: first which one (grouped, only those not on
 * yet), then its value. Opened on a chip, it goes straight to the value.
 * "status" stands for which registrations count, with the dummy-data choice.
 */
export function FilterPicker({
  target,
  onClose,
  filters,
  report,
  dummyCount,
  onApply,
}: {
  /** null: closed. "": choose a filter first. */
  target: string | null
  onClose: () => void
  filters: Filter[]
  report: Report
  dummyCount: number
  onApply: (next: Partial<Report>) => void
}) {
  const [picked, setPicked] = React.useState<string | null>(null)
  // Each opening starts where it was opened: on a chip, or at the list.
  const [openedFor, setOpenedFor] = React.useState(target)
  if (openedFor !== target) {
    setOpenedFor(target)
    setPicked(target || null)
  }
  const key = picked
  const filter = filters.find((f) => f.key === key)

  const close = () => onClose()
  const choose = (value: string) => {
    onApply({ filters: { ...report.filters, [key!]: value } })
    close()
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-lg">
        {key === "status" ? (
          <>
            <DialogHeader title="Which registrations count" />
            <DialogBody>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(STATUS_SETS).map(([value, { label }]) => (
                  <OptionButton
                    key={value}
                    selected={report.status === value}
                    onClick={() => {
                      onApply({ status: value as StatusSet })
                      close()
                    }}
                  >
                    {label}
                  </OptionButton>
                ))}
              </div>
              {dummyCount > 0 && (
                <Checkbox
                  label={`Include the ${dummyCount} dummy registrations`}
                  description="Made-up data for demos. Leave it off for real numbers."
                  checked={report.dummy}
                  onChange={(e) => onApply({ dummy: e.target.checked })}
                />
              )}
            </DialogBody>
          </>
        ) : filter ? (
          <>
            <DialogHeader
              title={filter.label}
              description={
                target === "" ? (
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <RiArrowLeftLine className="size-3.5" />
                    All filters
                  </button>
                ) : undefined
              }
            />
            <DialogBody>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filter.options.map(([value, label]) => (
                  <OptionButton
                    key={value}
                    selected={report.filters[filter.key] === value}
                    onClick={() => choose(value)}
                  >
                    {label}
                  </OptionButton>
                ))}
              </div>
              {Object.hasOwn(RANGE_FORMS, filter.key) && (
                <RangeForm
                  filterKey={filter.key}
                  value={report.filters[filter.key]}
                  onApply={choose}
                />
              )}
            </DialogBody>
            {report.filters[filter.key] && (
              <DialogFooter>
                <Button variant="ghost" onClick={() => choose("")}>
                  Remove this filter
                </Button>
              </DialogFooter>
            )}
          </>
        ) : (
          <>
            <DialogHeader title="Add a filter" />
            <DialogBody className="gap-5">
              {(
                Object.entries(FILTER_GROUPS) as [
                  keyof typeof FILTER_GROUPS,
                  string,
                ][]
              ).map(([group, heading]) => {
                const available = filters.filter(
                  (f) =>
                    f.group === group &&
                    !report.filters[f.key] &&
                    f.options.length > 0
                )
                if (available.length === 0) return null
                return (
                  <section key={group} className="flex flex-col gap-1">
                    <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      {heading}
                    </h3>
                    <ul className="-mx-2 flex flex-col">
                      {available.map((f) => (
                        <li key={f.key}>
                          <button
                            type="button"
                            onClick={() => setPicked(f.key)}
                            className="flex h-11 w-full items-center justify-between rounded-md px-2 text-left text-xs hover:bg-muted sm:h-8"
                          >
                            {f.label}
                            <RiArrowRightSLine className="size-4 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
