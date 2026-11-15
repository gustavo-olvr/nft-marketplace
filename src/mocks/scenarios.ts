export type FailRule = {
  match: string
  effect: { status: number; code?: string } | 'network' | 'timeout'
  times?: number
}
export interface ScenarioConfig {
  description: string
  latency: { min: number; max: number }
  outOfOrder?: boolean
  emptyCatalog?: boolean
  offline?: boolean
  rules?: FailRule[]
  sessionExpiresAfter?: number
  registerConflict?: boolean
  priceChangeOnOrder?: boolean
  soldOutOnOrder?: boolean
  orderTimeoutOnce?: boolean
  paymentDeclined?: boolean
  walletRefused?: boolean
  settleMs?: number
}

const fast = { min: 40, max: 120 }
export const SCENARIOS = {
  default: { description: 'Sucesso, dados completos, latência baixa', latency: fast },
  empty: { description: 'Catálogo vazio', latency: fast, emptyCatalog: true },
  slow: { description: 'Latência alta (2–3 s) para ver skeletons', latency: { min: 2000, max: 3000 } },
  'variable-latency': { description: 'Latência variável (50–2500 ms)', latency: { min: 50, max: 2500 } },
  'out-of-order': { description: 'Respostas de listagem fora de ordem', latency: fast, outOfOrder: true },
  offline: { description: 'Sem conexão (todas as requisições falham)', latency: fast, offline: true },
  'catalog-error': {
    description: 'GET /nfts falha 2x com 503 e depois recupera',
    latency: fast,
    rules: [{ match: 'GET /api/nfts', effect: { status: 503, code: 'TRANSIENT' }, times: 2 }],
  },
  'server-error': {
    description: 'POST /orders sempre retorna 500',
    latency: fast,
    rules: [{ match: 'POST /api/orders', effect: { status: 500, code: 'TRANSIENT' } }],
  },
  forbidden: {
    description: 'GET /wallets retorna 403',
    latency: fast,
    rules: [{ match: 'GET /api/wallets', effect: { status: 403, code: 'FORBIDDEN' } }],
  },
  'cart-update-error': {
    description: 'PATCH de item do carrinho falha (rollback otimista)',
    latency: fast,
    rules: [{ match: 'PATCH /api/cart/items', effect: { status: 500, code: 'TRANSIENT' } }],
  },
  'favorite-error': {
    description: 'PUT de favorito falha (rollback otimista)',
    latency: fast,
    rules: [{ match: 'PUT /api/favorites', effect: { status: 500, code: 'TRANSIENT' } }],
  },
  'session-expired': {
    description: 'Sessão expira após 3 chamadas autenticadas',
    latency: fast,
    sessionExpiresAfter: 3,
  },
  'register-conflict': {
    description: 'Cadastro sempre conflita (e-mail em uso)',
    latency: fast,
    registerConflict: true,
  },
  'price-changed': {
    description: 'Preço muda durante a criação do pedido',
    latency: fast,
    priceChangeOnOrder: true,
  },
  'sold-out': { description: 'Edição esgota durante a compra', latency: fast, soldOutOnOrder: true },
  'order-timeout': {
    description: 'Pedido criado, mas a resposta estoura timeout (retry idempotente)',
    latency: fast,
    orderTimeoutOnce: true,
  },
  'payment-declined': { description: 'Pagamento recusado', latency: fast, paymentDeclined: true },
  'wallet-refused': { description: 'Conexão da carteira recusada', latency: fast, walletRefused: true },
} as const satisfies Record<string, ScenarioConfig>

export type ScenarioName = keyof typeof SCENARIOS
export const isScenario = (n: string | null | undefined): n is ScenarioName => !!n && n in SCENARIOS

const KEY = 'jg.mock.scenario'
export function getScenarioName(): ScenarioName {
  try {
    const fromUrl = new URLSearchParams(location.search).get('scenario')
    if (isScenario(fromUrl)) {
      localStorage.setItem(KEY, fromUrl)
      return fromUrl
    }
    const stored = localStorage.getItem(KEY)
    if (isScenario(stored)) return stored
  } catch {}
  const env = import.meta.env?.VITE_MOCK_SCENARIO
  return isScenario(env) ? env : 'default'
}
let override: ScenarioName | null = null
export function setScenario(name: ScenarioName) {
  override = name
  try {
    localStorage.setItem(KEY, name)
  } catch {}
}
export const getScenario = (): ScenarioConfig & { name: ScenarioName } => {
  const name = override ?? getScenarioName()
  return { name, ...(SCENARIOS[name] as ScenarioConfig) }
}
