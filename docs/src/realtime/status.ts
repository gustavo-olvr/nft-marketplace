import { useSyncExternalStore } from 'react'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

let status: RealtimeStatus = 'idle'
const listeners = new Set<() => void>()

export function setRealtimeStatus(next: RealtimeStatus) {
  if (next === status) return
  status = next
  listeners.forEach((listener) => listener())
}

export const getRealtimeStatus = () => status

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useRealtimeStatus = () => useSyncExternalStore(subscribe, getRealtimeStatus)
