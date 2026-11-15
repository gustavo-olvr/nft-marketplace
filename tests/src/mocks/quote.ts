import type { Network, Quote, QuoteItemInput, QuoteLine } from '@/contracts'
import { addEth, cmpEth, mulEth, pctEth, subEth, sumEth } from '@/lib/money'
import { db } from './db'
import { fnv } from './util'

const NETWORK_FEE: Record<Network, string> = { ethereum: '0.003', polygon: '0.0004', base: '0.0008' }
export const COUPONS = {
  WELCOME10: { bps: 1000, expired: false },
  EXPIRED20: { bps: 2000, expired: true },
} as const

export function buildQuote(
  items: QuoteItemInput[],
  coupon?: string,
  network: Network = 'ethereum',
  seen: Record<string, string> = {},
): Quote {
  const lines: QuoteLine[] = items.map((it) => {
    const nft = db().nfts.find((n) => n.id === it.nftId)
    const ed = nft?.editions.find((e) => e.id === it.editionId)
    if (!nft || !ed) {
      return {
        nftId: it.nftId,
        editionId: it.editionId,
        name: '—',
        editionLabel: '—',
        imageUrl: '',
        quantity: it.quantity,
        unitPrice: '0',
        lineTotal: '0',
        available: 0,
        maxPerOrder: 0,
        status: 'not_found' as const,
      }
    }
    let status: QuoteLine['status'] = 'ok'
    if (ed.available === 0) status = 'sold_out'
    else if (it.quantity > ed.available) status = 'insufficient'
    else if (it.quantity > ed.maxPerOrder) status = 'over_limit'
    else if (
      seen[`${it.nftId}:${it.editionId}`] &&
      cmpEth(seen[`${it.nftId}:${it.editionId}`]!, ed.price) !== 0
    )
      status = 'price_changed'
    return {
      nftId: nft.id,
      editionId: ed.id,
      name: nft.name,
      editionLabel: ed.label,
      imageUrl: nft.imageUrl,
      quantity: it.quantity,
      unitPrice: ed.price,
      lineTotal: mulEth(ed.price, it.quantity),
      available: ed.available,
      maxPerOrder: ed.maxPerOrder,
      status,
    }
  })
  const subtotal = sumEth(lines.map((l) => l.lineTotal))
  const code = coupon?.trim().toUpperCase() || null
  let couponResult: Quote['coupon'] = { code: null, status: 'none' }
  let discount = '0'
  if (code) {
    const c = COUPONS[code as keyof typeof COUPONS]
    if (!c) couponResult = { code, status: 'invalid', message: 'Cupom inválido' }
    else if (c.expired) couponResult = { code, status: 'expired', message: 'Cupom expirado' }
    else {
      couponResult = { code, status: 'applied' }
      discount = pctEth(subtotal, c.bps)
    }
  }
  const networkFee = lines.length ? NETWORK_FEE[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)
  const hash = fnv(
    JSON.stringify([
      lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice, l.status]),
      couponResult.status,
      discount,
      network,
      networkFee,
      total,
    ]),
  )
  return {
    hash,
    currency: 'ETH',
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon: couponResult,
    quotedAt: new Date().toISOString(),
  }
}
