import {
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiSearchLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import {
  useRegistrationChanges,
  type RegistrationChange,
} from "@/features/logs/api"
import { describeChange } from "@/features/logs/diff"
import { StatusBadge } from "@/features/registrations/components"
import { formatCreatedAt } from "@/features/registrations/format"

const BY_OPTIONS = { devotee: "Devotees", team: "Team" } as const

/** One saved edit: whose, when, and each field before → after. */
function ChangeCard({ change }: { change: RegistrationChange }) {
  const lines = describeChange(change.before, change.after)
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <Link
              to={`/registrations/${change.registrationId}`}
              className="text-xs/relaxed font-medium hover:underline"
            >
              {change.name}
            </Link>
            <span className="font-mono text-2xs text-muted-foreground">
              {change.code}
            </span>
            <StatusBadge status={change.status} />
          </span>
          <span className="text-2xs/relaxed text-muted-foreground">
            {change.mandal}
          </span>
        </div>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          {change.by === "devotee" ? (
            <Badge variant="info">By the devotee</Badge>
          ) : (
            <Badge variant="outline">By {change.byName ?? "the team"}</Badge>
          )}
          <span className="text-3xs text-muted-foreground tabular-nums">
            {formatCreatedAt(change.createdAt)}
          </span>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="text-2xs/relaxed text-muted-foreground">
          Saved without a change that shows here.
        </p>
      ) : (
        <ul className="-mx-4 divide-y divide-border border-t border-border">
          {lines.map((line, index) => (
            <li
              key={index}
              className="flex flex-col gap-0.5 px-4 py-2 text-2xs/relaxed sm:flex-row sm:gap-3"
            >
              <span className="shrink-0 font-medium sm:w-56">
                {line.label}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                {line.before !== undefined && (
                  <span
                    className={cn(
                      "text-muted-foreground",
                      line.after !== undefined && "line-through"
                    )}
                  >
                    {line.before}
                  </span>
                )}
                {line.before !== undefined && line.after !== undefined && (
                  <RiArrowRightLine
                    aria-label="changed to"
                    className="size-3.5 shrink-0 text-muted-foreground sm:size-3"
                  />
                )}
                {line.after !== undefined && <span>{line.after}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * `/admin/logs`: every change made to a registration after it was submitted
 * — by devotees online and by the team at the desk — newest first. Admin
 * only. `?registration=<id>` narrows it to one registration's history (the
 * link on a registration's page).
 */
export function Logs() {
  const [params, setParams] = useSearchParams()
  const by = params.get("by") ?? ""
  const registration = params.get("registration") ?? ""
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

  // The search box updates the list once typing pauses, not on every key.
  const [query, setQuery] = React.useState(params.get("q") ?? "")
  const q = params.get("q") ?? ""
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === q) return
    const timer = setTimeout(() => setParam({ q: trimmed, page: "" }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is rebuilt every render
  }, [query, q])

  const { data, isPending, isError, error, refetch, isPlaceholderData } =
    useRegistrationChanges({
      by: by === "devotee" || by === "team" ? by : undefined,
      q: q || undefined,
      registration: registration || undefined,
      page,
    })

  const header = (
    <PageHeader
      title="Change log"
      description="Every change made to a registration after it was submitted — by devotees online and by the team at the desk."
    />
  )

  if (isError) {
    return (
      <>
        {header}
        <LoadError
          title="Could not load the change log"
          error={error}
          onRetry={() => void refetch()}
        />
      </>
    )
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const filtered = !!(by || q || registration)
  const oneRegistration = registration && data?.changes[0]

  return (
    <>
      {header}

      <Card className="gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-3.5" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or code"
              aria-label="Search the change log"
              className="pl-9 sm:pl-7"
            />
          </div>
          <NativeSelect
            value={by}
            onChange={(e) => setParam({ by: e.target.value, page: "" })}
            aria-label="Made by"
            className="sm:w-48"
          >
            <option value="">Devotees and team</option>
            {Object.entries(BY_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-2xs text-muted-foreground">
            {data &&
              `${data.total} ${data.total === 1 ? "change" : "changes"}`}
          </span>
          {registration && (
            <span className="flex items-center gap-1.5 text-2xs">
              <span className="text-muted-foreground">
                Only{" "}
                {oneRegistration
                  ? `${oneRegistration.name} (${oneRegistration.code})`
                  : "one registration"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParam({ registration: "", page: "" })}
              >
                <RiCloseLine />
                Show all
              </Button>
            </span>
          )}
        </div>
      </Card>

      {isPending ? (
        <Skeleton className="h-64" />
      ) : data.changes.length === 0 ? (
        <EmptyState
          title={filtered ? "No changes match" : "No changes yet"}
          description={
            filtered
              ? "Try another search or filter."
              : "When a devotee or the team changes a registration after it was submitted, the change shows up here."
          }
        />
      ) : (
        <>
          <ul
            className={cn(
              "flex flex-col gap-2 transition-opacity",
              isPlaceholderData && "opacity-60"
            )}
          >
            {data.changes.map((change) => (
              <ChangeCard key={change.id} change={change} />
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
                onClick={() => {
                  setParam({ page: page - 1 > 1 ? String(page - 1) : "" })
                  window.scrollTo({ top: 0 })
                }}
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
                onClick={() => {
                  setParam({ page: String(page + 1) })
                  window.scrollTo({ top: 0 })
                }}
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
