import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type { AccommodationData, Allotment, Place, PlaceInput } from "./types"

/**
 * PAUSED 2026-10-11 — per-person allotment. The server routes these call are
 * commented out in upasana-be src/routes/accommodationRoutes.ts; the old
 * `GET /accommodation` became `GET /accommodation/allotments` there.
 *
 * Accommodation data from upasana-be, through React Query.
 *
 *   GET    /accommodation/allotments               desk roles; one mandal for a sanchalak
 *   POST   /accommodation/allotments               staff, admin
 *   POST   /accommodation/allotments/release       staff, admin
 *   POST   /accommodation/registrations/:id/notice staff, admin
 *   POST   /accommodation/notices/send-all         staff, admin
 *   POST/PATCH/DELETE /accommodation/places        admin
 *
 * Everything lives under one query: the screens need places, allotments and
 * notices together, and any change can touch all three.
 */

const key = ["accommodation", "allotments"] as const

/**
 * Polled: several volunteers allot at once, and a room another one just
 * filled should not keep looking free here.
 */
export function useAccommodation() {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get<AccommodationData>("/accommodation/allotments"),
    refetchInterval: 30_000,
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: key })
}

export function useAllot() {
  const refresh = useRefresh()
  return useMutation({
    /** A room for each person, saved together or not at all. */
    mutationFn: (input: {
      registrationId: string
      assignments: { memberId: string; placeId: string; roomId: string }[]
      /** Let them share a family room another registration has: relatives. */
      allowSharing?: boolean
    }) => api.post<Allotment[]>("/accommodation/allotments", input),
    // Also after a refusal: it usually means someone else just took the bed,
    // and the picker should show that.
    onSettled: refresh,
  })
}

export function useRelease() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: { registrationId: string; memberIds: string[] }) =>
      api.post<Allotment[]>("/accommodation/allotments/release", input),
    onSettled: refresh,
  })
}

export type NoticeResult =
  | { sent: true; channel: "whatsapp" | "manual" }
  /** WhatsApp is not set up on the server: send it from your own phone. */
  | { sent: false; message: string; whatsappUrl: string }

/** Sends one registration its room details; `manual` records one sent by hand. */
export function useSendNotice() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ registrationId, manual }: { registrationId: string; manual?: boolean }) =>
      api.post<NoticeResult>(`/accommodation/registrations/${registrationId}/notice`, {
        manual: !!manual,
      }),
    onSuccess: refresh,
  })
}

export function useSendAllNotices() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: number; failed: string[]; incomplete: number }>(
        "/accommodation/notices/send-all"
      ),
    onSuccess: refresh,
  })
}

/** A saved place as the editor sends it back, with its rooms replaced by `rooms`. */
export function asPlaceInput(place: Place, rooms: PlaceInput["rooms"] = place.rooms): PlaceInput {
  return {
    name: place.name,
    kind: place.kind,
    address: place.address,
    area: place.area,
    mapUrl: place.mapUrl,
    coordinatorName: place.coordinatorName,
    coordinatorMobile: place.coordinatorMobile,
    notes: place.notes,
    rooms,
  }
}

/** Adds a place (no `id`) or saves changes to one. */
export function useSavePlace(id?: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: PlaceInput) =>
      id
        ? api.patch<Place>(`/accommodation/places/${id}`, input)
        : api.post<Place>("/accommodation/places", input),
    onSuccess: refresh,
  })
}

export function useDeletePlace() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/accommodation/places/${id}`),
    onSuccess: refresh,
  })
}
