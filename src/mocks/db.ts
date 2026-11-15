import type { CartItem, Nft, Order, Wallet } from '@/contracts'
import { fromWei, toWei } from '@/lib/money'
import { buildUsers, deriveNft, seedNfts, seedWallets, type DbUser } from './fixtures'
import { createEmitter } from './util'

export interface StoredOrder {
  order: Order
  ownerId: string
  outcome: 'confirm' | 'reject'
  settleAt: number
}
export interface DbState {
  users: DbUser[]
  sessions: Record<string, { userId: string; expiresAt: number }>
  expiredTokens: string[]
  nfts: Nft[]
  favorites: Record<string, string[]>
  carts: Record<string, { version: number; items: CartItem[] }>
  wallets: Record<string, Wallet[]>
  orders: StoredOrder[]
  idempotency: Record<string, { bodyHash: string; orderId: string }>
  counters: Record<string, number>
  flags: Record<string, boolean>
  seq: number
}

export type DbEvent =
  | { type: 'nft.updated'; nft: Nft }
  | { type: 'order.updated'; userId: string; order: Order }
  | { type: 'session.revoked'; userId: string }
  | { type: 'reset' }
export const events = createEmitter<DbEvent>()

const KEY = 'jg.mock.db.v1'
const users = await buildUsers()

export function createSeed(): DbState {
  return {
    users: structuredClone(users),
    sessions: {},
    expiredTokens: [],
    nfts: seedNfts(),
    favorites: {},
    carts: {},
    wallets: seedWallets(),
    orders: [],
    idempotency: {},
    counters: {},
    flags: {},
    seq: 1,
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DbState
  } catch {}
  return createSeed()
}
let state: DbState = load()

export const db = () => state
export function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
}
export function resetDb() {
  state = createSeed()
  commit()
  events.emit({ type: 'reset' })
}

export const nextId = (prefix: string) => `${prefix}_${state.seq++}`
export const bump = (counter: string) => (state.counters[counter] = (state.counters[counter] ?? 0) + 1)

export function mutateNft(nftId: string, editionId: string, patch: { price?: string; available?: number }) {
  const nft = state.nfts.find((n) => n.id === nftId)
  const ed = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !ed) return
  if (patch.price !== undefined) ed.price = patch.price
  if (patch.available !== undefined) ed.available = Math.max(0, patch.available)
  nft.version += 1
  nft.updatedAt = new Date().toISOString()
  deriveNft(nft)
  commit()
  events.emit({ type: 'nft.updated', nft: structuredClone(nft) })
}

export const bumpPrice = (nftId: string, editionId: string, pct: number) => {
  const ed = state.nfts.find((n) => n.id === nftId)?.editions.find((e) => e.id === editionId)
  if (ed) mutateNft(nftId, editionId, { price: fromWei((toWei(ed.price) * BigInt(100 + pct)) / 100n) })
}

export function settleDue(now = Date.now()) {
  for (const s of state.orders) {
    if (s.order.status !== 'pending' || now < s.settleAt) continue
    s.order.version += 1
    s.order.updatedAt = new Date(now).toISOString()
    if (s.outcome === 'reject') {
      s.order.status = 'rejected'
      s.order.rejectionReason = 'Pagamento recusado pela carteira (simulação)'
    } else {
      s.order.status = 'confirmed'
      s.order.txHash = `0x${s.order.id.replace(/\D/g, '').padStart(8, '0')}${'ab12'.repeat(14)}`.slice(0, 66)
      s.order.explorerUrl = `https://explorer.mock/tx/${s.order.txHash}`
      const cart = state.carts[`u:${s.ownerId}`]
      for (const l of s.order.snapshot.lines) {
        const ed = state.nfts.find((n) => n.id === l.nftId)?.editions.find((e) => e.id === l.editionId)
        if (ed) mutateNft(l.nftId, l.editionId, { available: ed.available - l.quantity })
        const it = cart?.items.find((i) => i.nftId === l.nftId && i.editionId === l.editionId)
        if (it) it.quantity -= l.quantity
      }
      if (cart) {
        cart.items = cart.items.filter((i) => i.quantity > 0)
        cart.version += 1
      }
    }
    commit()
    events.emit({ type: 'order.updated', userId: s.ownerId, order: structuredClone(s.order) })
  }
}
