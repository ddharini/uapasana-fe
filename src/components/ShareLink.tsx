import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiWhatsappLine,
} from "@remixicon/react"
import * as React from "react"

import { Button, buttonVariants } from "@/components/ui/button"

/**
 * A public form's link, with the ways the team hands it on: copy, WhatsApp
 * and open. On the Registrations and Guests screens.
 */
export function ShareLink({
  title,
  description,
  path,
  whatsappText,
  openLabel,
}: {
  title: string
  description: string
  /** The form's path, e.g. "/register". */
  path: string
  /** The WhatsApp message; the link is added at its end. */
  whatsappText: string
  /** For screen readers: what the open button opens. */
  openLabel: string
}) {
  const url = `${window.location.origin}${path}`
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard refused (an http page, or permission denied): the link is
      // still one click away through "Open".
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs/relaxed font-medium">{title}</span>
        <span className="text-2xs/relaxed text-muted-foreground">
          {description}
        </span>
        {/* On its own line, cut short rather than broken mid-word: Copy
            gives the whole of it. */}
        <span title={url} className="truncate text-2xs/relaxed text-foreground">
          {url}
        </span>
      </div>
      {/* The buttons keep to one row; the text beside them wraps instead. */}
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="lg" onClick={copy}>
          {copied ? <RiCheckLine /> : <RiFileCopyLine />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${whatsappText}\n${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <RiWhatsappLine />
          Share
        </a>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          aria-label={openLabel}
          className={buttonVariants({ variant: "outline", size: "icon-lg" })}
        >
          <RiExternalLinkLine />
        </a>
      </div>
    </div>
  )
}
