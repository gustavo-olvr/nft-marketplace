import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { createOrder, getOrder } from '@/api/orders'
import type { CreateOrderRequest } from '@/contracts'
import { cartKeys } from '@/features/cart/keys'
import { idempotencyKeyFor } from './idempotency'
import { useRealtimeStatus } from '@/realtime/status'
import { orderKeys } from './keys'

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['create-order'],
    mutationFn: (body: CreateOrderRequest) => createOrder(body, idempotencyKeyFor(body)),
    onSuccess: (data) => qc.setQueryData(orderKeys.detail(data.order.id), data),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        qc.invalidateQueries({ queryKey: cartKeys.quotes })
        qc.invalidateQueries({ queryKey: cartKeys.all })
      }
    },
  })
}

export function useOrder(id: string) {
  const realtime = useRealtimeStatus()
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => getOrder(id, signal),
    refetchInterval: (query) =>
      query.state.data?.order.status === 'pending' && realtime !== 'connected' ? 2000 : false,
  })
}
