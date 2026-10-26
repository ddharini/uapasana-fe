import { toolLabel, type Card } from "./tools"

/**
 * The Assistant's stored conversation, as the screen shows it. Pure: no
 * React, no requests, so the redraw of a stored chat can be tested on its
 * own.
 */

/** A content block as the API has it. Only `type` and a few fields are read here. */
export type Block = { type: string; [key: string]: unknown }

export type CardEntry = { card: Card; title: string; shareKey?: string }

/** What the browser adds to a chat: a question, or tool results with their cards. */
export type NewMessage = {
  role: "user"
  content: string | Block[]
  cards?: Record<string, CardEntry>
}

/** A stored message, as GET /admin/assistant/chats/:id returns it. */
export type StoredMessage = {
  role: "user" | "assistant"
  content: string | Block[]
  cards?: Record<string, { card: Card; title: string }>
}

export type ChatItem =
  | { id: string; kind: "question"; text: string }
  | { id: string; kind: "answer"; text: string }
  | {
      id: string
      kind: "step"
      label: string
      state: "running" | "done" | "failed"
    }
  | { id: string; kind: "card"; card: Card }
  | { id: string; kind: "error"; message: string }

export const newId = () => crypto.randomUUID()

export const textOf = (blocks: Block[]) =>
  blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n\n")
    .trim()

/**
 * A stored chat as the admin sees it: the same items the live loop shows —
 * questions, answers, the tools that ran, and their cards.
 */
export function itemsOf(messages: StoredMessage[]): ChatItem[] {
  const items: ChatItem[] = []
  const steps = new Map<string, Extract<ChatItem, { kind: "step" }>>()
  for (const message of messages) {
    if (typeof message.content === "string") {
      if (message.role === "user")
        items.push({ id: newId(), kind: "question", text: message.content })
      continue
    }
    if (message.role === "assistant") {
      const answer = textOf(message.content)
      if (answer) items.push({ id: newId(), kind: "answer", text: answer })
      for (const b of message.content) {
        if (b.type !== "tool_use") continue
        const step = {
          id: newId(),
          kind: "step" as const,
          label: toolLabel(String(b.name), b.input),
          state: "failed" as "running" | "done" | "failed",
        }
        steps.set(String(b.id), step)
        items.push(step)
      }
      continue
    }
    const question = textOf(message.content)
    if (question) items.push({ id: newId(), kind: "question", text: question })
    for (const b of message.content) {
      if (b.type !== "tool_result") continue
      const id = String(b.tool_use_id)
      const step = steps.get(id)
      if (step) step.state = b.is_error ? "failed" : "done"
      const card = message.cards?.[id]?.card
      if (card) items.push({ id: newId(), kind: "card", card })
    }
  }
  return items
}
