import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { emitSessionExpired } from '@/lib/session-events'
import { getToken } from '@/lib/session-storage'

function isSessionFailure(error: unknown) {
  return error instanceof ApiError && error.status === 401 && getToken() !== null
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isSessionFailure(error)) emitSessionExpired()
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.mutationKey?.[0] === 'logout') return
      if (isSessionFailure(error)) emitSessionExpired()
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => error instanceof ApiError && error.retryable && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})
