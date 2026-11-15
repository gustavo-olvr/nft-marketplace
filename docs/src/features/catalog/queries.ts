import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { getNft, listNfts } from '@/api/nfts'
import type { NftListParams } from '@/contracts'
import { nftKeys } from './keys'

export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: nftKeys.list(params),
    queryFn: ({ signal }) => listNfts(params, signal),
    placeholderData: keepPreviousData,
  })

export const useNftList = (params: NftListParams) => useQuery(nftListQuery(params))

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: ({ signal }) => getNft(id, signal),
  })

export const useNft = (id: string) => useQuery(nftDetailQuery(id))
