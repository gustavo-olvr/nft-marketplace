import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCartItem, getCart, removeCartItem, updateCartItem } from '@/api/cart'
import { createQuote } from '@/api/quotes'
import type { Cart, Network, QuoteItemInput, UpdateCartItemRequest } from '@/contracts'
import { cartKeys } from './keys'

export const useCart = () => useQuery({ queryKey: cartKeys.all, queryFn: ({ signal }) => getCart(signal) })

export function useQuote(items: QuoteItemInput[], coupon: string | undefined, network: Network) {
  return useQuery({
    queryKey: cartKeys.quote(items, coupon, network),
    queryFn: ({ signal }) => createQuote({ items, coupon, network }, signal),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addCartItem,
    onSuccess: (cart) => {
      qc.setQueryData(cartKeys.all, cart)
      qc.invalidateQueries({ queryKey: cartKeys.quotes })
    },
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateCartItemRequest) => updateCartItem(id, body),
    onMutate: async ({ id, quantity }) => {
      await qc.cancelQueries({ queryKey: cartKeys.all })
      const previous = qc.getQueryData<Cart>(cartKeys.all)
      if (previous && quantity !== undefined) {
        qc.setQueryData<Cart>(cartKeys.all, {
          ...previous,
          items: previous.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(cartKeys.all, context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.all })
      qc.invalidateQueries({ queryKey: cartKeys.quotes })
    },
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeCartItem,
    onSuccess: (cart) => {
      qc.setQueryData(cartKeys.all, cart)
      qc.invalidateQueries({ queryKey: cartKeys.quotes })
    },
  })
}
