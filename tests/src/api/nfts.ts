import { http } from './client'
import type { Nft, NftListParams, NftListResponse } from '@/contracts'

function serializeParams(params: NftListParams): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, v))
    else sp.set(key, String(value))
  }
  return sp.toString()
}

export async function listNfts(params: NftListParams, signal?: AbortSignal): Promise<NftListResponse> {
  const { data } = await http.get<NftListResponse>('/nfts', {
    params,
    paramsSerializer: serializeParams,
    signal,
  })
  return data
}

export async function getNft(id: string, signal?: AbortSignal): Promise<Nft> {
  const { data } = await http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal })
  return data
}
