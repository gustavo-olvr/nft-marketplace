import { http, delay, type HttpResponseResolver } from 'msw'
import type {
  AddCartItemRequest,
  AuthResponse,
  Category,
  ChangePasswordRequest,
  Cart,
  CreateOrderRequest,
  LoginRequest,
  MergeCartRequest,
  Nft,
  NftListParams,
  NftSort,
  Order,
  QuoteRequest,
  RegisterRequest,
  UpdateAvatarRequest,
  UpdateCartItemRequest,
  UpdateProfileRequest,
  UpsertWalletRequest,
  Wallet,
} from '@/contracts'
import { HTTP_TIMEOUT_MS } from '@/config'
import { cmpEth, toWei } from '@/lib/money'
import { bumpPrice, bump, commit, db, mutateNft, nextId, settleDue, type StoredOrder } from './db'
import { COLLECTIONS, hashPassword } from './fixtures'
import { buildQuote } from './quote'
import {
  authenticate,
  EMAIL_RE,
  fail,
  gate,
  json,
  passwordIssue,
  publicUser,
  readBody,
  type Auth,
} from './runtime'
import { getScenario } from './scenarios'
import { socketHandlers } from './socket'
import { fnv } from './util'

type Args = Parameters<HttpResponseResolver>[0]
type Ctx = Args & { auth: Auth }

function route(opts: { auth: true }, fn: (c: Ctx) => Response | Promise<Response>): HttpResponseResolver
function route(opts: { auth?: false }, fn: (c: Args) => Response | Promise<Response>): HttpResponseResolver
function route(opts: { auth?: boolean }, fn: (c: Ctx) => Response | Promise<Response>): HttpResponseResolver {
  return async (args) => {
    const blocked = await gate(args.request)
    if (blocked) return blocked
    let auth = undefined as unknown as Auth
    if (opts.auth) {
      const r = authenticate(args.request)
      if (r instanceof Response) return r
      auth = r
    }
    return fn({ ...args, auth })
  }
}
const ownerKey = (req: Request) => {
  const r = authenticate(req)
  return r instanceof Response ? `g:${req.headers.get('X-Guest-Id') ?? 'anon'}` : `u:${r.user.id}`
}
const cartOf = (key: string) => (db().carts[key] ??= { version: 1, items: [] })
const cartDto = (key: string): Cart => ({ id: key, ...structuredClone(cartOf(key)) })
const SESSION_MS = 60 * 60 * 1000

