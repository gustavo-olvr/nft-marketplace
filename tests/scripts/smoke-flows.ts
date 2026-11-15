export {}
;(globalThis as any).location = new URL('http://localhost/')
const store = new Map<string, string>()
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
;(globalThis as any).localStorage = storage
;(globalThis as any).sessionStorage = storage

const { setupServer } = await import('msw/node')
const { handlers } = await import('../src/mocks/handlers')
const { setScenario } = await import('../src/mocks/scenarios')
const { db, resetDb, settleDue } = await import('../src/mocks/db')
const { buildQuote } = await import('../src/mocks/quote')
const { safeRedirect } = await import('../src/features/auth/redirect')
const { idempotencyKeyFor, clearIdempotencyKey } = await import('../src/features/checkout/idempotency')

const server = setupServer(...handlers)
server.listen()
let token = ''
const call = async (m: string, p: string, body?: unknown, h: Record<string, string> = {}) => {
  const r = await fetch(`http://localhost/api${p}`, { method: m, headers: { 'Content-Type': 'application/json', 'X-Guest-Id': 'g1', ...(token && { Authorization: `Bearer ${token}` }), ...h }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: (await r.json()) as any }
}
const ok = (name: string, cond: boolean) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) process.exitCode = 1 }
const loginAs = async (email: string, password: string) => { token = ''; token = (await call('POST', '/auth/login', { email, password })).body.token }

ok('redirect seguro aceita caminho interno', safeRedirect('/checkout?x=1') === '/checkout?x=1')
ok('redirect seguro bloqueia //evil.com', safeRedirect('//evil.com') === undefined)
ok('redirect seguro bloqueia URL absoluta', safeRedirect('https://evil.com') === undefined)
ok('redirect seguro bloqueia /login', safeRedirect('/login') === undefined)
const k1 = idempotencyKeyFor({ a: 1 }); const k2 = idempotencyKeyFor({ a: 1 }); const k3 = idempotencyKeyFor({ a: 2 })
ok('chave de idempotência é estável para o mesmo corpo', k1 === k2)
ok('chave muda quando o corpo muda', k1 !== k3)
clearIdempotencyKey()
ok('chave nova após limpar', idempotencyKeyFor({ a: 2 }) !== k3)

setScenario('default'); resetDb()
ok('cadastro valida campos (422)', (await call('POST', '/auth/register', { name: '', email: 'x', password: '123' })).status === 422)
ok('cadastro conflita e-mail existente (409)', (await call('POST', '/auth/register', { name: 'A', email: 'ada@jungle.test', password: 'Senha@123' })).status === 409)
const reg = await call('POST', '/auth/register', { name: 'Carla', email: 'carla@jungle.test', password: 'Senha@789' })
ok('cadastro cria conta e sessão', reg.status === 201 && !!reg.body.token)

await loginAs('ada@jungle.test', 'Senha@123')
const w = db().wallets.u_ada![0]!
ok('conectar carteira', (await call('POST', `/wallets/${w.id}/connect`)).body.wallets[0].connection === 'connected')
ok('desconectar carteira', (await call('POST', `/wallets/${w.id}/disconnect`)).body.wallets[0].connection === 'disconnected')
ok('carteira de outro usuário não é acessível', (await call('POST', '/wallets/w_bruno_1/connect')).status === 404)

const nft = db().nfts.find((n) => n.available > 4)!; const ed = nft.editions[0]!
await call('POST', '/cart/items', { nftId: nft.id, editionId: ed.id, quantity: 1 })
const items = [{ nftId: nft.id, editionId: ed.id, quantity: 1 }]
const body = (hash: string) => ({ items, network: 'ethereum', walletId: w.id, quoteHash: hash, collector: { name: 'Ada', email: 'ada@jungle.test' } })

setScenario('price-changed')
const q1 = buildQuote(items, undefined, 'ethereum')
const conflict = await call('POST', '/orders', body(q1.hash), { 'Idempotency-Key': 'a1' })
ok('preço alterado → 409 QUOTE_CHANGED com nova cotação', conflict.status === 409 && conflict.body.error.code === 'QUOTE_CHANGED' && !!conflict.body.error.details.quote.hash)
const retry = await call('POST', '/orders', body(conflict.body.error.details.quote.hash), { 'Idempotency-Key': 'a2' })
ok('após reconfirmar com a nova cotação o pedido é criado', retry.status === 201)
ok('nenhum pedido foi criado na tentativa conflitante', db().orders.length === 1)

setScenario('payment-declined'); resetDb()
await loginAs('ada@jungle.test', 'Senha@123')
await call('POST', '/cart/items', { nftId: nft.id, editionId: ed.id, quantity: 1 })
const q2 = buildQuote(items, undefined, 'ethereum')
const declined = await call('POST', '/orders', body(q2.hash), { 'Idempotency-Key': 'd1' })
settleDue(Date.now() + 5000)
const dres = await call('GET', `/orders/${declined.body.order.id}`)
ok('pagamento recusado é terminal e não baixa estoque', dres.body.order.status === 'rejected' && db().nfts.find((n) => n.id === nft.id)!.editions[0]!.available === ed.available)
ok('itens preservados no carrinho após recusa', (await call('GET', '/cart')).body.items.length === 1)

setScenario('sold-out'); resetDb()
await loginAs('ada@jungle.test', 'Senha@123')
await call('POST', '/cart/items', { nftId: nft.id, editionId: ed.id, quantity: 1 })
const so = await call('POST', '/orders', body(buildQuote(items, undefined, 'ethereum').hash), { 'Idempotency-Key': 's1' })
ok('edição esgotada → 409 AVAILABILITY_CONFLICT', so.status === 409 && so.body.error.code === 'AVAILABILITY_CONFLICT')

setScenario('session-expired'); resetDb()
await loginAs('ada@jungle.test', 'Senha@123')
const statuses: number[] = []
for (let i = 0; i < 5; i++) statuses.push((await call('GET', '/wallets')).status)
ok('sessão expira após N chamadas autenticadas', statuses.slice(0, 3).every((s) => s === 200) && statuses[3] === 401)
const expired = await call('GET', '/wallets')
ok('token expirado retorna SESSION_EXPIRED', expired.body.error.code === 'SESSION_EXPIRED')

server.close()
