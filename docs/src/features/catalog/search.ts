import type { Category, NftSort } from '@/contracts'

export const CATEGORIES: Category[] = ['art', 'music', 'photography', 'gaming', 'collectibles']
export const SORTS: NftSort[] = ['newest', 'price_asc', 'price_desc', 'name']
const DECIMAL = /^\d+(\.\d{1,18})?$/

export interface CatalogSearch {
  q?: string
  category?: Category[]
  collection?: string
  minPrice?: string
  maxPrice?: string
  inStock?: boolean
  sort: NftSort
  page: number
}

export function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const dec = (v: unknown) => {
    const s = str(typeof v === 'number' ? String(v) : v)
    return s && DECIMAL.test(s) ? s : undefined
  }
  const cats = (Array.isArray(raw.category) ? raw.category : [raw.category]).filter((c): c is Category =>
    CATEGORIES.includes(c as Category),
  )
  const page = Number(raw.page)
  return {
    q: str(raw.q),
    category: cats.length ? cats : undefined,
    collection: str(raw.collection),
    minPrice: dec(raw.minPrice),
    maxPrice: dec(raw.maxPrice),
    inStock: raw.inStock === true || raw.inStock === 'true' ? true : undefined,
    sort: SORTS.includes(raw.sort as NftSort) ? (raw.sort as NftSort) : 'newest',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

export const DEFAULT_SEARCH: CatalogSearch = { sort: 'newest', page: 1 }
