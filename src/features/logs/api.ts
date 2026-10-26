import { keepPreviousData, useQuery } from "@tanstack/react-query"

import type {
  Registration,
  RegistrationStatus,
} from "@/features/registrations/types"
import { api } from "@/lib/api"

/**
 * The change log: edits made to registrations after they were submitted.
 *
 *   GET /admin/registration-changes   admin; ?by=&q=&registration=&page=
 */

/** The parts of a registration a form edit can change. */
export type RegistrationDetails = Pick<
  Registration,
  | "type"
  | "groupName"
  | "mandal"
  | "members"
  | "arrival"
  | "departure"
  | "travel"
  | "indiaTravel"
  | "accommodationRequired"
  | "earlySeva"
  | "notes"
>

export type RegistrationChange = {
  id: string
  registrationId: string
  code: string
  /** The family name, else the contact's name, after the edit. */
  name: string
  mandal: string
  /** The devotee online (after an OTP), or a team member at the desk (`byName`). */
  by: "devotee" | "team"
  byName?: string
  /** The status when the edit was saved; edits never change it. */
  status: RegistrationStatus
  before: RegistrationDetails
  after: RegistrationDetails
  createdAt: string
}

export type ChangeFilters = {
  by?: "devotee" | "team"
  q?: string
  /** One registration's history. */
  registration?: string
  page: number
}

type ChangePage = {
  changes: RegistrationChange[]
  total: number
  page: number
  pageSize: number
}

export const changeKeys = { all: ["registration-changes"] as const }

export function useRegistrationChanges(filters: ChangeFilters) {
  const params = new URLSearchParams()
  if (filters.by) params.set("by", filters.by)
  if (filters.q) params.set("q", filters.q)
  if (filters.registration) params.set("registration", filters.registration)
  params.set("page", String(filters.page))
  return useQuery({
    queryKey: [...changeKeys.all, filters],
    queryFn: () =>
      api.get<ChangePage>(`/admin/registration-changes?${params}`),
    // The previous page stays up while the next one loads.
    placeholderData: keepPreviousData,
  })
}
