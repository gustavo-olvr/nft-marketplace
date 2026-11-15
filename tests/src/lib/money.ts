const DECIMALS = 18
const UNIT = 10n ** BigInt(DECIMALS)
const RE = /^\d+(\.\d{1,18})?$/

export function toWei(eth: string): bigint {
  if (!RE.test(eth)) throw new Error(`Valor ETH inválido: "${eth}"`)
  const [whole = '0', frac = ''] = eth.split('.')
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(DECIMALS, '0'))
}

export function fromWei(wei: bigint): string {
  const whole = wei / UNIT
  const frac = (wei % UNIT).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}

export const sumEth = (values: string[]): string => fromWei(values.reduce((a, v) => a + toWei(v), 0n))
export const mulEth = (eth: string, qty: number): string => {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(eth) * BigInt(qty))
}
export const pctEth = (eth: string, bps: number): string => fromWei((toWei(eth) * BigInt(bps)) / 10_000n)
export const subEth = (a: string, b: string): string => fromWei(toWei(a) - toWei(b))
export const addEth = (a: string, b: string): string => fromWei(toWei(a) + toWei(b))
export const cmpEth = (a: string, b: string): number => {
  const x = toWei(a),
    y = toWei(b)
  return x < y ? -1 : x > y ? 1 : 0
}

export function formatEth(eth: string, locale = 'pt-BR'): string {
  const [w = '0', f = ''] = eth.split('.')
  const whole = new Intl.NumberFormat(locale).format(BigInt(w))
  const dec = new Intl.NumberFormat(locale).format(1.1).charAt(1)
  return `${whole}${dec}${f.padEnd(2, '0')} ETH`
}
