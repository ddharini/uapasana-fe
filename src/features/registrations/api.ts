import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { changeKeys } from "@/features/logs/api"
import { useT } from "@/i18n/context"
import { ApiError, api } from "@/lib/api"

import type {
  NewRegistration,
  Registration,
  RegistrationStatus,
  RegistrationSummary,
} from "./types"

/**
 * Registration data from upasana-be, through React Query.
 *
 *   POST  /registrations              public; the devotee form and the desk
 *   GET   /registrations              staff
 *   GET   /registrations/:id          staff
 *   PATCH /registrations/:id/status   staff
 *   GET/POST/DELETE /admin/sample-data   admin; the dummy registrations
 */

const keys = {
  all: ["registrations"] as const,
  detail: (id: string) => ["registrations", id] as const,
}

/**
 * Rooms follow registrations: cancelling one, unticking accommodation or
 * removing someone frees beds on the server, so the accommodation data is
 * refreshed along with the registrations.
 */
const ACCOMMODATION = ["accommodation"] as const

/**
 * `poll`: refetch every so often — for screens volunteers keep open while
 * others register people (the Accommodation screen).
 */
/** Every registration the caller may see. Also loaded outside a hook (the Assistant). */
export const registrationsQuery = {
  queryKey: keys.all,
  queryFn: () => api.get<Registration[]>("/registrations"),
}

export function useRegistrations({ poll }: { poll?: boolean } = {}) {
  return useQuery({
    ...registrationsQuery,
    refetchInterval: poll ? 30_000 : undefined,
  })
}

/** Resolves to `null` for an id the server does not know, so the page can say "not found". */
export function useRegistration(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => {
      try {
        return await api.get<Registration>(`/registrations/${id}`)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}

/** How many dummy registrations are loaded. Only asked for on an admin's screen. */
export function useSampleData(enabled: boolean) {
  return useQuery({
    queryKey: ["sample-data"],
    queryFn: () =>
      api.get<{ count: number; total: number }>("/admin/sample-data"),
    enabled,
  })
}

/** Loads (`add`) or removes (`remove`) every dummy registration at once. */
export function useToggleSampleData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: "add" | "remove") =>
      action === "add"
        ? api.post<{ count: number }>("/admin/sample-data")
        : api.delete<{ count: number }>("/admin/sample-data"),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sample-data"] }),
        // Every list, detail and count of registrations changes.
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ACCOMMODATION }),
      ]),
  })
}

/** The WhatsApp confirmation goes in the language the form is shown in (English at the desk). */
export function useCreateRegistration() {
  const queryClient = useQueryClient()
  const { lang } = useT()
  return useMutation({
    mutationFn: (input: NewRegistration) =>
      api.post<Registration>("/registrations", { ...input, lang }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useSetRegistrationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RegistrationStatus }) =>
      api.patch<Registration>(`/registrations/${id}/status`, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all, exact: true }),
        // Cancelling frees their beds.
        queryClient.invalidateQueries({ queryKey: ACCOMMODATION }),
      ])
    },
  })
}

/**
 * Verifying the primary contact's mobile with a code sent on WhatsApp.
 *
 *   POST /otp/send     public
 *   POST /otp/verify   public; returns the token the registration carries
 */

export type OtpSent = {
  expiresInSeconds: number
  resendAfterSeconds: number
  /** Only in development, while WhatsApp is not set up on the server. */
  devCode?: string
}

/** The code arrives in the language the page is shown in (English on staff screens). */
export function useSendOtp() {
  const { lang } = useT()
  return useMutation({
    mutationFn: (mobile: string) =>
      api.post<OtpSent>("/otp/send", { mobile, lang }),
  })
}

export type OtpVerified = {
  verificationToken: string
  /** Registrations this number is already the contact for. */
  existing: RegistrationSummary[]
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (input: { mobile: string; code: string }) =>
      api.post<OtpVerified>("/otp/verify", input),
  })
}

/**
 * Registrations whose contact uses this number, for the desk's "already
 * registered" warning. `exclude` leaves out the one being edited. Only runs
 * with a full number.
 */
export function useRegistrationLookup(
  mobile: string | undefined,
  exclude?: string
) {
  return useQuery({
    queryKey: ["registrations", "lookup", mobile, exclude],
    queryFn: () =>
      api.get<RegistrationSummary[]>(
        `/registrations/lookup?${new URLSearchParams({ mobile: mobile!, ...(exclude ? { exclude } : {}) })}`
      ),
    enabled: !!mobile,
  })
}

/**
 * Public: whether a number is already some registration's contact. Yes or no
 * only — the devotee form learns which registration from a verified code.
 */
export function useNumberTaken(mobile: string | undefined) {
  return useQuery({
    queryKey: ["registrations", "taken", mobile],
    queryFn: () =>
      api.get<{ taken: boolean }>(
        `/registrations/taken?${new URLSearchParams({ mobile: mobile! })}`
      ),
    enabled: !!mobile,
  })
}

/** A team member editing a registration at the desk. Status is kept; the change is logged. */
export function useUpdateRegistration(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewRegistration) =>
      api.patch<Registration>(`/registrations/${id}`, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all, exact: true }),
        queryClient.invalidateQueries({ queryKey: changeKeys.all }),
        // Removing someone, or unticking their bed, frees it.
        queryClient.invalidateQueries({ queryKey: ACCOMMODATION }),
      ])
    },
  })
}

/** A devotee's own registrations, once their number is verified (the token is checked, not spent). */
export function useMyRegistrations(
  auth: { mobile: string; token: string } | undefined
) {
  return useQuery({
    queryKey: ["my-registrations", auth?.mobile, auth?.token],
    queryFn: () => api.post<Registration[]>("/registrations/mine", auth),
    enabled: !!auth,
  })
}

/** A devotee saving changes to their own registration; spends the OTP token. Status is kept; the change is logged. */
export function useUpdateOwnRegistration(id: string) {
  return useMutation({
    mutationFn: (input: NewRegistration) =>
      api.patch<Registration>(`/registrations/${id}/self`, input),
  })
}
