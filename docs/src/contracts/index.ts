export type Eth = string
export type Network = 'ethereum' | 'polygon' | 'base'
export type Category = 'art' | 'music' | 'photography' | 'gaming' | 'collectibles'

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AVAILABILITY_CONFLICT'
  | 'QUOTE_CHANGED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'WALLET_REFUSED'
  | 'TRANSIENT'
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; fieldErrors?: Record<string, string>; details?: unknown }
}

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}
export interface AuthResponse {
  token: string
  user: User
  expiresAt: string
}
export interface RegisterRequest {
  name: string
  email: string
  password: string
}
export interface LoginRequest {
  email: string
  password: string
}
export interface SessionResponse {
  user: User
  expiresAt: string
}

export interface Edition {
  id: string
  label: string
  price: Eth
  available: number
  maxPerOrder: number
}
export interface Nft {
  id: string
  version: number
  name: string
  description: string
  category: Category
  collection: { id: string; name: string }
  creator: string
  imageUrl: string
  gallery: string[]
  price: Eth
  available: number
  editions: Edition[]
  createdAt: string
  updatedAt: string
}
export type NftSort = 'newest' | 'price_asc' | 'price_desc' | 'name'
export interface NftListParams {
  q?: string
  category?: Category[]
  collection?: string
  minPrice?: Eth
  maxPrice?: Eth
  inStock?: boolean
  sort?: NftSort
  page?: number
  pageSize?: number
}
export interface NftListResponse {
  items: Nft[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: { categories: Category[]; collections: { id: string; name: string }[] }
}

export interface FavoritesResponse {
  nftIds: string[]
}

export interface CartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  unitPriceSeen: Eth
}
export interface Cart {
  id: string
  version: number
  items: CartItem[]
}
export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}
export interface UpdateCartItemRequest {
  quantity?: number
  unitPriceSeen?: Eth
}
export interface MergeCartRequest {
  guestId: string
}

export interface QuoteItemInput {
  nftId: string
  editionId: string
  quantity: number
}
export interface QuoteRequest {
  items: QuoteItemInput[]
  coupon?: string
  network?: Network
}
export type QuoteLineStatus =
  'ok' | 'sold_out' | 'insufficient' | 'over_limit' | 'price_changed' | 'not_found'
export interface QuoteLine {
  nftId: string
  editionId: string
  name: string
  editionLabel: string
  imageUrl: string
  quantity: number
  unitPrice: Eth
  lineTotal: Eth
  available: number
  maxPerOrder: number
  status: QuoteLineStatus
}
export interface CouponResult {
  code: string | null
  status: 'none' | 'applied' | 'invalid' | 'expired'
  message?: string
}
export interface Quote {
  hash: string
  currency: 'ETH'
  network: Network
  lines: QuoteLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon: CouponResult
  quotedAt: string
}

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'
export interface Collector {
  name: string
  email: string
}
export interface CreateOrderRequest {
  items: QuoteItemInput[]
  coupon?: string
  network: Network
  walletId: string
  quoteHash: string
  collector: Collector
}
export interface OrderSnapshot {
  lines: QuoteLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  network: Network
  coupon: CouponResult
  collector: Collector
  walletAddress: string
}
export interface Order {
  id: string
  version: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
  snapshot: OrderSnapshot
  txHash?: string
  explorerUrl?: string
  rejectionReason?: string
}
export interface OrderResponse {
  order: Order
}
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

export type Profile = User & { bio: string }
export interface UpdateProfileRequest {
  name?: string
  email?: string
  bio?: string
}
export interface UpdateAvatarRequest {
  dataUrl: string
}
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface Wallet {
  id: string
  kind: 'primary' | 'secondary'
  label: string
  address: string
  network: Network
  connection: 'disconnected' | 'connected'
}
export interface UpsertWalletRequest {
  kind: 'primary' | 'secondary'
  label: string
  address: string
  network: Network
}
export interface WalletsResponse {
  wallets: Wallet[]
}

export type RealtimeEventName = 'nft.updated' | 'order.updated'
export interface RealtimeEvent<T> {
  eventId: string
  resource: 'nft' | 'order'
  resourceId: string
  version: number
  occurredAt: string
  audience?: string
  data: T
}
export type NftUpdatedEvent = RealtimeEvent<Nft>
export type OrderUpdatedEvent = RealtimeEvent<Order>
