import { http } from './client'
import type { FavoritesResponse } from '@/contracts'

export async function getFavorites(signal?: AbortSignal): Promise<FavoritesResponse> {
  const { data } = await http.get<FavoritesResponse>('/favorites', { signal })
  return data
}

export async function addFavorite(nftId: string): Promise<FavoritesResponse> {
  const { data } = await http.put<FavoritesResponse>(`/favorites/${encodeURIComponent(nftId)}`)
  return data
}

export async function removeFavorite(nftId: string): Promise<FavoritesResponse> {
  const { data } = await http.delete<FavoritesResponse>(`/favorites/${encodeURIComponent(nftId)}`)
  return data
}
