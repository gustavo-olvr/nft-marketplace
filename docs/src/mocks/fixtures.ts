import type { Category, Edition, Nft, Wallet } from '@/contracts'
import { fromWei, toWei } from '@/lib/money'
import { mulberry32, sha256 } from './util'

export const PASSWORD_SALT = 'jg-mock-salt'
export const hashPassword = (pw: string) => sha256(PASSWORD_SALT + pw)

export const CREDENTIALS = [
  { id: 'u_ada', name: 'Ada Collector', email: 'ada@jungle.test', password: 'Senha@123' },
  { id: 'u_bruno', name: 'Bruno Minter', email: 'bruno@jungle.test', password: 'Senha@456' },
] as const

export interface DbUser {
  id: string
  name: string
  email: string
  bio: string
  avatarUrl: string | null
  passwordHash: string
}

export async function buildUsers(): Promise<DbUser[]> {
  return Promise.all(
    CREDENTIALS.map(async (c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      bio: '',
      avatarUrl: null,
      passwordHash: await hashPassword(c.password),
    })),
  )
}

export function seedWallets(): Record<string, Wallet[]> {
  return {
    u_ada: [
      {
        id: 'w_ada_1',
        kind: 'primary',
        label: 'Carteira principal',
        address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        network: 'ethereum',
        connection: 'disconnected',
      },
    ],
    u_bruno: [
      {
        id: 'w_bruno_1',
        kind: 'primary',
        label: 'Minha carteira',
        address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
        network: 'polygon',
        connection: 'disconnected',
      },
    ],
  }
}

const ADJ = ['Neon', 'Lunar', 'Cosmic', 'Velvet', 'Feral', 'Solar', 'Mystic', 'Prism']
const NOUN = ['Jaguar', 'Orchid', 'Monolith', 'Echo', 'Tide', 'Relic']
const CATEGORIES: Category[] = ['art', 'music', 'photography', 'gaming', 'collectibles']
export const COLLECTIONS = ['Canopy', 'Understory', 'Riverbed', 'Emergent', 'Ember', 'Dusk'].map(
  (name, i) => ({ id: `c_${i + 1}`, name }),
)
const CREATORS = ['mara.eth', 'tupi.base', 'luzia.art', 'cobalt.xyz']
const EDITIONS: { label: string; mult: number; max: number }[] = [
  { label: 'Standard', mult: 1, max: 5 },
  { label: 'Limited', mult: 1.5, max: 3 },
  { label: 'Genesis', mult: 3, max: 1 },
]

function art(hue: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 80% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 70) % 360} 70% 25%)"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="300" r="140" fill="hsl(${(hue + 160) % 360} 80% 70% / .35)"/><text x="300" y="560" font-family="sans-serif" font-size="28" fill="#fff" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function deriveNft(n: Nft): Nft {
  const prices = n.editions.map((e) => toWei(e.price))
  n.price = fromWei(prices.reduce((a, b) => (a < b ? a : b)))
  n.available = n.editions.reduce((s, e) => s + e.available, 0)
  return n
}

export function seedNfts(count = 48): Nft[] {
  const rand = mulberry32(42)
  return Array.from({ length: count }, (_, i) => {
    const base = (Math.round((0.05 + rand() * 2) * 1000) / 1000).toFixed(3)
    const nEditions = 1 + (i % 3)
    const soldOut = i % 13 === 0
    const editions: Edition[] = EDITIONS.slice(0, nEditions).map((e, k) => ({
      id: `e_${i + 1}_${k + 1}`,
      label: e.label,
      price: fromWei((toWei(base) * BigInt(Math.round(e.mult * 100))) / 100n),
      available: soldOut ? 0 : Math.max(1, Math.floor(rand() * 12)),
      maxPerOrder: e.max,
    }))
    const name = `${ADJ[i % 8]} ${NOUN[Math.floor(i / 8)]}`
    const hue = (i * 37) % 360
    const created = new Date(Date.UTC(2026, 0, 1 + i)).toISOString()
    return deriveNft({
      id: `nft_${i + 1}`,
      version: 1,
      name,
      description: `${name} é uma peça digital da coleção ${COLLECTIONS[i % 6]!.name}, criada por ${CREATORS[i % 4]}.`,
      category: CATEGORIES[i % 5]!,
      collection: COLLECTIONS[i % 6]!,
      creator: CREATORS[i % 4]!,
      imageUrl: art(hue, name),
      gallery: [art(hue, name), art(hue + 40, `${name} II`), art(hue + 80, `${name} III`)],
      price: base,
      available: 0,
      editions,
      createdAt: created,
      updatedAt: created,
    })
  })
}
