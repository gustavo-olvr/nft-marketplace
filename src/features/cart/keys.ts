import type { Network, QuoteItemInput } from '@/contracts'

export const cartKeys = {
  all: ['cart'] as const,
  quotes: ['quote'] as const,
  quote: (items: QuoteItemInput[], coupon: string | undefined, network: Network) =>
    ['quote', { items, coupon, network }] as const,
}
