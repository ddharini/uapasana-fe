import {
  RiArrowLeftLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiPlayLine,
  RiStopLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useParams, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  EmptyState,
  Progress,
  Skeleton,
} from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import {
  useBroadcast,
  useBroadcastAction,
  useBroadcastRecipients,
  type RecipientFilter,
} from "@/features/broadcasts/api"
import {
  BroadcastStatusBadge,
  MessageBubble,
  RecipientStatusBadge,
} from "@/features/broadcasts/components"
import {
  CATEGORY_NAMES,
  LANGUAGE_NAMES,
  renderBody,
  showNumber,
} from "@/features/broadcasts/format"
import { formatCreatedAt } from "@/features/registrations/format"

const number = new Intl.NumberFormat("en-IN")

const FILTER_LABELS: Record<RecipientFilter, string> = {
  pending: "Not sent yet",
  accepted: "Sent",
  delivered: "Delivered",
  read: "Read",
  undelivered: "Not delivered",
  failed: "Refused by WhatsApp",
}

/** A count with its label, in the row of totals. */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-heading text-lg font-semibold tabular-nums">
        {number.format(value)}
      </span>
      <span className="text-2xs text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * `/admin/messages/:id`: one send — how far it has got, how many arrived and
 * were read (from Meta's delivery reports), and each person's status. Admin
 * only. Refreshes every 5 seconds while sending.
 */
export function MessageDetail() {
  const id = useParams().id ?? ""
  const [params, setParams] = useSearchParams()
  const filterParam = params.get("status") ?? ""
  const filter =
    filterParam in FILTER_LABELS ? (filterParam as RecipientFilter) : undefined
  const page = Math.max(1, Number(params.get("page")) || 1)
  const setParam = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true, preventScrollReset: true }
    )

  const broadcast = useBroadcast(id)
  const sending = broadcast.data?.status === "sending"
  const recipients = useBroadcastRecipients(
    id,
    { status: filter, page },
    sending
  )
  const action = useBroadcastAction(id)
  const [confirmStop, setConfirmStop] = React.useState(false)

  const back = (
    <Link
      to="/admin/messages"
      className={buttonVariants({ variant: "ghost", size: "lg" })}
    >
      <RiArrowLeftLine />
      All sends
    </Link>
  )

  if (broadcast.isError) {
    return (
      <>
        <PageHeader title="Message" actions={back} />
        <LoadError
          title="Could not load this send"
          error={broadcast.error}
          onRetry={() => void broadcast.refetch()}
        />
      </>
    )
  }
  if (broadcast.isPending) {
    return (
      <>
        <PageHeader title="Message" actions={back} />
        <Skeleton className="h-72" />
      </>
    )
  }

  const b = broadcast.data
  const delivery = b.delivery ?? {}
  const delivered = (delivery.delivered ?? 0) + (delivery.read ?? 0)
  const notYetSent = b.total - b.accepted - b.failed
  const failed = b.failed + (delivery.failed ?? 0)
  const first = recipients.data?.recipients[0]
  const pages = recipients.data
    ? Math.max(1, Math.ceil(recipients.data.total / recipients.data.pageSize))
    : 1

  return (
    <>
      <PageHeader
        title={b.template}
        description={`${LANGUAGE_NAMES[b.language] ?? b.language} · ${CATEGORY_NAMES[b.category] ?? b.category} · ${formatCreatedAt(b.createdAt)} by ${b.createdByName}`}
        actions={back}
      />

      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BroadcastStatusBadge status={b.status} />
          <div className="flex gap-2">
            {b.status === "paused" && (
              <Button
                size="lg"
                disabled={action.isPending}
                onClick={() => action.mutate("resume")}
              >
                <RiPlayLine />
                Resume
              </Button>
            )}
            {(b.status === "sending" || b.status === "paused") &&
              (confirmStop ? (
                <>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setConfirmStop(false)}
                  >
                    Keep sending
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate("stop", {
                        onSuccess: () => setConfirmStop(false),
                      })
                    }
                  >
                    <RiStopLine />
                    Stop for good
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setConfirmStop(true)}
                >
                  <RiStopLine />
                  Stop
                </Button>
              ))}
          </div>
        </div>
        {b.status === "paused" && b.pauseReason && (
          <p className="rounded-md bg-amber-500/10 p-2.5 text-2xs/relaxed text-amber-800 dark:text-amber-300">
            Paused: {b.pauseReason}
          </p>
        )}
        {action.error && (
          <p role="alert" className="text-xs text-destructive">
            {action.error.message}
          </p>
        )}
        <Progress value={b.accepted + b.failed} max={b.total} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Numbers" value={b.total} />
          <Stat label="Sent" value={b.accepted} />
          <Stat label="Delivered" value={delivered} />
          <Stat label="Read" value={delivery.read ?? 0} />
          <Stat label="Failed" value={failed} />
        </div>
        <p className="text-2xs/relaxed text-muted-foreground">
          {notYetSent > 0 && b.status !== "cancelled"
            ? `${number.format(notYetSent)} still to send. `
            : ""}
          {b.status === "cancelled" && notYetSent > 0
            ? `${number.format(notYetSent)} were not sent. `
            : ""}
          Delivered and Read come from WhatsApp's reports and keep updating for
          a while; "Read" counts only people who have read receipts on.
        </p>
        {b.summary && (
          <p className="text-2xs/relaxed text-muted-foreground">
            Who: {b.summary}
          </p>
        )}
      </Card>

      <Card className="gap-2">
        <p className="text-2xs text-muted-foreground">
          The message{first ? `, as ${first.name} got it` : ""}:
        </p>
        <MessageBubble
          body={first ? renderBody(b.bodyText, first.values) : b.bodyText}
        />
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-sm font-medium">People</h2>
          <NativeSelect
            value={filter ?? ""}
            onChange={(e) => setParam({ status: e.target.value, page: "" })}
            aria-label="Show"
            className="sm:w-56"
          >
            <option value="">Everyone</option>
            {(Object.keys(FILTER_LABELS) as RecipientFilter[]).map((key) => (
              <option key={key} value={key}>
                {FILTER_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </div>

        {recipients.isError ? (
          <LoadError
            error={recipients.error}
            onRetry={() => void recipients.refetch()}
          />
        ) : recipients.isPending ? (
          <Skeleton className="h-48" />
        ) : recipients.data.recipients.length === 0 ? (
          <EmptyState
            title="Nobody here"
            description="No one in this send matches that. Choose Everyone to see the whole list."
          />
        ) : (
          <ul
            className={cn(
              "divide-y divide-border rounded-lg border border-border bg-card transition-opacity",
              recipients.isPlaceholderData && "opacity-60"
            )}
          >
            {recipients.data.recipients.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 px-4 py-2.5 text-2xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="flex min-w-0 flex-col">
                  <Link
                    to={`/registrations/${r.registrationId}`}
                    className="text-xs/relaxed font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {showNumber(r.to)}
                  </span>
                  {r.errorMessage && (
                    <span className="text-destructive">
                      {r.errorMessage}
                      {r.errorCode ? ` (${r.errorCode})` : ""}
                    </span>
                  )}
                </span>
                <RecipientStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav
            aria-label="Pages"
            className="flex items-center justify-between gap-2"
          >
            <Button
              variant="outline"
              size="lg"
              disabled={page <= 1 || recipients.isPlaceholderData}
              onClick={() =>
                setParam({ page: page - 1 > 1 ? String(page - 1) : "" })
              }
            >
              <RiArrowLeftSLine />
              Previous
            </Button>
            <span className="text-2xs text-muted-foreground tabular-nums">
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="lg"
              disabled={page >= pages || recipients.isPlaceholderData}
              onClick={() => setParam({ page: String(page + 1) })}
            >
              Next
              <RiArrowRightSLine />
            </Button>
          </nav>
        )}
      </section>
    </>
  )
}
