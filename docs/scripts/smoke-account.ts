export {}
;(globalThis as any).location = new URL('http://localhost/')
const store = new Map<string, string>()
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}
;(globalThis as any).localStorage = storage
;(globalThis as any).sessionStorage = storage

const { setupServer } = await import('msw/node')
const { handlers } = await import('../src/mocks/handlers')
const { setScenario } = await import('../src/mocks/scenarios')
const { resetDb } = await import('../src/mocks/db')

const server = setupServer(...handlers)
server.listen()
let token = ''
const call = async (m: string, p: string, body?: unknown) => {
  const r = await fetch(`http://localhost/api${p}`, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, body: (await r.json()) as any }
}
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) process.exitCode = 1
}
const loginAs = async (email: string, password: string) => {
  token = ''
  token = (await call('POST', '/auth/login', { email, password })).body.token
}

setScenario('default')
resetDb()
ok('favoritos exigem autenticação', (await call('GET', '/favorites')).status === 401)
await loginAs('ada@jungle.test', 'Senha@123')
ok('adicionar favorito', (await call('PUT', '/favorites/nft_3')).body.nftIds.includes('nft_3'))
ok('favorito inexistente → 404', (await call('PUT', '/favorites/nope')).status === 404)
await loginAs('bruno@jungle.test', 'Senha@456')
ok('favoritos são isolados por usuário', (await call('GET', '/favorites')).body.nftIds.length === 0)
await loginAs('ada@jungle.test', 'Senha@123')
ok('favoritos persistem para o usuário', (await call('GET', '/favorites')).body.nftIds.includes('nft_3'))
ok('remover favorito', !(await call('DELETE', '/favorites/nft_3')).body.nftIds.includes('nft_3'))

setScenario('favorite-error')
ok(
  'falha simulada no favorito → 500 (rollback no cliente)',
  (await call('PUT', '/favorites/nft_4')).status === 500,
)
setScenario('default')

const prof = await call('GET', '/profile')
ok('perfil retorna dados', prof.body.email === 'ada@jungle.test')
const bad = await call('PATCH', '/profile', { name: '', email: 'x' })
ok(
  'perfil valida campos com fieldErrors',
  bad.status === 422 && !!bad.body.error.fieldErrors.name && !!bad.body.error.fieldErrors.email,
)
ok(
  'perfil rejeita e-mail de outro usuário (409)',
  (await call('PATCH', '/profile', { email: 'bruno@jungle.test' })).status === 409,
)
const saved = await call('PATCH', '/profile', { name: 'Ada L.', bio: 'Colecionadora' })
ok(
  'perfil salva alterações',
  saved.body.name === 'Ada L.' && (await call('GET', '/profile')).body.bio === 'Colecionadora',
)

ok(
  'avatar inválido → 422',
  (await call('PUT', '/profile/avatar', { dataUrl: 'data:text/html;base64,AAA' })).status === 422,
)
ok(
  'avatar válido atualiza',
  (
    await call('PUT', '/profile/avatar', { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })
  ).body.avatarUrl?.startsWith('data:image/png') === true,
)

const wrong = await call('POST', '/profile/password', { currentPassword: 'errada', newPassword: 'Nova@1234' })
ok(
  'senha atual incorreta → fieldErrors.currentPassword',
  wrong.status === 422 && !!wrong.body.error.fieldErrors.currentPassword,
)
ok(
  'senha nova fraca → fieldErrors.newPassword',
  !!(await call('POST', '/profile/password', { currentPassword: 'Senha@123', newPassword: 'abc' })).body.error
    .fieldErrors.newPassword,
)
ok(
  'troca de senha ok',
  (await call('POST', '/profile/password', { currentPassword: 'Senha@123', newPassword: 'Nova@1234' }))
    .status === 200,
)
token = ''
ok(
  'login com a senha antiga falha',
  (await call('POST', '/auth/login', { email: 'ada@jungle.test', password: 'Senha@123' })).status === 401,
)
ok(
  'login com a senha nova funciona',
  (await call('POST', '/auth/login', { email: 'ada@jungle.test', password: 'Nova@1234' })).status === 200,
)

await loginAs('ada@jungle.test', 'Nova@1234')
const addr1 = '0x' + 'a'.repeat(40)
const addr2 = '0x' + 'b'.repeat(40)
ok(
  'carteira com endereço inválido → 422',
  (await call('POST', '/wallets', { kind: 'secondary', label: 'X', address: '0x123', network: 'base' })).body
    .error.fieldErrors.address !== undefined,
)
ok(
  'segunda carteira principal é recusada',
  (await call('POST', '/wallets', { kind: 'primary', label: 'Outra', address: addr1, network: 'base' })).body
    .error.fieldErrors.kind !== undefined,
)
const sec = await call('POST', '/wallets', {
  kind: 'secondary',
  label: 'Secundária',
  address: addr1,
  network: 'base',
})
ok('cadastra carteira secundária', sec.status === 201 && sec.body.wallets.length === 2)
ok(
  'endereço duplicado é recusado',
  (await call('POST', '/wallets', { kind: 'secondary', label: 'Dup', address: addr1, network: 'base' })).body
    .error.fieldErrors.address !== undefined,
)
const secId = sec.body.wallets.find((w: any) => w.kind === 'secondary').id
const edited = await call('PATCH', `/wallets/${secId}`, {
  kind: 'secondary',
  label: 'Reserva',
  address: addr2,
  network: 'polygon',
})
ok('edita carteira secundária', edited.body.wallets.find((w: any) => w.id === secId).label === 'Reserva')
await loginAs('bruno@jungle.test', 'Senha@456')
ok(
  'carteiras isoladas por usuário',
  (await call('GET', '/wallets')).body.wallets.every((w: any) => w.id.startsWith('w_bruno')),
)
ok(
  'editar carteira de outro usuário → 404',
  (
    await call('PATCH', `/wallets/${secId}`, {
      kind: 'secondary',
      label: 'X',
      address: addr1,
      network: 'base',
    })
  ).status === 404,
)

server.close()
