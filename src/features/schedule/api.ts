import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * The event programme, from upasana-be.
 *
 * Admins edit a draft; Publish copies it to what devotees see. Devotees read
 * only the published copy, signed out.
 *
 *   GET    /schedule/published                        public; the published programme
 *   GET    /schedule                                  admin; the draft and its publish status
 *   POST   /schedule/publish                          admin; publish the draft
 *   POST   /schedule/days                             admin; add a day
 *   PATCH  /schedule/days/:id                         admin; change its date or theme
 *   DELETE /schedule/days/:id                         admin; remove it and its sessions
 *   POST   /schedule/days/:id/sessions                admin; add a session
 *   PATCH  /schedule/days/:id/sessions/:sessionId     admin; edit one
 *   DELETE /schedule/days/:id/sessions/:sessionId     admin; remove one
 *
 * Validation mirrors upasana-be/src/lib/schedule.ts — change both together.
 */

/** Built-in types. Any other `kind` is a custom type an admin named, stored as typed. */
export const SESSION_KINDS = ["sabha", "aarti", "prasad", "cultural"] as const
export type BuiltInKind = (typeof SESSION_KINDS)[number]

export type Session = {
  id: string
  /** 24-hour "HH:MM", venue time. */
  start: string
  end: string
  title: string
  /** A `BuiltInKind`, or a custom type's name, e.g. "Yoga Shibir". */
  kind: string
  /** Null when only a map link was given. */
  place: string | null
  /** A Google Maps link to the place. */
  mapUrl: string | null
  note: string | null
}

export type ScheduleDay = {
  id: string
  /** ISO calendar day at the venue. */
  date: string
  theme: string | null
  /** In time order, as the API returns them. */
  sessions: Session[]
}

/** A day as devotees get it: the published copy has no ids for days. */
export type PublishedDay = Omit<ScheduleDay, "id">

export type DraftState = {
  days: ScheduleDay[]
  /** The newest publish, or null before the first. */
  publication: { publishedAt: string; publishedByName: string } | null
  /** Whether the draft differs from what devotees see. */
  unpublishedChanges: boolean
}

export type DayInput = { date: string; theme?: string }
export type SessionInput = Omit<Session, "id" | "place" | "mapUrl" | "note"> & {
  place?: string
  mapUrl?: string
  note?: string
}

const key = ["schedule"] as const

export function useSchedule() {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get<DraftState>("/schedule"),
  })
}

/**
 * The published programme, for the public page. Checks again every two
 * minutes and whenever the devotee comes back to the tab, so a publish reaches
 * a page that is already open without anyone reloading it.
 */
export function usePublishedSchedule() {
  return useQuery({
    queryKey: ["schedule", "published"],
    queryFn: () =>
      api.get<{ days: PublishedDay[]; publishedAt: string | null }>(
        "/schedule/published"
      ),
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
  })
}

export function usePublishSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<DraftState>("/schedule/publish"),
    onSuccess: (state) => queryClient.setQueryData(key, state),
  })
}

/** Every write refetches the whole schedule: it is small, and days re-sort when a date changes. */
function useScheduleMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    // `exact`: the published copy only changes on publish, not on every edit.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: key, exact: true }),
  })
}

export const useCreateDay = () =>
  useScheduleMutation((input: DayInput) =>
    api.post<ScheduleDay>("/schedule/days", input)
  )

export const useUpdateDay = () =>
  useScheduleMutation(({ id, ...input }: DayInput & { id: string }) =>
    api.patch<ScheduleDay>(`/schedule/days/${id}`, input)
  )

export const useDeleteDay = () =>
  useScheduleMutation((id: string) =>
    api.delete<{ id: string }>(`/schedule/days/${id}`)
  )

export const useCreateSession = () =>
  useScheduleMutation(({ dayId, ...input }: SessionInput & { dayId: string }) =>
    api.post<ScheduleDay>(`/schedule/days/${dayId}/sessions`, input)
  )

export const useUpdateSession = () =>
  useScheduleMutation(
    ({ dayId, id, ...input }: SessionInput & { dayId: string; id: string }) =>
      api.patch<ScheduleDay>(`/schedule/days/${dayId}/sessions/${id}`, input)
  )

export const useDeleteSession = () =>
  useScheduleMutation(({ dayId, id }: { dayId: string; id: string }) =>
    api.delete<ScheduleDay>(`/schedule/days/${dayId}/sessions/${id}`)
  )
