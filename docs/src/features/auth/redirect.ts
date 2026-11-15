const BLOCKED = ['/login', '/register']

export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  if (BLOCKED.some((path) => value === path || value.startsWith(`${path}?`))) return undefined
  return value
}
