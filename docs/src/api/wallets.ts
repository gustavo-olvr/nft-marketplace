import { http } from './client'
import type { UpsertWalletRequest, WalletsResponse } from '@/contracts'

export async function getWallets(signal?: AbortSignal): Promise<WalletsResponse> {
  const { data } = await http.get<WalletsResponse>('/wallets', { signal })
  return data
}

export async function connectWallet(id: string): Promise<WalletsResponse> {
  const { data } = await http.post<WalletsResponse>(`/wallets/${encodeURIComponent(id)}/connect`)
  return data
}

export async function disconnectWallet(id: string): Promise<WalletsResponse> {
  const { data } = await http.post<WalletsResponse>(`/wallets/${encodeURIComponent(id)}/disconnect`)
  return data
}

export async function createWallet(body: UpsertWalletRequest): Promise<WalletsResponse> {
  const { data } = await http.post<WalletsResponse>('/wallets', body)
  return data
}

export async function updateWallet(id: string, body: UpsertWalletRequest): Promise<WalletsResponse> {
  const { data } = await http.patch<WalletsResponse>(`/wallets/${encodeURIComponent(id)}`, body)
  return data
}
