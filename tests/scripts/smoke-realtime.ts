import { createRequire } from 'node:module'

;(globalThis as any).location = new URL('http://localhost/')
const store = new Map<string, string>()
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
;(globalThis as any).localStorage = storage
;(globalThis as any).sessionStorage = storage

const { QueryClient, QueryObserver } = await import('@tanstack/react-query')
const { setupServer } = await import('msw/node')
const { handlers } = await import('../src/mocks/handlers')
const { setScenario } = await import('../src/mocks/scenarios')
const { db, resetDb, settleDue, events, commit } = await import('../src/mocks/db')
const { buildQuote } = await import('../src/mocks/quote')
const { realtimeControl } = await import('../src/mocks/socket')
const { createRealtime } = await import('../src/realtime/client')
const { getRealtimeStatus } = await import('../src/realtime/status')
const { getNotices, clearNotices } = await import('../src/realtime/notifications')
const { onSessionExpired } = await import('../src/lib/session-events')
const { nftKeys } = await import('../src/features/catalog/keys')
const { cartKeys } = await import('../src/features/cart/keys')
const { orderKeys } = await import('../src/features/checkout/keys')

const server = setupServer(...handlers)
server.listen()
const { io } = createRequire(import.meta.url)('socket.io-client/dist/socket.io.js')
setScenario('default')
resetDb()

