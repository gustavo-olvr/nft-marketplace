import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSession, login, logout, register } from '@/api/auth'
import { mergeCart } from '@/api/cart'
import type { AuthResponse, SessionResponse } from '@/contracts'
import { clearGuestId, getGuestId, getToken, setToken } from '@/lib/session-storage'

export const sessionKeys = { me: ['session'] as const }

export function useSession() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: ({ signal }) => (getToken() === null ? Promise.resolve(null) : getSession(signal)),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function clearPrivateCache(qc: QueryClient) {
  qc.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKeys.me[0] })
  qc.setQueryData<SessionResponse | null>(sessionKeys.me, null)
}

async function completeLogin(qc: QueryClient, auth: AuthResponse) {
  setToken(auth.token)
  clearPrivateCache(qc)
  await mergeCart({ guestId: getGuestId() }).catch(() => undefined)
  clearGuestId()
  const session: SessionResponse = { user: auth.user, expiresAt: auth.expiresAt }
  qc.setQueryData<SessionResponse | null>(sessionKeys.me, () => session)
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['login'],
    mutationFn: login,
    onSuccess: (auth) => completeLogin(qc, auth),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['register'],
    mutationFn: register,
    onSuccess: (auth) => completeLogin(qc, auth),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['logout'],
    mutationFn: logout,
    onSettled: () => {
      setToken(null)
      clearPrivateCache(qc)
    },
  })
}