const restHandlers = [
  http.post(
    '/api/auth/register',
    route({}, async ({ request }) => {
      const b = await readBody<RegisterRequest>(request)
      const fe: Record<string, string> = {}
      if (!b?.name?.trim()) fe.name = 'Informe seu nome'
      if (!b?.email || !EMAIL_RE.test(b.email)) fe.email = 'E-mail inválido'
      const pw = b?.password ? passwordIssue(b.password) : 'Informe a senha'
      if (pw) fe.password = pw
      if (Object.keys(fe).length) return fail(422, 'VALIDATION', 'Dados inválidos', { fieldErrors: fe })
      if (
        getScenario().registerConflict ||
        db().users.some((u) => u.email.toLowerCase() === b!.email.toLowerCase())
      )
        return fail(409, 'CONFLICT', 'E-mail já cadastrado', {
          fieldErrors: { email: 'Este e-mail já está em uso' },
        })
      const user = {
        id: nextId('u'),
        name: b!.name.trim(),
        email: b!.email,
        bio: '',
        avatarUrl: null,
        passwordHash: await hashPassword(b!.password),
      }
      db().users.push(user)
      return json(startSession(user.id), 201)
    }),
  ),
  http.post(
    '/api/auth/login',
    route({}, async ({ request }) => {
      const b = await readBody<LoginRequest>(request)
      const user = db().users.find((u) => u.email.toLowerCase() === b?.email?.toLowerCase())
      if (!b?.email || !b.password)
        return fail(422, 'VALIDATION', 'Dados inválidos', {
          fieldErrors: {
            email: !b?.email ? 'Informe o e-mail' : '',
            password: !b?.password ? 'Informe a senha' : '',
          },
        })
      if (!user || user.passwordHash !== (await hashPassword(b.password)))
        return fail(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos')
      db().counters.authed = 0
      return json(startSession(user.id))
    }),
  ),
  http.get(
    '/api/auth/session',
    route({ auth: true }, ({ auth }) =>
      json({
        user: publicUser(auth.user),
        expiresAt: new Date(db().sessions[auth.token]!.expiresAt).toISOString(),
      }),
    ),
  ),
  http.post(
    '/api/auth/logout',
    route({ auth: true }, ({ auth }) => {
      delete db().sessions[auth.token]
      commit()
      return json({ ok: true })
    }),
  ),

  http.get(
    '/api/nfts/featured',
    route({}, () =>
      json({
        items: [...db().nfts]
          .filter((n) => n.available > 0)
          .sort((a, b) => cmpEth(b.price, a.price))
          .slice(0, 4),
      }),
    ),
  ),
  http.get(
    '/api/nfts',
    route({}, ({ request }) => {
      const sp = new URL(request.url).searchParams
      const p: NftListParams = {
        q: sp.get('q') ?? undefined,
        category: sp
          .getAll('category')
          .flatMap((c) => c.split(','))
          .filter(Boolean) as Category[],
        collection: sp.get('collection') ?? undefined,
        minPrice: sp.get('minPrice') ?? undefined,
        maxPrice: sp.get('maxPrice') ?? undefined,
        inStock: sp.get('inStock') === 'true',
        sort: (sp.get('sort') as NftSort) ?? 'newest',
        page: Math.max(1, Number(sp.get('page')) || 1),
        pageSize: Math.min(48, Math.max(1, Number(sp.get('pageSize')) || 12)),
      }
      for (const k of ['minPrice', 'maxPrice'] as const) {
        if (p[k] !== undefined) {
          try {
            toWei(p[k]!)
          } catch {
            return fail(422, 'VALIDATION', 'Preço inválido', {
              fieldErrors: { [k]: 'Use um decimal válido' },
            })
          }
        }
      }
      let items: Nft[] = getScenario().emptyCatalog ? [] : [...db().nfts]
      const q = p.q?.trim().toLowerCase()
      if (q)
        items = items.filter((n) => `${n.name} ${n.creator} ${n.collection.name}`.toLowerCase().includes(q))
      if (p.category?.length) items = items.filter((n) => p.category!.includes(n.category))
      if (p.collection) items = items.filter((n) => n.collection.id === p.collection)
      if (p.minPrice) items = items.filter((n) => cmpEth(n.price, p.minPrice!) >= 0)
      if (p.maxPrice) items = items.filter((n) => cmpEth(n.price, p.maxPrice!) <= 0)
      if (p.inStock) items = items.filter((n) => n.available > 0)
      const sorters: Record<NftSort, (a: Nft, b: Nft) => number> = {
        newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
        price_asc: (a, b) => cmpEth(a.price, b.price),
        price_desc: (a, b) => cmpEth(b.price, a.price),
        name: (a, b) => a.name.localeCompare(b.name),
      }
      items.sort(sorters[p.sort ?? 'newest'] ?? sorters.newest)
      const total = items.length,
        pageSize = p.pageSize!,
        totalPages = Math.max(1, Math.ceil(total / pageSize))
      const page = Math.min(p.page!, totalPages)
      return json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total,
        totalPages,
        facets: {
          categories: ['art', 'music', 'photography', 'gaming', 'collectibles'],
          collections: COLLECTIONS,
        },
      })
    }),
  ),
  http.get(
    '/api/nfts/:id',
    route({}, ({ params }) => {
      const nft = db().nfts.find((n) => n.id === params.id)
      return nft ? json(nft) : fail(404, 'NOT_FOUND', 'NFT não encontrado')
    }),
  ),

  http.get(
    '/api/favorites',
    route({ auth: true }, ({ auth }) => json({ nftIds: db().favorites[auth.user.id] ?? [] })),
  ),
  http.put(
    '/api/favorites/:nftId',
    route({ auth: true }, ({ auth, params }) => {
      if (!db().nfts.some((n) => n.id === params.nftId)) return fail(404, 'NOT_FOUND', 'NFT não encontrado')
      const set = new Set(db().favorites[auth.user.id] ?? [])
      set.add(String(params.nftId))
      db().favorites[auth.user.id] = [...set]
      commit()
      return json({ nftIds: [...set] })
    }),
  ),
  http.delete(
    '/api/favorites/:nftId',
    route({ auth: true }, ({ auth, params }) => {
      db().favorites[auth.user.id] = (db().favorites[auth.user.id] ?? []).filter((id) => id !== params.nftId)
      commit()
      return json({ nftIds: db().favorites[auth.user.id] })
    }),
  ),

  http.get(
    '/api/cart',
    route({}, ({ request }) => json(cartDto(ownerKey(request)))),
  ),
  http.post(
    '/api/cart/items',
    route({}, async ({ request }) => {
      const b = await readBody<AddCartItemRequest>(request)
      const ed = db()
        .nfts.find((n) => n.id === b?.nftId)
        ?.editions.find((e) => e.id === b?.editionId)
      if (!b || !ed) return fail(404, 'NOT_FOUND', 'NFT ou edição não encontrados')
      if (!Number.isInteger(b.quantity) || b.quantity < 1)
        return fail(422, 'VALIDATION', 'Quantidade inválida', {
          fieldErrors: { quantity: 'Use um inteiro ≥ 1' },
        })
      const cart = cartOf(ownerKey(request))
      const existing = cart.items.find((i) => i.nftId === b.nftId && i.editionId === b.editionId)
      const qty = (existing?.quantity ?? 0) + b.quantity
      if (ed.available === 0 || qty > ed.available)
        return fail(409, 'AVAILABILITY_CONFLICT', 'Quantidade indisponível', {
          details: { available: ed.available },
        })
      if (qty > ed.maxPerOrder)
        return fail(409, 'AVAILABILITY_CONFLICT', `Limite de ${ed.maxPerOrder} por pedido`, {
          details: { maxPerOrder: ed.maxPerOrder },
        })
      if (existing) {
        existing.quantity = qty
        existing.unitPriceSeen = ed.price
      } else
        cart.items.push({
          id: nextId('ci'),
          nftId: b.nftId,
          editionId: b.editionId,
          quantity: qty,
          unitPriceSeen: ed.price,
        })
      cart.version++
      commit()
      return json(cartDto(ownerKey(request)), 201)
    }),
  ),
  http.patch(
    '/api/cart/items/:id',
    route({}, async ({ request, params }) => {
      const b = await readBody<UpdateCartItemRequest>(request)
      const cart = cartOf(ownerKey(request))
      const it = cart.items.find((i) => i.id === params.id)
      if (!it || !b) return fail(404, 'NOT_FOUND', 'Item não encontrado')
      const ed = db()
        .nfts.find((n) => n.id === it.nftId)
        ?.editions.find((e) => e.id === it.editionId)
      if (!ed) return fail(404, 'NOT_FOUND', 'Edição não encontrada')
      if (b.quantity !== undefined) {
        if (!Number.isInteger(b.quantity) || b.quantity < 1)
          return fail(422, 'VALIDATION', 'Quantidade inválida', {
            fieldErrors: { quantity: 'Use um inteiro ≥ 1' },
          })
        if (b.quantity > Math.min(ed.available, ed.maxPerOrder))
          return fail(409, 'AVAILABILITY_CONFLICT', 'Quantidade indisponível', {
            details: { available: ed.available, maxPerOrder: ed.maxPerOrder },
          })
        it.quantity = b.quantity
      }
      if (b.unitPriceSeen) it.unitPriceSeen = b.unitPriceSeen
      cart.version++
      commit()
      return json(cartDto(ownerKey(request)))
    }),
  ),
  http.delete(
    '/api/cart/items/:id',
    route({}, ({ request, params }) => {
      const cart = cartOf(ownerKey(request))
      cart.items = cart.items.filter((i) => i.id !== params.id)
      cart.version++
      commit()
      return json(cartDto(ownerKey(request)))
    }),
  ),
  http.post(
    '/api/cart/merge',
    route({ auth: true }, async ({ request, auth }) => {
      const b = await readBody<MergeCartRequest>(request)
      const guest = db().carts[`g:${b?.guestId}`]
      const mine = cartOf(`u:${auth.user.id}`)
      for (const g of guest?.items ?? []) {
        const ed = db()
          .nfts.find((n) => n.id === g.nftId)
          ?.editions.find((e) => e.id === g.editionId)
        if (!ed) continue
        const cur = mine.items.find((i) => i.nftId === g.nftId && i.editionId === g.editionId)
        const qty = Math.min((cur?.quantity ?? 0) + g.quantity, ed.available, ed.maxPerOrder)
        if (qty < 1) continue
        if (cur) cur.quantity = qty
        else mine.items.push({ ...g, id: nextId('ci'), quantity: qty })
      }
      delete db().carts[`g:${b?.guestId}`]
      mine.version++
      commit()
      return json(cartDto(`u:${auth.user.id}`))
    }),
  ),

  http.post(
    '/api/quotes',
    route({}, async ({ request }) => {
      const b = await readBody<QuoteRequest>(request)
      if (
        !b ||
        !Array.isArray(b.items) ||
        b.items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)
      )
        return fail(422, 'VALIDATION', 'Itens inválidos')
      const cart = db().carts[ownerKey(request)]
      const seen = Object.fromEntries(
        (cart?.items ?? []).map((i) => [`${i.nftId}:${i.editionId}`, i.unitPriceSeen]),
      )
      return json(buildQuote(b.items, b.coupon, b.network, seen))
    }),
  ),

  http.post(
    '/api/orders',
    route({ auth: true }, async ({ request, auth }) => {
      const sc = getScenario()
      const key = request.headers.get('Idempotency-Key')
      const b = await readBody<CreateOrderRequest>(request)
      if (!key) return fail(422, 'VALIDATION', 'Idempotency-Key obrigatório')
      if (
        !b ||
        !b.items?.length ||
        !b.collector?.name ||
        !b.collector?.email ||
        !EMAIL_RE.test(b.collector.email)
      )
        return fail(422, 'VALIDATION', 'Dados do pedido inválidos')
      const bodyHash = fnv(JSON.stringify(b))
      const idemKey = `${auth.user.id}:${key}`
      const prior = db().idempotency[idemKey]
      if (prior) {
        if (prior.bodyHash !== bodyHash)
          return fail(409, 'IDEMPOTENCY_CONFLICT', 'Chave reutilizada com conteúdo diferente')
        return json({ order: db().orders.find((o) => o.order.id === prior.orderId)!.order })
      }
      const wallet = db().wallets[auth.user.id]?.find((w) => w.id === b.walletId)
      if (!wallet)
        return fail(422, 'VALIDATION', 'Carteira inválida', {
          fieldErrors: { walletId: 'Selecione uma carteira' },
        })

      const first = b.items[0]!
      if (sc.priceChangeOnOrder && !db().flags.priceChanged) {
        db().flags.priceChanged = true
        bumpPrice(first.nftId, first.editionId, 10)
      }
      if (sc.soldOutOnOrder && !db().flags.soldOut) {
        db().flags.soldOut = true
        mutateNft(first.nftId, first.editionId, { available: 0 })
      }

      const quote = buildQuote(b.items, b.coupon, b.network)
      if (quote.lines.some((l) => ['sold_out', 'insufficient', 'over_limit', 'not_found'].includes(l.status)))
        return fail(409, 'AVAILABILITY_CONFLICT', 'Disponibilidade alterada', { details: { quote } })
      if (quote.hash !== b.quoteHash)
        return fail(409, 'QUOTE_CHANGED', 'A cotação mudou. Revise e confirme novamente.', {
          details: { quote },
        })

      const now = new Date().toISOString()
      const order: Order = {
        id: nextId('ord'),
        version: 1,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        snapshot: {
          lines: quote.lines,
          subtotal: quote.subtotal,
          discount: quote.discount,
          networkFee: quote.networkFee,
          total: quote.total,
          network: b.network,
          coupon: quote.coupon,
          collector: b.collector,
          walletAddress: wallet.address,
        },
      }
      const stored: StoredOrder = {
        order,
        ownerId: auth.user.id,
        outcome: sc.paymentDeclined ? 'reject' : 'confirm',
        settleAt: Date.now() + (sc.settleMs ?? 3000),
      }
      db().orders.push(stored)
      db().idempotency[idemKey] = { bodyHash, orderId: order.id }
      commit()
      if (sc.orderTimeoutOnce && !db().flags.timedOut) {
        db().flags.timedOut = true
        commit()
        await delay(HTTP_TIMEOUT_MS + 2000)
      }
      return json({ order }, 201)
    }),
  ),
  http.get(
    '/api/orders/:id',
    route({ auth: true }, ({ auth, params }) => {
      settleDue()
      const s = db().orders.find((o) => o.order.id === params.id)
      if (!s) return fail(404, 'NOT_FOUND', 'Pedido não encontrado')
      if (s.ownerId !== auth.user.id) return fail(403, 'FORBIDDEN', 'Sem permissão para este pedido')
      return json({ order: s.order })
    }),
  ),

  http.get(
    '/api/profile',
    route({ auth: true }, ({ auth }) => json({ ...publicUser(auth.user), bio: auth.user.bio })),
  ),
  http.patch(
    '/api/profile',
    route({ auth: true }, async ({ request, auth }) => {
      const b = await readBody<UpdateProfileRequest>(request)
      const fe: Record<string, string> = {}
      if (b?.name !== undefined && !b.name.trim()) fe.name = 'Informe seu nome'
      if (b?.email !== undefined && !EMAIL_RE.test(b.email)) fe.email = 'E-mail inválido'
      if (b?.bio !== undefined && b.bio.length > 280) fe.bio = 'Máximo de 280 caracteres'
      if (Object.keys(fe).length) return fail(422, 'VALIDATION', 'Dados inválidos', { fieldErrors: fe })
      if (
        b?.email &&
        db().users.some((u) => u.id !== auth.user.id && u.email.toLowerCase() === b.email!.toLowerCase())
      )
        return fail(409, 'CONFLICT', 'E-mail já cadastrado', {
          fieldErrors: { email: 'Este e-mail já está em uso' },
        })
      Object.assign(auth.user, {
        ...(b?.name !== undefined && { name: b.name.trim() }),
        ...(b?.email && { email: b.email }),
        ...(b?.bio !== undefined && { bio: b.bio }),
      })
      commit()
      return json({ ...publicUser(auth.user), bio: auth.user.bio })
    }),
  ),
  http.put(
    '/api/profile/avatar',
    route({ auth: true }, async ({ request, auth }) => {
      const b = await readBody<UpdateAvatarRequest>(request)
      if (!b?.dataUrl || !/^data:image\/(png|jpeg|webp);base64,/.test(b.dataUrl))
        return fail(422, 'VALIDATION', 'Imagem inválida', {
          fieldErrors: { avatar: 'Use PNG, JPEG ou WebP' },
        })
      if (b.dataUrl.length > 400_000)
        return fail(422, 'VALIDATION', 'Imagem muito grande', {
          fieldErrors: { avatar: 'Máximo de ~300 KB' },
        })
      auth.user.avatarUrl = b.dataUrl
      commit()
      return json({ ...publicUser(auth.user), bio: auth.user.bio })
    }),
  ),
  http.post(
    '/api/profile/password',
    route({ auth: true }, async ({ request, auth }) => {
      const b = await readBody<ChangePasswordRequest>(request)
      const fe: Record<string, string> = {}
      if (!b?.currentPassword || (await hashPassword(b.currentPassword)) !== auth.user.passwordHash)
        fe.currentPassword = 'Senha atual incorreta'
      const issue = b?.newPassword ? passwordIssue(b.newPassword) : 'Informe a nova senha'
      if (issue) fe.newPassword = issue
      if (Object.keys(fe).length) return fail(422, 'VALIDATION', 'Dados inválidos', { fieldErrors: fe })
      auth.user.passwordHash = await hashPassword(b!.newPassword)
      commit()
      return json({ ok: true })
    }),
  ),

  http.get(
    '/api/wallets',
    route({ auth: true }, ({ auth }) => json({ wallets: db().wallets[auth.user.id] ?? [] })),
  ),
  http.post(
    '/api/wallets',
    route({ auth: true }, async ({ request, auth }) => {
      const b = await readBody<UpsertWalletRequest>(request)
      const list = (db().wallets[auth.user.id] ??= [])
      const fe = walletErrors(b, list)
      if (Object.keys(fe).length) return fail(422, 'VALIDATION', 'Dados inválidos', { fieldErrors: fe })
      const w: Wallet = { id: nextId('w'), ...b!, connection: 'disconnected' }
      list.push(w)
      commit()
      return json({ wallets: list }, 201)
    }),
  ),
  http.patch(
    '/api/wallets/:id',
    route({ auth: true }, async ({ request, auth, params }) => {
      const b = await readBody<UpsertWalletRequest>(request)
      const list = db().wallets[auth.user.id] ?? []
      const w = list.find((x) => x.id === params.id)
      if (!w) return fail(404, 'NOT_FOUND', 'Carteira não encontrada')
      const fe = walletErrors(b, list, w.id)
      if (Object.keys(fe).length) return fail(422, 'VALIDATION', 'Dados inválidos', { fieldErrors: fe })
      Object.assign(w, b)
      commit()
      return json({ wallets: list })
    }),
  ),
  http.post(
    '/api/wallets/:id/connect',
    route({ auth: true }, ({ auth, params }) => {
      const w = db().wallets[auth.user.id]?.find((x) => x.id === params.id)
      if (!w) return fail(404, 'NOT_FOUND', 'Carteira não encontrada')
      if (getScenario().walletRefused) return fail(403, 'WALLET_REFUSED', 'A carteira recusou a conexão')
      w.connection = 'connected'
      commit()
      return json({ wallets: db().wallets[auth.user.id] })
    }),
  ),
  http.post(
    '/api/wallets/:id/disconnect',
    route({ auth: true }, ({ auth, params }) => {
      const w = db().wallets[auth.user.id]?.find((x) => x.id === params.id)
      if (!w) return fail(404, 'NOT_FOUND', 'Carteira não encontrada')
      w.connection = 'disconnected'
      commit()
      return json({ wallets: db().wallets[auth.user.id] })
    }),
  ),
]

