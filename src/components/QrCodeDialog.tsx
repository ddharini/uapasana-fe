import {
  RiDownloadLine,
  RiErrorWarningLine,
  RiPrinterLine,
} from "@remixicon/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/primitives"
import { EVENT } from "@/config/event"

/**
 * A public form's link as a QR code, for a poster at the mandir gate or a
 * slide at a sabha: whoever points a phone camera at it lands on the form.
 *
 * The code is drawn in the browser by the `qrcode` package, never by a QR web
 * service — those see (and can log or swap) every link they are given, and a
 * printed poster that points somewhere else is not something anyone notices
 * until devotees start registering on the wrong page.
 *
 * What the dialog shows is the exact image Download saves and Print prints: one
 * white card with the event name, the form's name, the code and the address
 * typed out underneath for anyone whose camera will not read it. Building it
 * once and showing the result means the screen cannot promise a poster the
 * file does not deliver.
 */
export function QrCodeDialog({
  open,
  onOpenChange,
  title,
  url,
  caption,
  fileName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The form's name, printed on the card, e.g. "Registration form". */
  title: string
  /** The full address the code opens. */
  url: string
  /** Extra lines under the code (another language, say). Optional. */
  caption?: string[]
  /** The downloaded file's name, without ".png". */
  fileName: string
}) {
  // The card is drawn from these inputs alone. Keying the result on them means
  // an image drawn for one form can never be shown (or downloaded) under
  // another's name, without resetting state inside the effect. `caption`
  // arrives as a fresh array on every render, so it is compared by content.
  const key = JSON.stringify([title, url, caption ?? []])
  const [card, setCard] = React.useState<{
    key: string
    image: string | null
    failed: boolean
  } | null>(null)
  const current = card?.key === key ? card : null
  const image = current?.image ?? null
  const failed = current?.failed ?? false

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    const [cardTitle, cardUrl, cardCaption] = JSON.parse(key) as [
      string,
      string,
      string[],
    ]
    drawCard({ title: cardTitle, url: cardUrl, caption: cardCaption })
      .then((dataUrl) => {
        if (!cancelled) setCard({ key, image: dataUrl, failed: false })
      })
      .catch(() => {
        if (!cancelled) setCard({ key, image: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [open, key])

  // A phone cannot open a localhost address: the code would scan and then
  // fail, which looks like a broken code rather than the wrong computer.
  const host = new URL(url).hostname
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")

  const download = () => {
    if (!image) return
    const link = document.createElement("a")
    link.href = image
    link.download = `${fileName}.png`
    link.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={`${title} QR code`}
          description="Scanning it with a phone camera opens the form. Download it for a poster or WhatsApp, or print it."
        />
        <DialogBody>
          {local && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-2xs/relaxed text-amber-800 dark:text-amber-300">
              <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
              <span>
                This code points at <b>{host}</b>, this computer, so a phone
                cannot open it. Make the QR code from the live website instead.
              </span>
            </div>
          )}
          {failed ? (
            <p className="text-xs/relaxed text-destructive">
              The QR code could not be drawn. Reload the page and try again.
            </p>
          ) : image ? (
            <img
              src={image}
              alt={`QR code that opens ${url}`}
              className="mx-auto w-full max-w-72 rounded-md border border-border"
            />
          ) : (
            <Skeleton className="mx-auto aspect-[4/5] w-full max-w-72" />
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            disabled={!image}
            onClick={() => image && printImage(image, title)}
          >
            <RiPrinterLine />
            Print
          </Button>
          <Button size="lg" disabled={!image} onClick={download}>
            <RiDownloadLine />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------------- */

const CARD_WIDTH = 1200
const QR_SIZE = 880
const PADDING = 80
const INK = "#111111"
const MUTED = "#555555"

/**
 * Draws the card on a canvas and returns it as a PNG data URL.
 *
 * 1200px wide is enough for an A4 poster at ~150dpi; the code itself is
 * scaled up crisply because `qrcode` draws it as whole-pixel modules.
 */
async function drawCard({
  title,
  url,
  caption,
}: {
  title: string
  url: string
  caption: string[]
}): Promise<string> {
  // Loaded here, not at the top of the file: only the team ever opens this
  // dialog, and the public form should not carry the encoder.
  const QRCode = await import("qrcode")

  // "M" survives a smudge or a fold on a printed sheet without making the
  // code so dense that an older phone struggles with it.
  const qr = document.createElement("canvas")
  await QRCode.toCanvas(qr, url, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: QR_SIZE,
    color: { dark: INK, light: "#ffffff" },
  })

  // The canvas uses whatever fonts the page has loaded; waiting stops the
  // first card of a visit from coming out in the fallback face.
  await document.fonts.ready
  const heading = "'Instrument Sans Variable', system-ui, sans-serif"
  const body = "system-ui, sans-serif"

  // Measure on a scratch context first: the card's height depends on how
  // many lines the title and caption wrap to.
  const measure = document.createElement("canvas").getContext("2d")!
  const textWidth = CARD_WIDTH - PADDING * 2

  measure.font = `500 44px ${heading}`
  const eventLines = wrap(measure, EVENT.name, textWidth)
  measure.font = `600 64px ${heading}`
  const titleLines = wrap(measure, title, textWidth)
  measure.font = `400 34px ${body}`
  const captionLines = [
    "Scan with your phone camera to open the form",
    ...caption,
  ].flatMap((line) => wrap(measure, line, textWidth))
  const urlFont = fitFont(measure, url, textWidth, 34, 20, body)

  const height =
    PADDING +
    eventLines.length * 56 +
    titleLines.length * 76 +
    48 +
    QR_SIZE +
    56 +
    captionLines.length * 48 +
    16 +
    56 +
    PADDING

  const canvas = document.createElement("canvas")
  canvas.width = CARD_WIDTH
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, CARD_WIDTH, height)
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  const centre = CARD_WIDTH / 2

  let y = PADDING
  ctx.fillStyle = MUTED
  ctx.font = `500 44px ${heading}`
  for (const line of eventLines) {
    ctx.fillText(line, centre, y)
    y += 56
  }
  ctx.fillStyle = INK
  ctx.font = `600 64px ${heading}`
  for (const line of titleLines) {
    ctx.fillText(line, centre, y)
    y += 76
  }
  y += 48

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, (CARD_WIDTH - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE)
  y += QR_SIZE + 56

  ctx.fillStyle = MUTED
  ctx.font = `400 34px ${body}`
  for (const line of captionLines) {
    ctx.fillText(line, centre, y)
    y += 48
  }
  y += 16

  ctx.fillStyle = INK
  ctx.font = urlFont
  ctx.fillText(url, centre, y)

  return canvas.toDataURL("image/png")
}

/** Breaks text into lines that fit `width`, on spaces. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * The address must stay on one line — broken across two, nobody can type it —
 * so it shrinks to fit instead of wrapping.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  largest: number,
  smallest: number,
  family: string
): string {
  for (let size = largest; size > smallest; size -= 2) {
    ctx.font = `500 ${size}px ${family}`
    if (ctx.measureText(text).width <= width) return ctx.font
  }
  return `500 ${smallest}px ${family}`
}

/**
 * Prints the card alone, through a hidden frame rather than a new window:
 * pop-up blockers stop a window opened after an await, and printing the page
 * itself would print the desk behind the dialog.
 */
function printImage(dataUrl: string, title: string) {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
  document.body.appendChild(frame)

  const doc = frame.contentDocument!
  doc.open()
  doc.write(`<!doctype html><html><head><title></title><style>
    @page { margin: 12mm; }
    html, body { margin: 0; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; }
    img { max-width: 100%; max-height: 100%; }
  </style></head><body><img alt=""></body></html>`)
  doc.close()
  doc.title = title

  const img = doc.querySelector("img")!
  img.onload = () => {
    frame.contentWindow!.focus()
    frame.contentWindow!.print()
    // Safari returns from print() before the sheet closes; removing the frame
    // at once would cancel the job.
    setTimeout(() => frame.remove(), 60_000)
  }
  img.src = dataUrl
}
