import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { connectWallet, createWallet, disconnectWallet, getWallets, updateWallet } from '@/api/wallets'
import type { UpsertWalletRequest } from '@/contracts'

export const walletKeys = { all: ['wallets'] as const }

export const useWallets = () =>
  useQuery({ queryKey: walletKeys.all, queryFn: ({ signal }) => getWallets(signal) })

export function useConnectWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: connectWallet,
    onSuccess: (data) => qc.setQueryData(walletKeys.all, data),
  })
}

export function useDisconnectWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: disconnectWallet,
    onSuccess: (data) => qc.setQueryData(walletKeys.all, data),
  })
}

export function useCreateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createWallet,
    onSuccess: (data) => qc.setQueryData(walletKeys.all, data),
  })
}

export function useUpdateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpsertWalletRequest) => updateWallet(id, body),
    onSuccess: (data) => qc.setQueryData(walletKeys.all, data),
  })
}
