import { useSyncExternalStore } from 'react'

export interface Notice {
  id: number
  message: string
}

const MAX_NOTICES = 3
const AUTO_DISMISS_MS = 10_000

let notices: Notice[] = []
let nextId = 1
const listeners = new Set<() => void>()

function publish(next: Notice[]) {
  notices = next
  listeners.forEach((listener) => listener())
}

export function dismissNotice(id: number) {
  publish(notices.filter((notice) => notice.id !== id))
}

export function notify(message: string) {
  const notice = { id: nextId++, message }
  publish([...notices.slice(-(MAX_NOTICES - 1)), notice])
  setTimeout(() => dismissNotice(notice.id), AUTO_DISMISS_MS)
}

export const clearNotices = () => publish([])
export const getNotices = () => notices

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useNotices = () => useSyncExternalStore(subscribe, getNotices)
