import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addFavorite, getFavorites, removeFavorite } from '@/api/favorites'
import type { FavoritesResponse } from '@/contracts'
import { getToken } from '@/lib/session-storage'

export const favoriteKeys = { all: ['favorites'] as const }

export const useFavorites = () =>
  useQuery({
    queryKey: favoriteKeys.all,
    queryFn: ({ signal }) => getFavorites(signal),
    enabled: getToken() !== null,
  })

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['toggle-favorite'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? addFavorite(nftId) : removeFavorite(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: favoriteKeys.all })
      const previous = qc.getQueryData<FavoritesResponse>(favoriteKeys.all)
      const current = previous?.nftIds ?? []
      qc.setQueryData<FavoritesResponse>(favoriteKeys.all, {
        nftIds: favorite ? [...new Set([...current, nftId])] : current.filter((id) => id !== nftId),
      })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(favoriteKeys.all, context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: favoriteKeys.all }),
  })
}
