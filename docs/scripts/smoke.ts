export {}
;(globalThis as any).location = new URL('http://localhost/')
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}

const { setupServer } = await import('msw/node')
const { handlers } = await import('../src/mocks/handlers')
const { setScenario } = await import('../src/mocks/scenarios')
const { db, settleDue } = await import('../src/mocks/db')
const { buildQuote } = await import('../src/mocks/quote')

const server = setupServer(...handlers)
server.listen()
setScenario('default')
let token = ''
const call = async (m: string, p: string, body?: unknown, h: Record<string, string> = {}) => {
  const r = await fetch(`http://localhost/api${p}`, {
    method: m,
    headers: {
      'Content-Type': 'application/json',
      'X-Guest-Id': 'g1',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...h,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, body: (await r.json()) as any }
}
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) process.exitCode = 1
}

const list = await call('GET', '/nfts?category=art&sort=price_desc&pageSize=5')
ok(
  'lista filtra e pagina',
  list.status === 200 &&
    list.body.items.length === 5 &&
    list.body.items.every((n: any) => n.category === 'art'),
)
ok('404 NFT inexistente', (await call('GET', '/nfts/nope')).status === 404)
ok('favoritos exigem auth', (await call('GET', '/favorites')).status === 401)

const login = await call('POST', '/auth/login', { email: 'ada@jungle.test', password: 'Senha@123' })
ok('login ok', login.status === 200)
token = login.body.token
ok(
  'login inválido 401',
  (await call('POST', '/auth/login', { email: 'ada@jungle.test', password: 'x' }, { Authorization: '' }))
    .status === 401,
)

const nft = db().nfts.find((n) => n.available > 3)!
const ed = nft.editions[0]!
token = ''
const add = await call('POST', '/cart/items', { nftId: nft.id, editionId: ed.id, quantity: 2 })
ok('visitante adiciona ao carrinho', add.status === 201 && add.body.items[0].quantity === 2)
token = login.body.token
const merged = await call('POST', '/cart/merge', { guestId: 'g1' })
ok('merge preserva itens do visitante', merged.body.items.length === 1 && merged.body.items[0].quantity === 2)

const q = await call('POST', '/quotes', {
  items: [{ nftId: nft.id, editionId: ed.id, quantity: 2 }],
  coupon: 'WELCOME10',
  network: 'polygon',
})
ok(
  'cotação com cupom (precisão decimal)',
  q.body.coupon.status === 'applied' &&
    q.body.total ===
      buildQuote([{ nftId: nft.id, editionId: ed.id, quantity: 2 }], 'WELCOME10', 'polygon').total,
)
ok(
  'cupom expirado',
  (
    await call('POST', '/quotes', {
      items: [{ nftId: nft.id, editionId: ed.id, quantity: 1 }],
      coupon: 'EXPIRED20',
    })
  ).body.coupon.status === 'expired',
)

const order = {
  items: [{ nftId: nft.id, editionId: ed.id, quantity: 2 }],
  coupon: 'WELCOME10',
  network: 'polygon',
  walletId: 'w_ada_1',
  quoteHash: q.body.hash,
  collector: { name: 'Ada', email: 'ada@jungle.test' },
}
const o1 = await call('POST', '/orders', order, { 'Idempotency-Key': 'k1' })
const o2 = await call('POST', '/orders', order, { 'Idempotency-Key': 'k1' })
ok('pedido criado pendente', o1.status === 201 && o1.body.order.status === 'pending')
ok('mesma chave recupera o mesmo pedido', o2.body.order.id === o1.body.order.id && db().orders.length === 1)
ok(
  'chave com conteúdo diferente → 409',
  (await call('POST', '/orders', { ...order, coupon: undefined }, { 'Idempotency-Key': 'k1' })).body.error
    .code === 'IDEMPOTENCY_CONFLICT',
)
ok(
  'quote desatualizada → 409',
  (await call('POST', '/orders', { ...order, quoteHash: 'stale' }, { 'Idempotency-Key': 'k2' })).body.error
    .code === 'QUOTE_CHANGED',
)

const stock = ed.available
settleDue(Date.now() + 5000)
const done = await call('GET', `/orders/${o1.body.order.id}`)
ok('pedido confirmado após liquidação', done.body.order.status === 'confirmed' && !!done.body.order.txHash)
ok(
  'estoque baixou e carrinho esvaziou',
  db().nfts.find((n) => n.id === nft.id)!.editions[0]!.available === stock - 2 &&
    (await call('GET', '/cart')).body.items.length === 0,
)
const snapTotal = done.body.order.snapshot.total
db().nfts.find((n) => n.id === nft.id)!.editions[0]!.price = '9'
ok(
  'recibo é snapshot imutável',
  (await call('GET', `/orders/${o1.body.order.id}`)).body.order.snapshot.total === snapTotal,
)

token = (await call('POST', '/auth/login', { email: 'bruno@jungle.test', password: 'Senha@456' })).body.token
ok('isolamento: outro usuário recebe 403', (await call('GET', `/orders/${o1.body.order.id}`)).status === 403)
server.close()
