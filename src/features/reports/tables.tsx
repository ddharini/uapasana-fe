import { cn } from "cn"
import * as React from "react"
import { Link } from "react-router"

import { registrationIdOf, type Breakdown, type ListRow } from "./model"

/**
 * A report's two views, shared by the Reports screen and the Assistant's
 * cards: the breakdown (counts by one dimension, or two as a grid) and the
 * list (a table from `md` up, a block per row on phones).
 */

const number = new Intl.NumberFormat("en-IN")

export function BreakdownTable({
  breakdown,
  label,
  people,
  registrations,
}: {
  breakdown: Breakdown
  /** What the rows are, e.g. "Mandal". */
  label: string
  people: number
  registrations: number
}) {
  const grid = breakdown.columns.length > 0
  const peak = Math.max(1, ...breakdown.rows.map((row) => row.people))
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs/relaxed tabular-nums">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{label}</th>
            {grid ? (
              breakdown.columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-right font-medium whitespace-nowrap"
                >
                  {column}
                </th>
              ))
            ) : (
              <th className="hidden w-full px-3 py-2 sm:table-cell">
                <span className="sr-only">Share</span>
              </th>
            )}
            <th className="px-3 py-2 text-right font-medium">People</th>
            {!grid && (
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                Registrations
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {breakdown.rows.map((row) => (
            <tr key={row.label}>
              <td className="px-3 py-2 whitespace-nowrap">{row.label}</td>
              {grid ? (
                row.cells.map((cell, index) => (
                  <td
                    key={breakdown.columns[index]}
                    className={cn(
                      "px-3 py-2 text-right",
                      cell === 0 && "text-muted-foreground/50"
                    )}
                  >
                    {number.format(cell)}
                  </td>
                ))
              ) : (
                <td className="hidden px-3 py-2 sm:table-cell">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(row.people / peak) * 100}%` }}
                    />
                  </div>
                </td>
              )}
              <td className="px-3 py-2 text-right font-medium">
                {number.format(row.people)}
              </td>
              {!grid && (
                <td className="px-3 py-2 text-right">
                  {number.format(row.registrations)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border font-medium">
          <tr>
            <td className="px-3 py-2">Total</td>
            {grid ? (
              breakdown.columnTotals.map((total, index) => (
                <td
                  key={breakdown.columns[index]}
                  className="px-3 py-2 text-right"
                >
                  {number.format(total)}
                </td>
              ))
            ) : (
              <td className="hidden sm:table-cell" />
            )}
            <td className="px-3 py-2 text-right">{number.format(people)}</td>
            {!grid && (
              <td className="px-3 py-2 text-right">
                {number.format(registrations)}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * Makes a row open its registration (`onOpen`): by click or tap, and by
 * keyboard — Tab to it, Enter or Space. The quick view opens over the list.
 */
const openable = (row: ListRow, onOpen?: (id: string) => void) =>
  onOpen && {
    role: "button",
    tabIndex: 0,
    "aria-label": `Open ${row.cells
      .slice(0, 2)
      .filter((c) => c !== "")
      .join(" · ")}`,
    onClick: () => onOpen(registrationIdOf(row)),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      onOpen(registrationIdOf(row))
    },
  }

const OPENABLE_ROW =
  "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

export function ListTable({
  list,
  linkFirst,
  limit,
  onOpen,
}: {
  list: { header: string[]; rows: ListRow[] }
  /** The first column is the registration code: link it to the registration. */
  linkFirst: boolean
  /** Rows drawn; the rest are left to the exports. */
  limit: number
  /** Rows open their registration in a popup, instead of the code linking away. */
  onOpen?: (registrationId: string) => void
}) {
  const rows = list.rows.slice(0, limit)
  return (
    <>
      {onOpen && (
        <p className="text-2xs text-muted-foreground">
          Tap a row to see it, call the contact, or check them in.
        </p>
      )}
      {/* Phones: a block per row, the first details as its heading. */}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border md:hidden">
        {rows.map((row) => (
          <li
            key={row.key}
            {...openable(row, onOpen)}
            className={cn(
              "flex flex-col gap-1 px-4 py-3",
              onOpen && OPENABLE_ROW
            )}
          >
            <span className="text-xs/relaxed font-medium">
              {row.cells
                .slice(0, 2)
                .filter((c) => c !== "")
                .join(" · ")}
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-2xs">
              {row.cells.slice(2).map((cell, index) =>
                cell === "" ? null : (
                  <React.Fragment key={list.header[index + 2]}>
                    <dt className="text-muted-foreground">
                      {list.header[index + 2]}
                    </dt>
                    <dd className="min-w-0 break-words">{cell}</dd>
                  </React.Fragment>
                )
              )}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-left text-xs/relaxed">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {list.header.map((label) => (
                <th
                  key={label}
                  className="px-3 py-2 font-medium whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.key}
                {...openable(row, onOpen)}
                className={cn(onOpen && OPENABLE_ROW)}
              >
                {row.cells.map((cell, index) => (
                  <td
                    key={list.header[index]}
                    className={cn(
                      "px-3 py-2",
                      typeof cell === "number"
                        ? "text-right tabular-nums"
                        : "max-w-64"
                    )}
                  >
                    {index === 0 && linkFirst && !onOpen ? (
                      <Link
                        to={`/registrations/${row.key.split(":")[0]}`}
                        className="font-medium whitespace-nowrap hover:underline"
                      >
                        {cell}
                      </Link>
                    ) : index === 0 && linkFirst ? (
                      <span className="font-medium whitespace-nowrap">
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.rows.length > limit && (
        <p className="text-2xs text-muted-foreground">
          Showing the first {limit} of {number.format(list.rows.length)}. The
          Excel and PDF have them all.
        </p>
      )}
    </>
  )
}
