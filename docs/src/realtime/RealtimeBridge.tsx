import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session'
import { getToken } from '@/lib/session-storage'
import { createRealtime } from './client'

export function RealtimeBridge() {
  const qc = useQueryClient()
  const session = useSession()
  const realtime = useMemo(() => createRealtime({ queryClient: qc }), [qc])
  const userId = session.data?.user.id ?? null
  const token = getToken()

  useEffect(() => {
    if (token && !userId) return
    void realtime.start({ token, userId })
    return () => realtime.stop()
  }, [realtime, token, userId])

  return null
}
