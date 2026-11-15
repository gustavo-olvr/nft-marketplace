import { http } from './client'
import type { Quote, QuoteRequest } from '@/contracts'

export async function createQuote(body: QuoteRequest, signal?: AbortSignal): Promise<Quote> {
  const { data } = await http.post<Quote>('/quotes', body, { signal })
  return data
}
