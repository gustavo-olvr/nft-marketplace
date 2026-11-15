import { http } from './client'
import type { AddCartItemRequest, Cart, MergeCartRequest, UpdateCartItemRequest } from '@/contracts'

export async function getCart(signal?: AbortSignal): Promise<Cart> {
  const { data } = await http.get<Cart>('/cart', { signal })
  return data
}

export async function addCartItem(body: AddCartItemRequest): Promise<Cart> {
  const { data } = await http.post<Cart>('/cart/items', body)
  return data
}

export async function updateCartItem(id: string, body: UpdateCartItemRequest): Promise<Cart> {
  const { data } = await http.patch<Cart>(`/cart/items/${encodeURIComponent(id)}`, body)
  return data
}

export async function removeCartItem(id: string): Promise<Cart> {
  const { data } = await http.delete<Cart>(`/cart/items/${encodeURIComponent(id)}`)
  return data
}

export async function mergeCart(body: MergeCartRequest): Promise<Cart> {
  const { data } = await http.post<Cart>('/cart/merge', body)
  return data
}
