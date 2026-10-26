import { RiCloseLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Button } from "@/components/ui/button"

/**
 * A centred modal, as compound parts.
 *
 * Hand-written for the same reason as the other primitives — the shadcn CLI
 * pinned by this project crashes on this Node — and kept deliberately small: a
 * backdrop, Escape, a scroll lock, and a focus trap good enough that Tab does
 * not wander onto the page behind the overlay.
 *
 * Split into parts rather than taking `title`/`children`/`footer` props because
 * a header is sometimes a string and sometimes an icon beside one, and a body
 * that scrolls independently of a pinned header and footer is the difference
 * between a long dialog working and not.
 */

const DialogContext = React.createContext<{ close: () => void }>({ close: () => {} })

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  React.useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
        return
      }
      if (event.key !== "Tab") return

      // Keep Tab inside the dialog. Without this, focus walks onto the page
      // behind the backdrop — still reachable by keyboard, entirely invisible.
      const panel = document.querySelector<HTMLElement>("[data-slot='dialog-content']")
      const focusable = panel?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  if (!open) return null

  return (
    <DialogContext.Provider value={{ close }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-background/70 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden
        />
        {children}
      </div>
    </DialogContext.Provider>
  )
}

export function DialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="dialog-content"
      role="dialog"
      aria-modal="true"
      className={cn(
        "relative flex max-h-[calc(100svh-2rem)] w-full max-w-md flex-col",
        "rounded-lg border border-border bg-card text-card-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DialogHeader({
  title,
  description,
}: {
  title: React.ReactNode
  description?: React.ReactNode
}) {
  const { close } = React.useContext(DialogContext)

  return (
    <div className="flex items-start justify-between gap-2 border-b border-border p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-heading text-sm font-medium">{title}</h2>
        {description && (
          <p className="text-xs/relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
        <RiCloseLine />
      </Button>
    </div>
  )
}

/** The scrolling middle. Header and footer stay put. */
export function DialogBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4", className)}>
      {children}
    </div>
  )
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border p-4",
        className
      )}
    >
      {children}
    </div>
  )
}
