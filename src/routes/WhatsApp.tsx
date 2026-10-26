import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiPhoneLine,
  RiSearchLine,
  RiWhatsappLine,
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
import { formatCreatedAt } from "@/features/registrations/format"
import {
  useReplies,
  useSentMessages,
  type MessageStatus,
  type Reply,
  type SentMessage,
} from "@/features/whatsapp/api"
import { formatMobile } from "@/lib/phone"

const TABS = { replies: "Replies", sent: "Sent" } as const
type Tab = keyof typeof TABS

const STATUS: Record<
  MessageStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  accepted: { label: "Sending", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  delivered: { label: "Delivered", variant: "default" },
  read: { label: "Read", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
}

/** The usage-ledger label a send was recorded under, as words. */
const PURPOSE: Record<string, string> = {
  "whatsapp:otp": "Verification code",
  "whatsapp:admin_invite": "Team invite",
  "whatsapp:stay-details": "Room details",
  "whatsapp:test": "Test",
}

const LANGUAGE: Record<string, string> = { en: "English", gu: "Gujarati" }

/** "919876543210" → "+91 98765 43210". */
const showNumber = (digits: string) => formatMobile(`+${digits}`)

/** The number, with call and WhatsApp links from the admin's own phone. */
function PhoneNumber({ digits }: { digits: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={`tel:+${digits}`}
        className="inline-flex items-center gap-1 text-primary tabular-nums hover:underline"
      >
        <RiPhoneLine className="size-3.5" />
        {showNumber(digits)}
      </a>
      <a
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${showNumber(digits)} from your own number`}
        title="Message from your own WhatsApp"
        className="inline-flex items-center text-primary hover:opacity-80"
      >
        <RiWhatsappLine className="size-3.5" />
      </a>
    </span>
  )
}

function RegistrationLink({
  registration,
}: {
  registration?: SentMessage["registration"]
}) {
  if (!registration) {
    return (
      <span className="text-2xs text-muted-foreground">
        Not a registered contact
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Link
        to={`/registrations/${registration.id}`}
        className="text-xs/relaxed font-medium hover:underline"
      >
        {registration.name ?? "Registration"}
      </Link>
      {registration.code && (
        <span className="font-mono text-2xs text-muted-foreground">
          {registration.code}
        </span>
      )}
    </span>
  )
}

function ReplyCard({ reply }: { reply: Reply }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <RegistrationLink registration={reply.registration} />
          <span className="flex flex-wrap items-center gap-x-2 text-2xs">
            {reply.profileName && (
              <span className="text-muted-foreground">
                {reply.profileName} ·
              </span>
            )}
            <PhoneNumber digits={reply.from} />
          </span>
        </div>
        <span className="text-3xs text-muted-foreground tabular-nums">
          {formatCreatedAt(reply.receivedAt)}
        </span>
      </div>
      {reply.text ? (
        <p className="text-xs/relaxed break-words whitespace-pre-wrap">
          {reply.text}
        </p>
      ) : (
        <p className="text-2xs/relaxed text-muted-foreground italic">
          A {reply.type} message: open WhatsApp on the devotee's number to see
          it.
        </p>
      )}
    </li>
  )
}

function SentRow({ message }: { message: SentMessage }) {
  const status = STATUS[message.status]
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-xs/relaxed font-medium">
            {PURPOSE[message.purpose] ?? message.template}
            <span className="text-2xs font-normal text-muted-foreground">
              {LANGUAGE[message.language] ?? message.language}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-2xs">
            <PhoneNumber digits={message.to} />
          </span>
          <RegistrationLink registration={message.registration} />
        </div>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-3xs text-muted-foreground tabular-nums">
            {formatCreatedAt(message.createdAt)}
          </span>
        </div>
      </div>
      {message.status === "failed" && (
        <p className="text-2xs/relaxed text-destructive">
          {message.errorMessage ?? "WhatsApp could not deliver it."}
          {message.errorCode ? ` (${message.errorCode})` : ""}
        </p>
      )}
    </li>
  )
}

function Pages({
  page,
  pages,
  busy,
  onPage,
}: {
  page: number
  pages: number
  busy: boolean
  onPage: (page: number) => void
}) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="lg"
        disabled={page <= 1 || busy}
        onClick={() => onPage(page - 1)}
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
        disabled={page >= pages || busy}
        onClick={() => onPage(page + 1)}
      >
        Older
        <RiArrowRightSLine />
      </Button>
    </nav>
  )
}

/**
 * `/admin/whatsapp`: messages devotees sent to our WhatsApp number (the
 * number lives on Meta's servers, so this is the only place they can be read),
 * and every message we sent with what became of it. Admin only. Both refresh
 * every 30 seconds.
 */
export function WhatsApp() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "sent" ? "sent" : "replies"
  const statusParam = params.get("status") ?? ""
  const status =
    statusParam in STATUS ? (statusParam as MessageStatus) : undefined
  const page = Math.max(1, Number(params.get("page")) || 1)
  const q = params.get("q") ?? ""

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
  const [query, setQuery] = React.useState(q)
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === q) return
    const timer = setTimeout(() => setParam({ q: trimmed, page: "" }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is rebuilt every render
  }, [query, q])

  const replies = useReplies({ q: q || undefined, page })
  const sent = useSentMessages({ status, q: q || undefined, page })
  const current = tab === "replies" ? replies : sent

  const goToPage = (next: number) => {
    setParam({ page: next > 1 ? String(next) : "" })
    window.scrollTo({ top: 0 })
  }

  const header = (
    <PageHeader
      title="WhatsApp"
      description="What devotees wrote to +91 93271 03949, and every message we sent with whether it arrived."
    />
  )

  const tabs = (
    <div
      role="tablist"
      aria-label="WhatsApp"
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
      {(Object.keys(TABS) as Tab[]).map((key) => (
        <button
          key={key}
          role="tab"
          type="button"
          aria-selected={tab === key}
          onClick={() =>
            setParam({
              tab: key === "replies" ? "" : key,
              status: "",
              page: "",
            })
          }
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2 text-xs/relaxed whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            tab === key && "border-primary font-medium text-foreground"
          )}
        >
          {TABS[key]}
          {key === "replies" && replies.data && (
            <span className="rounded-sm bg-muted px-1.5 text-3xs tabular-nums">
              {replies.data.total}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  if (current.isError) {
    return (
      <>
        {header}
        {tabs}
        <LoadError
          title="Could not load WhatsApp messages"
          error={current.error}
          onRetry={() => void current.refetch()}
        />
      </>
    )
  }

  const data = current.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const filtered = !!(q || (tab === "sent" && status))

  return (
    <>
      {header}
      <div className="flex flex-col gap-3">
        {tabs}
        <Card className="gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-3.5" />
              <Input
                type="search"
                inputMode="tel"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Number"
                aria-label="Search by number"
                className="pl-9 sm:pl-7"
              />
            </div>
            {tab === "sent" && (
              <NativeSelect
                value={status ?? ""}
                onChange={(e) => setParam({ status: e.target.value, page: "" })}
                aria-label="Status"
                className="sm:w-48"
              >
                <option value="">Any status</option>
                {(Object.keys(STATUS) as MessageStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {STATUS[value].label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
          <span className="text-2xs text-muted-foreground">
            {data &&
              (tab === "replies"
                ? `${data.total} ${data.total === 1 ? "message" : "messages"} from devotees`
                : `${data.total} sent`)}
          </span>
        </Card>

        {current.isPending ? (
          <Skeleton className="h-64" />
        ) : tab === "replies" && replies.data ? (
          replies.data.replies.length === 0 ? (
            <EmptyState
              title={filtered ? "No messages match" : "No messages yet"}
              description={
                filtered
                  ? "Try another number."
                  : "When a devotee writes to the event's WhatsApp number, it shows up here."
              }
            />
          ) : (
            <ul
              className={cn(
                "flex flex-col gap-2 transition-opacity",
                replies.isPlaceholderData && "opacity-60"
              )}
            >
              {replies.data.replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </ul>
          )
        ) : sent.data && sent.data.messages.length === 0 ? (
          <EmptyState
            title={filtered ? "Nothing matches" : "Nothing sent yet"}
            description={
              filtered
                ? "Try another number or status."
                : "Verification codes and other WhatsApp messages show up here once they are sent."
            }
          />
        ) : (
          sent.data && (
            <ul
              className={cn(
                "flex flex-col gap-2 transition-opacity",
                sent.isPlaceholderData && "opacity-60"
              )}
            >
              {sent.data.messages.map((message) => (
                <SentRow key={message.id} message={message} />
              ))}
            </ul>
          )
        )}

        <Pages
          page={page}
          pages={pages}
          busy={current.isPlaceholderData}
          onPage={goToPage}
        />
      </div>
    </>
  )
}
