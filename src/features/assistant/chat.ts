import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import * as React from "react"

import { accommodationQuery } from "@/features/accommodation/api"
import { guestVisitsQuery } from "@/features/guests/api"
import { registrationsQuery } from "@/features/registrations/api"
import { ApiError, api } from "@/lib/api"
import { useSession } from "@/lib/auth-client"

import {
  itemsOf,
  newId,
  textOf,
  type Block,
  type CardEntry,
  type ChatItem,
  type NewMessage,
  type StoredMessage,
} from "./transcript"
import {
  TOOLS,
  TOOL_NEEDS,
  ToolInputError,
  cardTitle,
  runTool,
  shareKeyOf,
  toolLabel,
  type Card,
  type ToolData,
  type ToolDefaults,
} from "./tools"

export type { ChatItem }

export type Chat = {
  /** The stored chat; null until the first question. */
  chatId: string | null
  /** What the admin sees. */
  items: ChatItem[]
  busy: boolean
}

export type ChatSummary = {
  id: string
  title: string
  questions: number
  updatedAt: string
}

export type TeamAsk = {
  id: string
  question: string
  title: string
  card: Card
  askedByName: string
  askedAt: string
  timesAsked: number
}

/**
 * The Assistant's conversations, and the loop that drives them.
 *
 *   GET    /admin/assistant              set up? counting dummy data?
 *   POST   /admin/assistant              one turn of a chat (below)
 *   GET    /admin/assistant/chats        my chats, last used first (30 days)
 *   POST   /admin/assistant/chats        start one
 *   GET    /admin/assistant/chats/:id    one, to redraw it
 *   DELETE /admin/assistant/chats/:id
 *   GET    /admin/assistant/team         recently asked by the team
 *
 * Chats are stored on the server, private to each admin. A question goes up
 * on its own; the server adds it to the stored chat and asks the model. When
 * the reply asks for tools, they run here (tools.ts) and only their results —
 * with the cards they made — go back, until the model answers.
 *
 * The open chat is also kept outside React, so it carries on (and is still
 * there) when the admin opens a registration or a report and comes back, and
 * in sessionStorage, so a reload redraws it without a request. Keyed by who
 * is signed in, so another admin on the same tab starts clean.
 */

/** Model calls for one question. Each tool round is one; 8 is a lot. */
const MAX_ROUNDS = 8

/** The longest question; the server takes up to 4,000 characters. */
export const MAX_QUESTION = 2_000

const EMPTY: Chat = { chatId: null, items: [], busy: false }
const chats = new Map<string, Chat>()
const listeners = new Set<() => void>()

const storageKey = (userId: string) => `assistant-chat:${userId}`

const keys = {
  status: ["assistant", "status"] as const,
  chats: ["assistant", "chats"] as const,
  team: ["assistant", "team"] as const,
}

function load(userId: string): Chat {
  try {
    const saved = sessionStorage.getItem(storageKey(userId))
    if (saved) {
      const { chatId, items } = JSON.parse(saved) as Chat
      // A step still "running" was cut off by the reload.
      return {
        chatId: chatId ?? null,
        items: (items ?? []).map((item) =>
          item.kind === "step" && item.state === "running"
            ? { ...item, state: "failed" }
            : item
        ),
        busy: false,
      }
    }
  } catch {
    /* unreadable: start clean */
  }
  return EMPTY
}

function getChat(userId: string) {
  let chat = chats.get(userId)
  if (!chat) {
    chat = load(userId)
    chats.set(userId, chat)
  }
  return chat
}

function update(userId: string, change: (chat: Chat) => Partial<Chat>) {
  const chat = getChat(userId)
  const next = { ...chat, ...change(chat) }
  chats.set(userId, next)
  try {
    sessionStorage.setItem(
      storageKey(userId),
      JSON.stringify({ chatId: next.chatId, items: next.items })
    )
  } catch {
    /* full or blocked: the server still has the chat */
  }
  listeners.forEach((listener) => listener())
}

const pushItems = (userId: string, ...items: ChatItem[]) =>
  update(userId, (chat) => ({ items: [...chat.items, ...items] }))

const setStep = (userId: string, id: string, state: "done" | "failed") =>
  update(userId, (chat) => ({
    items: chat.items.map((item) =>
      item.id === id && item.kind === "step" ? { ...item, state } : item
    ),
  }))

/** The data the tools need, fresh to within a few seconds. */
async function loadData(
  queryClient: QueryClient,
  needs: Set<keyof ToolData>
): Promise<ToolData> {
  const fresh = { staleTime: 10_000 }
  const [registrations, guestVisits, accommodation] = await Promise.all([
    needs.has("registrations")
      ? queryClient.fetchQuery({ ...registrationsQuery, ...fresh })
      : [],
    needs.has("guestVisits")
      ? queryClient.fetchQuery({ ...guestVisitsQuery, ...fresh })
      : [],
    needs.has("accommodation")
      ? queryClient.fetchQuery({ ...accommodationQuery, ...fresh })
      : { places: [], mandalStays: [] },
  ])
  return { registrations, guestVisits, accommodation }
}

type Reply = { content: Block[]; stopReason: string | null }

