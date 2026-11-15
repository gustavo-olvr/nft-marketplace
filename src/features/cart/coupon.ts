import { useCallback, useState } from 'react'

const KEY = 'jg.coupon'

function read(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

function write(value: string | undefined) {
  try {
    if (value) sessionStorage.setItem(KEY, value)
    else sessionStorage.removeItem(KEY)
  } catch {
    return
  }
}

export const clearStoredCoupon = () => write(undefined)

export function useCoupon() {
  const [coupon, setState] = useState<string | undefined>(read)
  const setCoupon = useCallback((value: string | undefined) => {
    write(value)
    setState(value)
  }, [])
  return [coupon, setCoupon] as const
}
