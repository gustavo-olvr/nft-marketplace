const TOKEN = 'jg.token'
const GUEST = 'jg.guestId'
const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const getToken = () => safe(() => localStorage.getItem(TOKEN), null)
export const setToken = (t: string | null) =>
  safe(() => (t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN)), undefined)
export function getGuestId(): string {
  const cur = safe(() => localStorage.getItem(GUEST), null)
  if (cur) return cur
  const id = `guest_${crypto.randomUUID()}`
  safe(() => localStorage.setItem(GUEST, id), undefined)
  return id
}
export const clearGuestId = () => safe(() => localStorage.removeItem(GUEST), undefined)