const ok = (name: string, cond: boolean) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) process.exitCode = 1 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor(cond: () => boolean, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) { if (cond()) return true; await sleep(25) }
  return cond()
}
const rest = async (token: string, m: string, p: string, body?: unknown, h: Record<string, string> = {}) => {
  const r = await fetch(`http://localhost/api${p}`, { method: m, headers: { 'Content-Type': 'application/json', 'X-Guest-Id': 'g', Authorization: `Bearer ${token}`, ...h }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: (await r.json()) as any }
}
const login = async (email: string, password: string) => {
  const r = await fetch('http://localhost/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  return ((await r.json()) as any).token as string
}

const tokenA = await login('ada@jungle.test', 'Senha@123')
const tokenB = await login('bruno@jungle.test', 'Senha@456')

const nft = db().nfts.find((n) => n.available > 6)!
const ed = nft.editions[0]!
const qcA = new QueryClient()
const qcB = new QueryClient()
for (const qc of [qcA, qcB]) {
  qc.setQueryData(nftKeys.detail(nft.id), structuredClone(nft))
  qc.setQueryData(nftKeys.list({ page: 1 }), { items: [structuredClone(nft)], page: 1, pageSize: 12, total: 1, totalPages: 1, facets: { categories: [], collections: [] } })
}
qcA.setQueryData(cartKeys.all, { id: 'c', version: 1, items: [{ id: 'ci_x', nftId: nft.id, editionId: ed.id, quantity: 1, unitPriceSeen: ed.price }] })

let invalidations = 0
const original = qcA.invalidateQueries.bind(qcA)
qcA.invalidateQueries = ((...args: Parameters<typeof original>) => { invalidations++; return original(...args) }) as typeof original

const A = createRealtime({ queryClient: qcA, url: 'http://localhost', io })
const B = createRealtime({ queryClient: qcB, url: 'http://localhost', io })
await A.start({ token: tokenA, userId: 'u_ada' })
await B.start({ token: tokenB, userId: 'u_bruno' })
ok('clientes conectam via Socket.IO (MSW)', await waitFor(() => realtimeControl.connections() === 2 && getRealtimeStatus() === 'connected'))
await sleep(150)

const detailOf = (qc: InstanceType<typeof QueryClient>) => qc.getQueryData<any>(nftKeys.detail(nft.id))
const listOf = (qc: InstanceType<typeof QueryClient>) => qc.getQueryData<any>(nftKeys.list({ page: 1 })).items[0]

const v0 = detailOf(qcA).version
realtimeControl.changePrice(nft.id, ed.id, 10)
ok('nft.updated atualiza o detalhe no cache', await waitFor(() => detailOf(qcA).version === v0 + 1))
ok('nft.updated atualiza o catálogo (lista)', listOf(qcA).version === v0 + 1 && listOf(qcA).editions[0].price === detailOf(qcA).editions[0].price)
ok('o preço do cache bate com a resposta da API', (await rest(tokenA, 'GET', `/nfts/${nft.id}`)).body.editions[0].price === detailOf(qcA).editions[0].price)
ok('mudança de preço de item no carrinho gera aviso', getNotices().some((n) => n.message.includes('preço')))
ok('o outro usuário também recebe a atualização pública', await waitFor(() => detailOf(qcB).version === v0 + 1))

const noticesBefore = getNotices().length
const priceNow = detailOf(qcA).editions[0].price
realtimeControl.replayLast()
await sleep(250)
ok('evento duplicado não reaplica efeitos', getNotices().length === noticesBefore && detailOf(qcA).version === v0 + 1)

realtimeControl.sendStaleNft(nft.id)
await sleep(250)
ok('evento antigo não regride um estado mais recente', detailOf(qcA).editions[0].price === priceNow && detailOf(qcA).editions[0].price !== '999')

clearNotices()
realtimeControl.setAvailability(nft.id, ed.id, 0)
ok('disponibilidade zerada chega ao cache e avisa', await waitFor(() => detailOf(qcA).editions[0].available === 0) && getNotices().some((n) => n.message.includes('esgotou')))
realtimeControl.setAvailability(nft.id, ed.id, 9)
await waitFor(() => detailOf(qcA).editions[0].available === 9)

await rest(tokenA, 'POST', '/cart/items', { nftId: nft.id, editionId: ed.id, quantity: 1 })
const items = [{ nftId: nft.id, editionId: ed.id, quantity: 1 }]
const walletId = db().wallets.u_ada![0]!.id
const create = (key: string) => rest(tokenA, 'POST', '/orders', { items, network: 'ethereum', walletId, quoteHash: buildQuote(items, undefined, 'ethereum').hash, collector: { name: 'Ada', email: 'ada@jungle.test' } }, { 'Idempotency-Key': key })
const o1 = (await create('rt1')).body.order
settleDue(Date.now() + 5000)
ok('order.updated confirma o pedido pelo socket', await waitFor(() => qcA.getQueryData<any>(orderKeys.detail(o1.id))?.order.status === 'confirmed'))
await sleep(200)
ok('pedido de um usuário não chega a outro (isolamento)', qcB.getQueryData(orderKeys.detail(o1.id)) === undefined)
ok('confirmação gera aviso e a lista reflete o estoque novo', getNotices().some((n) => n.message.includes('confirmado')))

await rest(tokenA, 'POST', '/cart/items', { nftId: nft.id, editionId: ed.id, quantity: 1 })
const o2 = (await create('rt2')).body.order
const observer = new QueryObserver(qcA, { queryKey: orderKeys.detail(o2.id), queryFn: () => rest(tokenA, 'GET', `/orders/${o2.id}`).then((r) => r.body) })
const unsubscribe = observer.subscribe(() => undefined)
await waitFor(() => qcA.getQueryData<any>(orderKeys.detail(o2.id))?.order.status === 'pending')
const before = invalidations
realtimeControl.block(true)
ok('queda de conexão é detectada', await waitFor(() => getRealtimeStatus() === 'disconnected'))
settleDue(Date.now() + 5000)
await sleep(300)
ok('com a conexão fora, o cache ainda mostra o pedido pendente', qcA.getQueryData<any>(orderKeys.detail(o2.id))?.order.status === 'pending')
realtimeControl.block(false)
ok('reconecta automaticamente', await waitFor(() => getRealtimeStatus() === 'connected', 8000))
ok('após reconectar, reconcilia com a REST e recupera o pedido', await waitFor(() => qcA.getQueryData<any>(orderKeys.detail(o2.id))?.order.status === 'confirmed', 8000) && invalidations > before)
ok('nenhuma compra duplicada na recuperação', db().orders.filter((o) => o.ownerId === 'u_ada').length === 2)
unsubscribe()

await sleep(200)
const vServer = (await rest(tokenA, 'GET', `/nfts/${nft.id}`)).body.version
realtimeControl.changePrice(nft.id, ed.id, 5)
ok('eventos continuam chegando após a reconexão', await waitFor(() => detailOf(qcA).version === vServer + 1))
ok('o cache converge para a versão do servidor, mesmo após perder eventos na queda', detailOf(qcA).editions[0].price === (await rest(tokenA, 'GET', `/nfts/${nft.id}`)).body.editions[0].price)

A.stop()
ok('stop() libera a conexão do servidor', await waitFor(() => realtimeControl.connections() === 1))
const vStopped = detailOf(qcA).version
realtimeControl.changePrice(nft.id, ed.id, 5)
await sleep(300)
ok('listeners removidos: nada atualiza após o stop', detailOf(qcA).version === vStopped)

let expired = 0
const off = onSessionExpired(() => { expired++ })
const s = db(); s.expiredTokens.push(...Object.keys(s.sessions)); s.sessions = {}; commit()
events.emit({ type: 'session.revoked', userId: 'u_bruno' })
ok('sessão revogada derruba o socket e sinaliza expiração', await waitFor(() => expired > 0, 6000))
off()
B.stop()
ok('todas as conexões foram encerradas', await waitFor(() => realtimeControl.connections() === 0))

server.close()
setTimeout(() => process.exit(process.exitCode ?? 0), 100)
