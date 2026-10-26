import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * The WhatsApp screen: what we sent and what became of it, and what devotees
 * wrote back to our number. Admin only.
 *
 *   GET /admin/whatsapp/messages   ?status=&q=&page=
 *   GET /admin/whatsapp/replies    ?q=&page=
 */

export type MessageStatus =
  "accepted" | "sent" | "delivered" | "read" | "failed"

/** The registration whose contact the number is, when one matched. */
type LinkedRegistration = { id: string; code?: string; name?: string }

export type SentMessage = {
  id: string
  /** Country code and number, digits only. */
  to: string
  template: string
  language: string
  /** What it was for: "whatsapp:otp", "whatsapp:admin_invite"… */
  purpose: string
  status: MessageStatus
  errorCode?: number
  errorMessage?: string
  registration?: LinkedRegistration
  createdAt: string
  deliveredAt?: string
  readAt?: string
  failedAt?: string
}

export type Reply = {
  id: string
  /** Country code and number, digits only. */
  from: string
  /** The name on the sender's WhatsApp profile. */
  profileName?: string
  type: string
  /** The words, a button's label or a caption; absent for a sticker or a voice note. */
  text?: string
  registration?: LinkedRegistration
  receivedAt: string
}

type Page<K extends string, T> = { [key in K]: T[] } & {
  total: number
  page: number
  pageSize: number
}

const keys = {
  messages: ["whatsapp", "messages"] as const,
  replies: ["whatsapp", "replies"] as const,
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  return params
}

/** Polls every 30 s: delivery statuses keep arriving after a send. */
export function useSentMessages(filters: {
  status?: MessageStatus
  q?: string
  page: number
}) {
  return useQuery({
    queryKey: [...keys.messages, filters],
    queryFn: () =>
      api.get<Page<"messages", SentMessage>>(
        `/admin/whatsapp/messages?${query(filters)}`
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}

/** Polls every 30 s, so a reply shows up without a reload. */
export function useReplies(filters: { q?: string; page: number }) {
  return useQuery({
    queryKey: [...keys.replies, filters],
    queryFn: () =>
      api.get<Page<"replies", Reply>>(
        `/admin/whatsapp/replies?${query(filters)}`
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}
