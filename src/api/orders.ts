import { http } from './client'
import { IDEMPOTENCY_HEADER, type CreateOrderRequest, type OrderResponse } from '@/contracts'

export async function createOrder(body: CreateOrderRequest, idempotencyKey: string): Promise<OrderResponse> {
  const { data } = await http.post<OrderResponse>('/orders', body, {
    headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
  })
  return data
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<OrderResponse> {
  const { data } = await http.get<OrderResponse>(`/orders/${encodeURIComponent(id)}`, { signal })
  return data
}