async function ask(
  userId: string,
  question: string,
  queryClient: QueryClient,
  defaults: ToolDefaults
) {
  const text = question.trim().slice(0, MAX_QUESTION)
  if (!text || getChat(userId).busy) return

  update(userId, (chat) => ({
    busy: true,
    items: [...chat.items, { id: newId(), kind: "question", text }],
  }))

  try {
    let chatId = getChat(userId).chatId
    if (!chatId) {
      chatId = (await api.post<{ id: string }>("/admin/assistant/chats")).id
      update(userId, () => ({ chatId }))
    }

    let outgoing: NewMessage[] = [{ role: "user", content: text }]
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const reply = await api.post<Reply>("/admin/assistant", {
        chatId,
        messages: outgoing,
        tools: TOOLS,
      })

      const answer = textOf(reply.content)
      if (answer)
        pushItems(userId, { id: newId(), kind: "answer", text: answer })

      const uses = reply.content.filter(
        (b): b is Block & { id: string; name: string; input: unknown } =>
          b.type === "tool_use"
      )
      if (uses.length === 0) {
        if (!answer)
          pushItems(userId, {
            id: newId(),
            kind: "error",
            message:
              reply.stopReason === "refusal"
                ? "The Assistant can't help with that one. Try asking another way."
                : "The Assistant had nothing to say. Try asking another way.",
          })
        return
      }

      const steps = uses.map((use) => ({
        id: newId(),
        kind: "step" as const,
        label: toolLabel(use.name, use.input),
        state: "running" as const,
      }))
      pushItems(userId, ...steps)

      let data: ToolData | null = null
      let loadError: string | null = null
      try {
        data = await loadData(
          queryClient,
          new Set(uses.flatMap((use) => TOOL_NEEDS[use.name] ?? []))
        )
      } catch (cause) {
        loadError =
          cause instanceof Error
            ? cause.message
            : "The data could not be loaded."
      }

      // Every tool_use gets its result, in one message, failures included.
      const cards: Record<string, CardEntry> = {}
      const results: Block[] = uses.map((use, index) => {
        const step = steps[index]
        try {
          if (!data) throw new Error(`Could not load the data: ${loadError}`)
          const outcome = runTool(use.name, use.input, data, defaults)
          setStep(userId, step.id, "done")
          if (outcome.card) {
            pushItems(userId, { id: newId(), kind: "card", card: outcome.card })
            cards[use.id] = {
              card: outcome.card,
              title: cardTitle(outcome.card),
              shareKey: shareKeyOf(outcome.card),
            }
          }
          return {
            type: "tool_result",
            tool_use_id: use.id,
            content: JSON.stringify(outcome.result),
          }
        } catch (cause) {
          setStep(userId, step.id, "failed")
          if (!(cause instanceof ToolInputError)) console.error(cause)
          return {
            type: "tool_result",
            tool_use_id: use.id,
            is_error: true,
            content: cause instanceof Error ? cause.message : String(cause),
          }
        }
      })
      outgoing = [{ role: "user", content: results, cards }]
    }
    pushItems(userId, {
      id: newId(),
      kind: "error",
      message:
        "That took too many steps, so the Assistant stopped. Try a simpler question.",
    })
  } catch (cause) {
    // Deleted or expired on the server: the next question starts a new one.
    if (cause instanceof ApiError && cause.code === "CHAT_NOT_FOUND")
      update(userId, () => ({ chatId: null }))
    pushItems(userId, {
      id: newId(),
      kind: "error",
      message:
        cause instanceof ApiError
          ? cause.message
          : "Could not reach the server. Check the connection and try again.",
    })
  } finally {
    update(userId, () => ({ busy: false }))
    void queryClient.invalidateQueries({ queryKey: keys.chats })
    void queryClient.invalidateQueries({ queryKey: keys.team })
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAssistant() {
  const { data: session } = useSession()
  const userId = session?.user.id ?? "signed-out"
  const queryClient = useQueryClient()
  const status = useAssistantStatus()
  const defaults: ToolDefaults = {
    includeDummy: status.data?.includeDummy ?? false,
  }
  const chat = React.useSyncExternalStore(subscribe, () => getChat(userId))
  return {
    ...chat,
    ask: (question: string) =>
      void ask(userId, question, queryClient, defaults),
    reset: () => {
      if (getChat(userId).busy) return
      update(userId, () => ({ chatId: null, items: [] }))
    },
    /** Opens a stored chat to read or carry on. */
    open: async (id: string) => {
      if (getChat(userId).busy) return
      const stored = await api.get<{ messages: StoredMessage[] }>(
        `/admin/assistant/chats/${id}`
      )
      update(userId, () => ({ chatId: id, items: itemsOf(stored.messages) }))
    },
    remove: async (id: string) => {
      await api.delete(`/admin/assistant/chats/${id}`)
      if (getChat(userId).chatId === id && !getChat(userId).busy)
        update(userId, () => ({ chatId: null, items: [] }))
      void queryClient.invalidateQueries({ queryKey: keys.chats })
    },
  }
}

/**
 * Whether the server can answer at all (it has an Anthropic key), and
 * whether dummy registrations count by default (ASSISTANT_INCLUDE_DUMMY).
 */
export function useAssistantStatus() {
  return useQuery({
    queryKey: keys.status,
    queryFn: () =>
      api.get<{ configured: boolean; includeDummy: boolean }>(
        "/admin/assistant"
      ),
    staleTime: 5 * 60_000,
  })
}

/** My chats from the last 30 days, last used first. */
export function useAssistantChats({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: keys.chats,
    queryFn: () => api.get<ChatSummary[]>("/admin/assistant/chats"),
    enabled,
  })
}

/** Cards the team asked for lately, newest first. */
export function useTeamAsks() {
  return useQuery({
    queryKey: keys.team,
    queryFn: () => api.get<TeamAsk[]>("/admin/assistant/team"),
  })
}
