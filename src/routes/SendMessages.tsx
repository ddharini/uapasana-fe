import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiSendPlaneLine,
} from "@remixicon/react"
import { cn } from "cn"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState, Progress, Skeleton } from "@/components/ui/primitives"
import { useBroadcasts, type Broadcast } from "@/features/broadcasts/api"
import { BroadcastStatusBadge } from "@/features/broadcasts/components"
import { LANGUAGE_NAMES } from "@/features/broadcasts/format"
import { formatCreatedAt } from "@/features/registrations/format"

const number = new Intl.NumberFormat("en-IN")

function BroadcastCard({ broadcast }: { broadcast: Broadcast }) {
  const done = broadcast.accepted + broadcast.failed
  return (
    <li>
      <Link
        to={`/admin/messages/${broadcast.id}`}
        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs/relaxed font-medium">
              {broadcast.template}
              <span className="ml-1.5 text-2xs font-normal text-muted-foreground">
                {LANGUAGE_NAMES[broadcast.language] ?? broadcast.language}
              </span>
            </span>
            <span className="line-clamp-2 text-2xs/relaxed text-muted-foreground">
              {broadcast.summary || "Everyone"}
            </span>
          </div>
          <div className="flex flex-col items-start gap-0.5 sm:items-end">
            <BroadcastStatusBadge status={broadcast.status} />
            <span className="text-3xs text-muted-foreground tabular-nums">
              {formatCreatedAt(broadcast.createdAt)} · {broadcast.createdByName}
            </span>
          </div>
        </div>
        <Progress value={done} max={broadcast.total} />
        <span className="text-2xs text-muted-foreground tabular-nums">
          {number.format(broadcast.accepted)} of{" "}
          {number.format(broadcast.total)} sent
          {broadcast.failed > 0 &&
            ` · ${number.format(broadcast.failed)} failed`}
        </span>
      </Link>
    </li>
  )
}

/**
 * `/admin/messages`: every WhatsApp message sent to many devotees at once,
 * newest first, and the way to send a new one. Admin only.
 */
export function SendMessages() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get("page")) || 1)
  const { data, isPending, isError, error, refetch, isPlaceholderData } =
    useBroadcasts(page)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const goTo = (next: number) => {
    setParams(next > 1 ? { page: String(next) } : {}, { replace: true })
    window.scrollTo({ top: 0 })
  }

  return (
    <>
      <PageHeader
        title="Send messages"
        description="Send a WhatsApp message to the devotees you pick, and see whether it arrived."
        actions={
          <Link
            to="/admin/messages/new"
            className={buttonVariants({ size: "lg" })}
          >
            <RiSendPlaneLine />
            New message
          </Link>
        }
      />

      {isError ? (
        <LoadError
          title="Could not load past sends"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <Skeleton className="h-64" />
      ) : data.broadcasts.length === 0 ? (
        <EmptyState
          title="Nothing sent yet"
          description="Messages you send to devotees show up here, with how many arrived and were read."
        />
      ) : (
        <>
          <ul
            className={cn(
              "flex flex-col gap-2 transition-opacity",
              isPlaceholderData && "opacity-60"
            )}
          >
            {data.broadcasts.map((broadcast) => (
              <BroadcastCard key={broadcast.id} broadcast={broadcast} />
            ))}
          </ul>
          {pages > 1 && (
            <nav
              aria-label="Pages"
              className="flex items-center justify-between gap-2"
            >
              <Button
                variant="outline"
                size="lg"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => goTo(page - 1)}
              >
                <RiArrowLeftSLine />
                Newer
              </Button>
              <span className="text-2xs text-muted-foreground tabular-nums">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="lg"
                disabled={page >= pages || isPlaceholderData}
                onClick={() => goTo(page + 1)}
              >
                Older
                <RiArrowRightSLine />
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  )
}
