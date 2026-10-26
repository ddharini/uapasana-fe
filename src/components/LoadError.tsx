import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"

/** A screen's data did not load. Says why, and offers the one useful action. */
export function LoadError({
  title = "Could not load registrations",
  error,
  onRetry,
}: {
  title?: string
  error: Error | null
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <RiErrorWarningLine className="size-6 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs/relaxed text-muted-foreground">
          {error?.message ?? "Something went wrong."} Check your connection and
          try again.
        </p>
      </div>
      <Button variant="outline" size="lg" onClick={onRetry}>
        <RiRefreshLine />
        Try again
      </Button>
    </div>
  )
}