export const handlers = [...restHandlers, ...socketHandlers]

function walletErrors(b: UpsertWalletRequest | null, list: Wallet[], selfId?: string) {
  const fe: Record<string, string> = {}
  if (!b?.label?.trim()) fe.label = 'Informe um nome'
  if (!b?.address || !/^0x[a-fA-F0-9]{40}$/.test(b.address)) fe.address = 'Endereço inválido (0x + 40 hex)'
  else if (list.some((w) => w.id !== selfId && w.address.toLowerCase() === b.address.toLowerCase()))
    fe.address = 'Endereço já cadastrado'
  if (!b || !['ethereum', 'polygon', 'base'].includes(b.network)) fe.network = 'Selecione a rede'
  if (b?.kind === 'primary' && list.some((w) => w.id !== selfId && w.kind === 'primary'))
    fe.kind = 'Já existe uma carteira principal'
  if (b?.kind === 'secondary' && !list.some((w) => w.id !== selfId && w.kind === 'primary') && !selfId)
    fe.kind = 'Cadastre a carteira principal primeiro'
  return fe
}

function startSession(userId: string): AuthResponse {
  const token = `tok_${userId}_${bump('tokens')}_${Math.random().toString(36).slice(2, 10)}`
  const expiresAt = Date.now() + SESSION_MS
  db().sessions[token] = { userId, expiresAt }
  commit()
  const u = db().users.find((x) => x.id === userId)!
  return { token, user: publicUser(u), expiresAt: new Date(expiresAt).toISOString() }
}
