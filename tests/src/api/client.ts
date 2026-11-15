import axios, { AxiosError } from 'axios'
import { API_BASE_URL, HTTP_TIMEOUT_MS } from '@/config'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { getGuestId, getToken } from '@/lib/session-storage'

export class ApiError extends Error {
  constructor(
    public readonly kind: 'http' | 'timeout' | 'network' | 'canceled',
    message: string,
    public readonly status?: number,
    public readonly code?: ApiErrorCode,
    public readonly fieldErrors?: Record<string, string>,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get retryable() {
    return (
      this.kind === 'network' || this.kind === 'timeout' || (this.status !== undefined && this.status >= 500)
    )
  }
}

export const http = axios.create({ baseURL: API_BASE_URL, timeout: HTTP_TIMEOUT_MS })

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Id', getGuestId())
  return config
})

http.interceptors.response.use(undefined, (err: unknown) => {
  if (axios.isCancel(err)) return Promise.reject(new ApiError('canceled', 'Requisição cancelada'))
  const e = err as AxiosError<ApiErrorBody>
  if (e.response) {
    const body = e.response.data?.error
    return Promise.reject(
      new ApiError(
        'http',
        body?.message ?? 'Erro inesperado',
        e.response.status,
        body?.code,
        body?.fieldErrors,
        body?.details,
      ),
    )
  }
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT')
    return Promise.reject(new ApiError('timeout', 'A requisição demorou demais'))
  return Promise.reject(new ApiError('network', 'Sem conexão com o servidor'))
})
