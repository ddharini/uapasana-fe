import type { Row } from "write-excel-file/browser"

import { EVENT } from "@/config/event"

import type { Breakdown } from "./model"

/**
 * A report as a file: Excel (summary and list on two sheets) or a PDF
 * (landscape A4, summary first, then the list). The libraries are loaded only
 * when someone exports — they are bigger than the rest of the screen.
 */

export type ReportExport = {
  title: string
  /** The filters in words, one line each. */
  description: string[]
  people: number
  registrations: number
  /** Lines under the totals, e.g. walk-in guests for a meal. */
  extra: string[]
  breakdown: Breakdown
  /** What the breakdown is by, e.g. "Mandal" or "Mandal × Gender". */
  breakdownLabel: string
  list: { header: string[]; rows: (string | number)[][] }
}

const stamp = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const generatedAt = () =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date())

const fileName = (title: string, extension: string) =>
  `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "report"
  }-${stamp()}.${extension}`

/** The breakdown as a grid with a header row and a totals row. */
function breakdownTable(report: ReportExport) {
  const { breakdown } = report
  const grid = breakdown.columns.length > 0
  const header = grid
    ? [report.breakdownLabel, ...breakdown.columns, "Total"]
    : [report.breakdownLabel, "People", "Registrations"]
  const body = breakdown.rows.map((row) =>
    grid
      ? [row.label, ...row.cells, row.people]
      : [row.label, row.people, row.registrations]
  )
  const total = grid
    ? ["Total", ...breakdown.columnTotals, report.people]
    : ["Total", report.people, report.registrations]
  return { header, body, total }
}

export type ReportFile = { blob: Blob; name: string }

/** Saves the file through the browser's download. */
export function download({ blob, name }: ReportFile) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  // Some browsers start the download after this tick; give them a moment.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function excelFile(report: ReportExport): Promise<ReportFile> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser")

  const bold = (value: string | number) => ({
    value,
    fontWeight: "bold" as const,
  })
  const table = breakdownTable(report)

  const summary: Row[] = [
    [{ value: report.title, fontWeight: "bold", fontSize: 14 }],
    [`${EVENT.name} · generated ${generatedAt()}`],
    ...report.description.map((line) => [line]),
    [],
    [bold("People"), report.people],
    [bold("Registrations"), report.registrations],
    ...report.extra.map((line) => [line]),
    [],
    table.header.map(bold),
    ...table.body,
    table.total.map(bold),
  ]

  const list: Row[] = [report.list.header.map(bold), ...report.list.rows]
  const widths = (rows: Row[]) =>
    Array.from({ length: Math.max(...rows.map((r) => r.length)) }, (_, i) => ({
      width: Math.min(
        40,
        Math.max(
          8,
          ...rows.map((r) => {
            const cell = r[i]
            const value =
              cell && typeof cell === "object" && "value" in cell
                ? cell.value
                : cell
            return String(value ?? "").length + 2
          })
        )
      ),
    }))

  const blob = await writeXlsxFile([
    {
      data: summary,
      sheet: "Summary",
      // The first column holds the title and filter lines: keep it to the
      // width of the breakdown's labels.
      columns: widths([table.header, ...table.body]),
    },
    {
      data: list,
      sheet: "List",
      columns: widths(list),
      stickyRowsCount: 1,
    },
  ]).toBlob()
  return { blob, name: fileName(report.title, "xlsx") }
}

/**
 * PDF's built-in fonts only cover Latin-1, plus a few punctuation marks like
 * the en dash. Anything else would print as gibberish.
 */
const latin = <T extends string | number>(value: T): T =>
  typeof value === "number"
    ? value
    : ((value as string)
        .replace(/→/g, "->")
        .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, "?") as T)

export async function pdfFile(report: ReportExport): Promise<ReportFile> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const margin = 32
  const pageWidth = doc.internal.pageSize.getWidth()
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text(latin(report.title), margin, margin + 8)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(100)
  doc.text(
    latin(`${EVENT.name} · generated ${generatedAt()}`),
    pageWidth - margin,
    margin + 8,
    { align: "right" }
  )

  let y = margin + 26
  for (const line of report.description) {
    const wrapped = doc.splitTextToSize(latin(line), pageWidth - margin * 2)
    doc.text(wrapped, margin, y)
    y += 11 * wrapped.length
  }

  doc.setTextColor(20)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  y += 6
  doc.text(
    `${report.people} ${report.people === 1 ? "person" : "people"} · ${report.registrations} ${report.registrations === 1 ? "registration" : "registrations"}`,
    margin,
    y
  )
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  for (const line of report.extra) {
    y += 12
    doc.text(latin(line), margin, y)
  }

  const styles = {
    font: "helvetica",
    fontSize: 8,
    cellPadding: 3,
    lineColor: 220,
    lineWidth: 0.5,
  }
  // Counts sit to the right, like in a spreadsheet.
  const alignNumbers = (data: {
    cell: { raw: unknown; styles: { halign: string } }
  }) => {
    if (typeof data.cell.raw === "number") data.cell.styles.halign = "right"
  }
  const headStyles = {
    fillColor: 240,
    textColor: 30,
    fontStyle: "bold" as const,
  }

  const table = breakdownTable(report)
  autoTable(doc, {
    startY: y + 12,
    margin: { left: margin, right: margin },
    head: [table.header.map(latin)],
    body: table.body.map((row) => row.map(latin)),
    foot: [table.total.map(latin)],
    theme: "grid",
    styles,
    headStyles,
    footStyles: headStyles,
    showFoot: "lastPage",
    tableWidth: "wrap",
    didParseCell: alignNumbers,
  })

  if (report.list.rows.length > 0) {
    autoTable(doc, {
      startY: lastY() + 22,
      margin: { left: margin, right: margin, top: margin },
      head: [report.list.header.map(latin)],
      body: report.list.rows.map((row) => row.map(latin)),
      theme: "grid",
      styles: { ...styles, fontSize: 7.5, overflow: "linebreak" },
      headStyles,
      didParseCell: alignNumbers,
      didDrawPage: () => {
        const page = doc.getCurrentPageInfo().pageNumber
        doc.setFontSize(7.5)
        doc.setTextColor(120)
        doc.text(
          latin(`${report.title} · page ${page}`),
          pageWidth - margin,
          doc.internal.pageSize.getHeight() - 14,
          { align: "right" }
        )
      },
    })
  }

  return { blob: doc.output("blob"), name: fileName(report.title, "pdf") }
}
