import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type {
  AccommodationData,
  MandalStay,
  MandalStayInput,
  Place,
  PlaceInput,
} from "./types"

/**
 * Accommodation data from upasana-be, through React Query.
 *
 *   GET    /accommodation                              desk roles; one mandal for a sanchalak
 *   POST/PATCH/DELETE /accommodation/mandal-stays      staff, admin
 *   PUT    /accommodation/mandal-stays/:id/occupancy   staff, admin, the mandal's sanchalak
 *   POST/PATCH/DELETE /accommodation/places            admin
 *
 * Everything lives under one query: the screens need places and mandals'
 * rooms together. (Per-person allotment's hooks are in ./paused/api.ts.)
 */

const key = ["accommodation"] as const

/** Places and mandals' rooms. Also loaded outside a hook (the Assistant). */
export const accommodationQuery = {
  queryKey: key,
  queryFn: () => api.get<AccommodationData>("/accommodation"),
}

/** Polled, so occupancy a coordinator just reported shows up on the admin's screen. */
export function useAccommodation() {
  return useQuery({
    ...accommodationQuery,
    refetchInterval: 30_000,
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: key })
}

/** A saved place as the editor sends it back, with its rooms replaced by `rooms`. */
export function asPlaceInput(
  place: Place,
  rooms: PlaceInput["rooms"] = place.rooms
): PlaceInput {
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
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/accommodation/places/${id}`),
    onSuccess: refresh,
  })
}

/** Gives a mandal rooms at a place (no `id`), or changes them. */
export function useSaveMandalStay(id?: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: MandalStayInput) =>
      id
        ? api.patch<MandalStay>(`/accommodation/mandal-stays/${id}`, input)
        : api.post<MandalStay>("/accommodation/mandal-stays", input),
    // Also after a refusal: it usually means someone else just took a room,
    // and the picker should show that.
    onSettled: refresh,
  })
}

/** Takes all of a mandal's rooms at a place back. */
export function useDeleteMandalStay() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/accommodation/mandal-stays/${id}`),
    onSuccess: refresh,
  })
}

/** The coordinator's report: people in each of the mandal's rooms. */
export function useSaveOccupancy(id: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (rooms: { roomId: string; people: number }[]) =>
      api.put<MandalStay>(`/accommodation/mandal-stays/${id}/occupancy`, {
        rooms,
      }),
    onSettled: refresh,
  })
}
