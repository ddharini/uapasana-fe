import { EVENT } from "@/config/event"
import { download, generatedAt, latin } from "@/features/reports/export"
import { formatMobile } from "@/lib/phone"

import {
  comingByText,
  displayName,
  formatIndiaFlight,
  formatStay,
  journeyHomeText,
} from "./format"
import { flightsOf, isSevak, travelOf, wantsBed } from "./stay"
import {
  GENDERS,
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  type Registration,
} from "./types"

/**
 * The Registrations list as a PDF: the same people as the CSV, but laid out to
 * be read and printed rather than sorted — one band per registration (the
 * party's details) with its people underneath, on landscape A4.
 *
 * The CSV's 34 columns cannot fit across a page, so the travel columns fold
 * into one cell per person and the yes/no columns into a Notes cell that only
 * says something when there is something to say.
 *
 * jsPDF is loaded only when someone exports, as in Reports.
 */

const HEADER = [
  "No.",
  "Name",
  "Gender, age",
  "Mobile",
  "Relation",
  "Arrives",
  "Leaves",
  "Travel",
  "Bed",
  "Notes",
]

/** Widths in points; Travel takes what is left of the page. */
const WIDTHS: Record<number, number> = {
  0: 58,
  1: 105,
  2: 52,
  3: 72,
  4: 62,
  5: 100,
  6: 100,
  8: 28,
  9: 92,
}

function travelCell(registration: Registration, index: number) {
  const member = registration.members[index]
  const travel = travelOf(registration, member)
  const flights = flightsOf(registration, member)
  return [
    comingByText(travel),
    travel.needsPickup && "Pickup",
    travel.needsDrop &&
      journeyHomeText(travel) &&
      `Home: ${journeyHomeText(travel)}`,
    travel.needsDrop && !journeyHomeText(travel) && "Drop",
    flights?.arrival && `Lands AMD: ${formatIndiaFlight(flights.arrival)}`,
    flights?.departure && `Flies out: ${formatIndiaFlight(flights.departure)}`,
  ]
    .filter(Boolean)
    .join("\n")
}

function notesCell(registration: Registration, index: number) {
  const member = registration.members[index]
  return [
    isSevak(registration, member) && "Swayam Sevak",
    member.needsAssistance &&
      `Assistance${member.assistanceNote ? `: ${member.assistanceNote}` : ""}`,
    member.attendsYouthConvention && "Youth Convention",
  ]
    .filter(Boolean)
    .join("\n")
}

/** The band above a registration's people: who they are as a party. */
function bandText(registration: Registration) {
  const count = registration.members.length
  const first = [
    registration.code,
    displayName(registration),
    REGISTRATION_TYPES[registration.type],
    registration.mandal,
    REGISTRATION_STATUSES[registration.status],
    `${count} ${count === 1 ? "person" : "people"}`,
  ].join("  ·  ")
  const vehicles = registration.travel.vehicleNumbers ?? []
  const verified =
    registration.mobileVerification === "otp"
      ? "Number confirmed by OTP"
      : registration.mobileVerification === "in_person"
        ? `Number confirmed in person${registration.verifiedByName ? ` by ${registration.verifiedByName}` : ""}`
        : ""
  const second = [
    vehicles.length > 0 && `Vehicles: ${vehicles.join(", ")}`,
    verified,
  ]
    .filter(Boolean)
    .join("  ·  ")
  return second ? `${first}\n${second}` : first
}

export async function downloadRegistrationsPdf(
  registrations: Registration[],
  /** The filters in words, one line each; empty for the whole list. */
  description: string[]
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const margin = 32
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const title = "Registrations"

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text(title, margin, margin + 8)
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
  for (const line of description) {
    const wrapped = doc.splitTextToSize(latin(line), pageWidth - margin * 2)
    doc.text(wrapped, margin, y)
    y += 11 * wrapped.length
  }

  const people = registrations.reduce((sum, r) => sum + r.members.length, 0)
  doc.setTextColor(20)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  y += 6
  doc.text(
    `${registrations.length} ${registrations.length === 1 ? "registration" : "registrations"} · ${people} ${people === 1 ? "person" : "people"}`,
    margin,
    y
  )

  // Cells hold several lines; `latin` would turn the line breaks into "?".
  const text = (value: string | number) =>
    String(value).split("\n").map(latin).join("\n")

  const band = {
    fillColor: 236,
    textColor: 20,
    fontStyle: "bold" as const,
    fontSize: 8.5,
  }
  const columns = {
    fillColor: 250,
    textColor: 90,
    fontStyle: "bold" as const,
    fontSize: 7,
  }
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY

  // One table per registration rather than one long table: with
  // `pageBreak: "avoid"` a registration that does not fit at the foot of a
  // page starts on the next, so a party's band is never left alone at the
  // bottom with its people overleaf. Only a party longer than a page splits,
  // and then its band and column names repeat on the new page.
  y += 12
  for (const r of registrations) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: margin, bottom: margin + 8 },
      head: [
        [{ content: text(bandText(r)), colSpan: HEADER.length, styles: band }],
        HEADER.map((label) => ({ content: label, styles: columns })),
      ],
      body: r.members.map((m, i) =>
        [
          m.code ?? "",
          m.fullName,
          `${GENDERS[m.gender]}, ${m.age}`,
          m.mobile ? formatMobile(m.mobile) : "",
          m.isPrimary ? "Primary contact" : (m.relation ?? ""),
          formatStay(m.arrival),
          formatStay(m.departure),
          travelCell(r, i),
          wantsBed(r, m) ? "Yes" : "No",
          notesCell(r, i),
        ].map(text)
      ),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: 220,
        lineWidth: 0.5,
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: Object.fromEntries(
        Object.entries(WIDTHS).map(([i, cellWidth]) => [i, { cellWidth }])
      ),
      pageBreak: "avoid",
      rowPageBreak: "avoid",
    })
    y = lastY() + 8
  }

  // Footers last, once the page count is known.
  const pages = doc.getNumberOfPages()
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.text(
      `${title} · page ${page} of ${pages}`,
      pageWidth - margin,
      pageHeight - 14,
      { align: "right" }
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  download({ blob: doc.output("blob"), name: `registrations-${stamp}.pdf` })
}
