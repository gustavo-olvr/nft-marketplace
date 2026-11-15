const STORAGE_KEY = 'jg.idempotency'

interface Stored {
  signature: string
  key: string
}

export function idempotencyKeyFor(body: unknown): string {
  const signature = JSON.stringify(body)
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | null
    if (stored?.signature === signature) return stored.key
  } catch {}
  const key = crypto.randomUUID()
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ signature, key } satisfies Stored))
  } catch {}
  return key
}

export function clearIdempotencyKey() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}
