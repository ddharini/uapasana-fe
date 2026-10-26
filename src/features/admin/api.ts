import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError, api } from "@/lib/api"

/**
 * The admin team and invites, from upasana-be.
 *
 *   GET    /admin/team             admin; current admins and pending invites
 *   POST   /admin/invites          admin; invite by email or mobile
 *   DELETE /admin/invites/:id      admin; revoke a pending invite
 *   GET    /invites/:token         public; what an invite link is for
 *   POST   /invites/:token/accept  signed in; take the invite
 */

/** A team member: an admin, or a sanchalak with their mandal. */
export type Admin = {
  id: string
  name: string
  email: string
  image: string | null
  role: TeamRole
  mandal: string | null
  createdAt: string
}

export type TeamRole = "admin" | "sanchalak"

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired"

export type Invite = {
  id: string
  channel: "email" | "mobile"
  email: string | null
  /** E.164, e.g. "+919876543210". */
  mobile: string | null
  name: string | null
  role: TeamRole
  /** For a sanchalak invite, the mandal they will coordinate. */
  mandal: string | null
  status: InviteStatus
  invitedByName: string
  expiresAt: string
  createdAt: string
}

type InviteRole = { name?: string; role: TeamRole; mandal?: string }

export type NewInvite =
  | ({ channel: "email"; email: string } & InviteRole)
  | ({ channel: "mobile"; mobile: string } & InviteRole)

export type CreatedInvite = {
  invite: Invite
  /** The link to share. Only ever returned here, at creation. */
  url: string
  /** Whether the server delivered it — by email, or on WhatsApp for a mobile invite. */
  sent: boolean
  /** Why it was not sent: the channel is not set up on the server, or the send failed. */
  notSentReason?: "not_configured" | "failed"
}

/** Which channels the server can deliver invites on right now. */
export type Delivery = { email: boolean; whatsapp: boolean }

/** What the invitee's landing page sees. */
export type InviteSummary = Pick<
  Invite,
  "status" | "channel" | "email" | "name" | "role" | "mandal" | "invitedByName" | "expiresAt"
>

const keys = {
  team: ["admin", "team"] as const,
  invite: (token: string) => ["invite", token] as const,
}

export function useAdminTeam() {
  return useQuery({
    queryKey: keys.team,
    queryFn: () =>
      api.get<{ admins: Admin[]; invites: Invite[]; delivery: Delivery }>("/admin/team"),
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewInvite) => api.post<CreatedInvite>("/admin/invites", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.team }),
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/admin/invites/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.team }),
  })
}

/** Resolves to `null` for a token the server does not know. */
export function useInvite(token: string) {
  return useQuery({
    queryKey: keys.invite(token),
    queryFn: async () => {
      try {
        return await api.get<InviteSummary>(`/invites/${encodeURIComponent(token)}`)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}

export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ role: string }>(`/invites/${encodeURIComponent(token)}/accept`),
  })
}
