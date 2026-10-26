import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError, api } from "@/lib/api"

/**
 * Walk-in guests, from upasana-be: friends or family a devotee invites for
 * the day, to attend and eat. Counted per day, not named one by one.
 *
 *   POST   /guests        public; the shared /guests/register link, and the desk
 *   GET    /guests        desk; every entry (a sanchalak's mandal only)
 *   GET    /guests/:id    desk
 *   PATCH  /guests/:id    desk; the whole entry
 *   DELETE /guests/:id    staff and admins
 *
 * Validation mirrors upasana-be/src/lib/guests.ts — change both together.
 */

/** Meals a day guest can take. Breakfast is not served to day guests. */
export const GUEST_MEALS = { lunch: "Lunch", dinner: "Dinner" } as const
export type GuestMeal = keyof typeof GUEST_MEALS

/** Most people one entry can bring on a day. */
export const MAX_GUESTS_PER_DAY = 50

export type GuestDay = {
  /** An event day, e.g. "2027-01-29". */
  date: string
  guests: number
  /** Empty: they only attend. */
  meals: GuestMeal[]
}

export type GuestVisit = {
  id: string
  hostName: string
  /** E.164. */
  hostMobile: string
  hostMandal: string
  guestNames: string | null
  /** In date order. */
  days: GuestDay[]
  notes: string | null
  /** "self" from the public link, "staff" from the desk. */
  source: "self" | "staff"
  editedAt: string | null
  editedByName: string | null
  createdAt: string
}

export type GuestVisitInput = Pick<
  GuestVisit,
  "hostName" | "hostMobile" | "hostMandal" | "days"
> & { guestNames?: string; notes?: string }

const keys = {
  all: ["guests"] as const,
  detail: (id: string) => ["guests", id] as const,
}

/** `enabled: false` holds off loading until a screen needs them (Reports, for a meal count). */
/** Every entry the caller may see. Also loaded outside a hook (the Assistant). */
export const guestVisitsQuery = {
  queryKey: keys.all,
  queryFn: () => api.get<GuestVisit[]>("/guests"),
}

export function useGuestVisits({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    ...guestVisitsQuery,
    enabled,
  })
}

/** Resolves to `null` for an id the server does not know, so the page can say "not found". */
export function useGuestVisit(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => {
      try {
        return await api.get<GuestVisit>(`/guests/${id}`)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}

function useGuestMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export const useCreateGuestVisit = () =>
  useGuestMutation((input: GuestVisitInput) =>
    api.post<GuestVisit>("/guests", input)
  )

export const useUpdateGuestVisit = () =>
  useGuestMutation(({ id, ...input }: GuestVisitInput & { id: string }) =>
    api.patch<GuestVisit>(`/guests/${id}`, input)
  )

export const useDeleteGuestVisit = () =>
  useGuestMutation((id: string) => api.delete<{ id: string }>(`/guests/${id}`))

/** Each event day's totals: people, and how many lunches and dinners. */
export function dayTotals(visits: GuestVisit[], days: readonly string[]) {
  return days.map((date) => {
    const total = { date, guests: 0, lunch: 0, dinner: 0, entries: 0 }
    for (const visit of visits) {
      const day = visit.days.find((d) => d.date === date)
      if (!day) continue
      total.entries += 1
      total.guests += day.guests
      if (day.meals.includes("lunch")) total.lunch += day.guests
      if (day.meals.includes("dinner")) total.dinner += day.guests
    }
    return total
  })
}

/** "Lunch & dinner", "Lunch", "No mahaprasad". */
export function formatMeals(meals: GuestMeal[]) {
  if (meals.length === 0) return "No mahaprasad"
  return meals
    .map((m, i) => (i === 0 ? GUEST_MEALS[m] : GUEST_MEALS[m].toLowerCase()))
    .join(" & ")
}
