import { RiExternalLinkLine } from "@remixicon/react"
import { cn } from "cn"

import { Badge } from "@/components/ui/primitives"

import type { BroadcastStatus, RecipientStatus } from "./api"

/** The message as it will look on a phone: header, body, footer, buttons. */
export function MessageBubble({
  header,
  body,
  footer,
  buttons = [],
  className,
}: {
  header?: string
  body: string
  footer?: string
  buttons?: string[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-[#e7f6e0] p-3 text-[#111b21] dark:bg-[#1f3a2b] dark:text-[#e9edef]",
        className
      )}
    >
      <div className="max-w-md overflow-hidden rounded-md bg-white shadow-sm dark:bg-[#202c33]">
        <div className="flex flex-col gap-1.5 px-3 py-2">
          {header && <p className="text-xs font-semibold">{header}</p>}
          <p className="text-xs/relaxed break-words whitespace-pre-wrap">
            {body}
          </p>
          {footer && <p className="text-2xs text-[#667781]">{footer}</p>}
        </div>
        {buttons.map((label) => (
          <div
            key={label}
            className="flex items-center justify-center gap-1 border-t border-black/10 py-2 text-xs text-[#00a5f4] dark:border-white/10"
          >
            <RiExternalLinkLine className="size-3.5" />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

const BROADCAST_STATUS: Record<
  BroadcastStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  sending: { label: "Sending", variant: "info" },
  paused: { label: "Paused", variant: "warning" },
  done: { label: "Finished", variant: "success" },
  cancelled: { label: "Stopped", variant: "outline" },
}

export function BroadcastStatusBadge({ status }: { status: BroadcastStatus }) {
  const { label, variant } = BROADCAST_STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}

const RECIPIENT_STATUS: Record<
  RecipientStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  pending: { label: "Not sent yet", variant: "outline" },
  accepted: { label: "Sending", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  delivered: { label: "Delivered", variant: "default" },
  read: { label: "Read", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const { label, variant } = RECIPIENT_STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}
