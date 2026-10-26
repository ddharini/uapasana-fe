import {
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiChatNewLine,
  RiDeleteBinLine,
  RiHistoryLine,
  RiLoader4Line,
  RiTeamLine,
  RiSendPlane2Fill,
  RiSparkling2Line,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { PageHeader } from "@/components/layout/AppShell"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/input"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
import { EVENT, formatDay } from "@/config/event"
import { ResultCard } from "@/features/assistant/cards"
import {
  MAX_QUESTION,
  useAssistant,
  useAssistantChats,
  useAssistantStatus,
  useTeamAsks,
  type ChatItem,
} from "@/features/assistant/chat"

/**
 * The Assistant: admins ask in their own words — "who is coming by train on
 * the 29th, I need to arrange pickups" — and get the answer, with the list as
 * a card they can export or open on the Reports screen. Read-only.
 */

const [FIRST_DAY, SECOND_DAY] = EVENT.days
const LAST_DAY = EVENT.days[EVENT.days.length - 1]

const SUGGESTIONS = [
  `Who is arriving by train on ${formatDay(FIRST_DAY)}? I need to arrange pickups.`,
  "How many plates do we need for each meal, every day?",
  "Which devotees from abroad need an airport pickup?",
  `How many beds does each mandal need on the night of ${formatDay(SECOND_DAY)}?`,
  "List everyone who needs assistance, with a contact number.",
  `Who needs a drop to the station on ${formatDay(LAST_DAY)}?`,
  // Gujarati typed in English letters works too; the answer comes in English.
  `${Number(FIRST_DAY.slice(-2))} na train thi ketla loko avshe?`,
]

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/**
 * Cards the other admins asked for lately. Tapping one opens it right here
 * with today's numbers: no model call, nothing to wait for.
 */
function TeamAsks() {
  const { data: asks } = useTeamAsks()
  const [openId, setOpenId] = React.useState<string | null>(null)
  if (!asks?.length) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 font-heading text-base font-medium">
        <RiTeamLine className="size-4 text-primary" />
        Recently asked by the team
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {asks.map((ask) => {
          const open = openId === ask.id
          return (
            <li key={ask.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : ask.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs/relaxed font-medium">
                    {ask.title}
                  </span>
                  <span className="truncate text-2xs text-muted-foreground">
                    “{ask.question}”
                  </span>
                  <span className="text-3xs text-muted-foreground">
                    {ask.askedByName} · {ago(ask.askedAt)}
                    {ask.timesAsked > 1 ? ` · asked ${ask.timesAsked}×` : ""}
                  </span>
                </span>
                <RiArrowRightSLine
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-90"
                  )}
                />
              </button>
              {open && (
                <div className="px-2 pb-3 sm:px-4">
                  <ResultCard card={ask.card} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-2xs/relaxed text-muted-foreground">
        These open with today’s numbers, not the ones from when they were asked.
      </p>
    </section>
  )
}

/** My chats from the last 30 days: open one to read or carry on, or delete it. */
function HistoryDialog({
  open,
  onOpenChange,
  currentId,
  onPick,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentId: string | null
  onPick: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const {
    data: chats,
    isPending,
    isError,
  } = useAssistantChats({
    enabled: open,
  })
  const [working, setWorking] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const run = async (id: string, action: (id: string) => Promise<void>) => {
    setWorking(id)
    setError(null)
    try {
      await action(id)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That did not work. Try again."
      )
    } finally {
      setWorking(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title="Your chats"
          description="Only you see these. Each is kept for 30 days after you last used it."
        />
        <DialogBody>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {isPending ? (
            <Skeleton className="h-40" />
          ) : isError ? (
            <p className="text-xs text-destructive">
              Could not load your chats.
            </p>
          ) : !chats?.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No chats in the last 30 days.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {chats.map((chat) => (
                <li key={chat.id} className="flex items-center">
                  <button
                    type="button"
                    disabled={!!working}
                    onClick={() =>
                      void run(chat.id, async (id) => {
                        await onPick(id)
                        onOpenChange(false)
                      })
                    }
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                      chat.id === currentId && "bg-primary/5"
                    )}
                  >
                    <span className="truncate text-xs/relaxed font-medium">
                      {chat.title}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {chat.questions}{" "}
                      {chat.questions === 1 ? "question" : "questions"} ·{" "}
                      {working === chat.id ? "Opening…" : ago(chat.updatedAt)}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete “${chat.title}”`}
                    disabled={!!working}
                    onClick={() => void run(chat.id, onDelete)}
                    className="mr-1 text-muted-foreground"
                  >
                    <RiDeleteBinLine />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The little Markdown the Assistant writes: paragraphs, "- " and "1. "
 * lists, and **bold**. Anything else shows as typed.
 */
function Answer({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      )
    )

  const blocks: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let paragraph: string[] = []
  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push(
        <p key={blocks.length}>
          {paragraph.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {inline(line)}
            </React.Fragment>
          ))}
        </p>
      )
    paragraph = []
  }
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul"
      blocks.push(
        <Tag
          key={blocks.length}
          className={cn(
            "flex flex-col gap-1 pl-5",
            list.ordered ? "list-decimal" : "list-disc"
          )}
        >
          {list.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </Tag>
      )
    }
    list = null
  }

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
    } else if (line.trim() === "") {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line.replace(/^#+\s*/, ""))
    }
  }
  flushParagraph()
  flushList()

  return (
    <div className="flex flex-col gap-2 text-sm/relaxed sm:text-xs/relaxed">
      {blocks}
    </div>
  )
}

function Item({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case "question":
      return (
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3.5 py-2 text-sm/relaxed whitespace-pre-wrap sm:text-xs/relaxed">
            {item.text}
          </p>
        </div>
      )
    case "answer":
      return <Answer text={item.text} />
    case "step":
      return (
        <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          {item.state === "running" ? (
            <RiLoader4Line className="size-3.5 animate-spin" />
          ) : item.state === "done" ? (
            <RiCheckLine className="size-3.5 text-primary" />
          ) : (
            <RiAlertLine className="size-3.5 text-destructive" />
          )}
          {item.label}
        </p>
      )
    case "card":
      return <ResultCard card={item.card} />
    case "error":
      return (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-xs/relaxed text-destructive"
        >
          <RiAlertLine className="mt-0.5 size-3.5 shrink-0" />
          {item.message}
        </p>
      )
  }
}

export function Assistant() {
  const status = useAssistantStatus()
  const { chatId, items, busy, ask, reset, open, remove } = useAssistant()
  const [draft, setDraft] = React.useState("")
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  // Follow the conversation as it grows.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [items.length, busy])

  const send = (text: string) => {
    if (!text.trim() || busy) return
    ask(text)
    setDraft("")
  }

  const last = items.at(-1)
  const thinking = busy && !(last?.kind === "step" && last.state === "running")

  if (status.isPending) return <Skeleton className="h-72" />
  if (status.data && !status.data.configured)
    return (
      <>
        <PageHeader title="Assistant" />
        <EmptyState
          title="The Assistant is not set up yet"
          description="The server needs an Anthropic API key (ANTHROPIC_API_KEY in upasana-be/.env). Until then, the Reports screen has the same lists."
        />
      </>
    )

  return (
    <>
      <PageHeader
        title="Assistant"
        description={
          items.length === 0
            ? "Ask about devotees in your own words: who, how many, when. You get the answer and the list, ready for Excel or PDF."
            : undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => setHistoryOpen(true)}
            >
              <RiHistoryLine />
              History
            </Button>
            {items.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                disabled={busy}
                onClick={() => {
                  reset()
                  inputRef.current?.focus()
                }}
              >
                <RiChatNewLine />
                New chat
              </Button>
            )}
          </>
        }
      />
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        currentId={chatId}
        onPick={open}
        onDelete={remove}
      />

      {status.data?.includeDummy && (
        <p className="-mt-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
          <RiAlertLine className="mt-px size-3.5 shrink-0" />
          Testing mode: answers include the dummy registrations (switch off with
          ASSISTANT_INCLUDE_DUMMY on the server).
        </p>
      )}

      <div className="flex flex-1 flex-col gap-4">
        {items.length === 0 ? (
          <>
            <TeamAsks />
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-1.5 font-heading text-base font-medium">
                <RiSparkling2Line className="size-4 text-primary" />
                Try asking
              </h2>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => send(suggestion)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs/relaxed transition-colors hover:bg-muted/50"
                    >
                      <span className="flex-1">{suggestion}</span>
                      <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-2xs/relaxed text-muted-foreground">
                The Assistant only reads: it cannot change registrations, rooms
                or guests. Its numbers come from the same data as Reports. You
                can ask in Gujarati or Hindi too, in their own script or typed
                in English letters (“29 na ketla loko avshe?”). Your chats are
                kept for 30 days (History).
              </p>
            </section>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <Item key={item.id} item={item} />
            ))}
            {thinking && (
              <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <RiLoader4Line className="size-3.5 animate-spin" />
                Thinking…
              </p>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          send(draft)
        }}
        className="sticky bottom-(--bottom-nav-h) z-20 -mx-4 flex items-end gap-2 border-t border-border bg-background/95 px-4 pt-2 pb-[calc(0.5rem+var(--bottom-safe))] backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:p-2"
      >
        <Textarea
          ref={inputRef}
          aria-label="Ask the Assistant"
          placeholder="Ask about devotees, travel, meals, rooms…"
          value={draft}
          maxLength={MAX_QUESTION}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter (and the phone keyboard's return
            // while composing) makes a new line.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              send(draft)
            }
          }}
          className="max-h-40 min-h-10 resize-none border-0 focus-visible:ring-0 sm:min-h-8"
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Send"
          disabled={busy || !draft.trim()}
        >
          <RiSendPlane2Fill />
        </Button>
      </form>
    </>
  )
}
