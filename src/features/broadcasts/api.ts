import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Send messages: one WhatsApp template to many registered devotees. Admin only.
 *
 *   GET  /admin/broadcasts/templates
 *   POST /admin/broadcasts                 { …, dryRun? }
 *   GET  /admin/broadcasts                 ?page=
 *   GET  /admin/broadcasts/:id
 *   GET  /admin/broadcasts/:id/recipients  ?status=&page=
 *   POST /admin/broadcasts/:id/stop | /resume
 */

export type TemplateLanguage = {
  code: string
  header?: string
  body: string
  footer?: string
  buttons: string[]
  /** How many blanks the body has: {{1}} … {{n}}. */
  variables: number
}

export type Template = {
  name: string
  /** "UTILITY" | "MARKETING": decides the price. */
  category: string
  languages: TemplateLanguage[]
}

export type VariableSource =
  "name" | "firstName" | "dmNumber" | "registrationNumber" | "mandal" | "text"

export type VariableSpec =
  { source: Exclude<VariableSource, "text"> } | { source: "text"; text: string }

export type TemplateCatalogue = {
  templates: Template[]
  /** The template with a slot for free text: the "custom message". */
  announcement: string
  sources: Record<VariableSource, string>
  /** Rupees per message by category, before GST. */
  priceInr: Record<string, number>
  dailyLimit: number
  maxRecipients: number
  maxTextLength: number
}

export type Pick = { registrationId: string; memberId: string }

export type BroadcastInput = {
  template: string
  language: string
  variables: VariableSpec[]
  picks: Pick[]
  summary: string
}

export type Skipped = {
  noNumber: number
  duplicate: number
  invalid: number
  notFound: number
}

export type Estimate = {
  total: number
  skipped: Skipped
  category: string
  costInr: number
  dailyLimit: number
  /** The message as the first person will read it. */
  preview: string
  previewFor: string
}

export type BroadcastStatus = "sending" | "paused" | "done" | "cancelled"

export type Broadcast = {
  id: string
  template: string
  language: string
  category: string
  bodyText: string
  summary: string
  status: BroadcastStatus
  pauseReason?: string
  total: number
  accepted: number
  failed: number
  skipped: Skipped
  createdByName: string
  createdAt: string
  finishedAt?: string
  /** Counts by Meta's latest status: accepted, sent, delivered, read, failed. Detail only. */
  delivery?: Record<string, number>
}

export type RecipientStatus =
  "pending" | "failed" | "accepted" | "sent" | "delivered" | "read"

export type BroadcastRecipient = {
  id: string
  /** Country code and number, digits only. */
  to: string
  name: string
  registrationId: string
  values: string[]
  status: RecipientStatus
  errorCode?: number
  errorMessage?: string
  sentAt?: string
}

export type RecipientFilter =
  "pending" | "accepted" | "failed" | "delivered" | "read" | "undelivered"

const keys = {
  all: ["broadcasts"] as const,
  templates: ["broadcasts", "templates"] as const,
}

export function useTemplateCatalogue() {
  return useQuery({
    queryKey: keys.templates,
    queryFn: () => api.get<TemplateCatalogue>("/admin/broadcasts/templates"),
    staleTime: 60_000,
  })
}

/** Counts who would get it and what it costs. Nothing is saved or sent. */
export function useEstimate() {
  return useMutation({
    mutationFn: (input: BroadcastInput) =>
      api.post<Estimate>("/admin/broadcasts", { ...input, dryRun: true }),
  })
}

/** Starts sending. */
export function useSendBroadcast() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BroadcastInput) =>
      api.post<Estimate & { id: string }>("/admin/broadcasts", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

/** Refreshes every 5 s while any send on the page is still going. */
const whileSending = (sending: boolean) => (sending ? 5_000 : false)

export function useBroadcasts(page: number) {
  return useQuery({
    queryKey: [...keys.all, "list", page],
    queryFn: () =>
      api.get<{
        broadcasts: Broadcast[]
        total: number
        page: number
        pageSize: number
      }>(`/admin/broadcasts?page=${page}`),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      whileSending(
        !!query.state.data?.broadcasts.some((b) => b.status === "sending")
      ),
  })
}

export function useBroadcast(id: string) {
  return useQuery({
    queryKey: [...keys.all, id],
    queryFn: () => api.get<Broadcast>(`/admin/broadcasts/${id}`),
    // Delivery reports keep arriving for a while after the last send.
    refetchInterval: (query) =>
      query.state.data?.status === "sending" ? 5_000 : 30_000,
  })
}

export function useBroadcastRecipients(
  id: string,
  filters: { status?: RecipientFilter; page: number },
  sending: boolean
) {
  const params = new URLSearchParams({ page: String(filters.page) })
  if (filters.status) params.set("status", filters.status)
  return useQuery({
    queryKey: [...keys.all, id, "recipients", filters],
    queryFn: () =>
      api.get<{
        recipients: BroadcastRecipient[]
        total: number
        page: number
        pageSize: number
      }>(`/admin/broadcasts/${id}/recipients?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: sending ? 5_000 : 30_000,
  })
}

export function useBroadcastAction(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: "stop" | "resume") =>
      api.post<{ id: string }>(`/admin/broadcasts/${id}/${action}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
