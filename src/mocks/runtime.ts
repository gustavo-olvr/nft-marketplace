import { delay, HttpResponse } from 'msw'
import type { ApiErrorCode, User } from '@/contracts'
import { HTTP_TIMEOUT_MS } from '@/config'
import { bump, commit, db } from './db'
import { getScenario } from './scenarios'
import { mulberry32 } from './util'

export const json = (data: unknown, status = 200) =>
  HttpResponse.json(data as Record<string, unknown>, { status })
export const fail = (
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown } = {},
) => HttpResponse.json({ error: { code, message, ...extra } }, { status })

export async function gate(req: Request): Promise<Response | undefined> {
  const sc = getScenario()
  const url = new URL(req.url)
  const key = `${req.method} ${url.pathname}`
  const n = bump('requests')
  const rand = mulberry32(n * 9973)
  let ms = sc.latency.min + rand() * (sc.latency.max - sc.latency.min)
  if (sc.outOfOrder && key === 'GET /api/nfts' && bump('nftsList') % 2 === 1) ms += 1500
  await delay(Math.round(ms))
  commit()
  if (sc.offline) return HttpResponse.error()
  for (const [i, rule] of (sc.rules ?? []).entries()) {
    if (!key.includes(rule.match)) continue
    const used = bump(`rule:${sc.name}:${i}`)
    if (rule.times !== undefined && used > rule.times) continue
    if (rule.effect === 'network') return HttpResponse.error()
    if (rule.effect === 'timeout') {
      await delay(HTTP_TIMEOUT_MS + 2000)
      return fail(504, 'TRANSIENT', 'Timeout')
    }
    return fail(
      rule.effect.status,
      (rule.effect.code ?? 'TRANSIENT') as ApiErrorCode,
      'Falha simulada pelo cenário',
    )
  }
  return undefined
}

export type Auth = { user: User & { passwordHash: string; bio: string }; token: string }
export function authenticate(req: Request): Auth | Response {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const s = db()
  if (!token) return fail(401, 'UNAUTHENTICATED', 'Autenticação necessária')
  if (s.expiredTokens.includes(token)) return fail(401, 'SESSION_EXPIRED', 'Sessão expirada')
  const sess = s.sessions[token]
  if (!sess) return fail(401, 'UNAUTHENTICATED', 'Sessão inválida')
  const sc = getScenario()
  if (
    Date.now() > sess.expiresAt ||
    (sc.sessionExpiresAfter !== undefined && bump('authed') > sc.sessionExpiresAfter)
  ) {
    delete s.sessions[token]
    s.expiredTokens.push(token)
    commit()
    return fail(401, 'SESSION_EXPIRED', 'Sessão expirada')
  }
  const user = s.users.find((u) => u.id === sess.userId)
  return user ? { user, token } : fail(401, 'UNAUTHENTICATED', 'Sessão inválida')
}

export const publicUser = (u: {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}): User => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl })
export const readBody = async <T>(req: Request): Promise<T | null> =>
  req
    .json()
    .then((b) => b as T)
    .catch(() => null)
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const passwordIssue = (p: string) =>
  p.length < 8
    ? 'Mínimo de 8 caracteres'
    : !/[A-Za-z]/.test(p) || !/\d/.test(p)
      ? 'Use letras e números'
      : null
