import { http } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, SessionResponse } from '@/contracts'

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/register', body)
  return data
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/login', body)
  return data
}

export async function getSession(signal?: AbortSignal): Promise<SessionResponse> {
  const { data } = await http.get<SessionResponse>('/auth/session', { signal })
  return data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
