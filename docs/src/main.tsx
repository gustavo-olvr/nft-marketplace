import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { queryClient } from './lib/query-client'
import { clearPrivateCache } from './features/auth/session'
import { onSessionExpired } from './lib/session-events'
import { getToken, setToken } from './lib/session-storage'
import { router } from './router'

async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { startMocking } = await import('./mocks/browser')
  await startMocking()
}

onSessionExpired(() => {
  if (!getToken()) return
  const href = router.state.location.href
  setToken(null)
  clearPrivateCache(queryClient)
  router.navigate({ to: '/login', search: { redirect: href, expired: true } })
})

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
