import { expect, type Page } from '@playwright/test'

export const ADA = { name: 'Ada Collector', email: 'ada@jungle.test', password: 'Senha@123' }
export const BRUNO = { name: 'Bruno Minter', email: 'bruno@jungle.test', password: 'Senha@456' }

export const NFT = {
  id: 'nft_2',
  name: 'Lunar Jaguar',
  editionId: 'e_2_1',
  editionLabel: 'Standard',
  price: '0.947',
}
export const SOLD_OUT_NFT = { id: 'nft_1', name: 'Neon Jaguar' }

export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

export async function gotoApp(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByRole('banner')).toBeVisible()
  await page.waitForFunction(() => Boolean((window as any).__mock))
}

export async function setScenario(page: Page, name: string) {
  await page.evaluate((scenario) => (window as any).__mock.setScenario(scenario), name)
}

export async function expireSession(page: Page) {
  await page.evaluate(() => (window as any).__mock.expireSession())
  await page.waitForTimeout(300)
}

export async function changePrice(page: Page, nftId: string, editionId: string, percent: number) {
  await page.evaluate(
    ([a, b, c]) => (window as any).__mock.realtime.changePrice(a as string, b as string, c as number),
    [nftId, editionId, percent],
  )
}

export async function setAvailability(page: Page, nftId: string, editionId: string, available: number) {
  await page.evaluate(
    ([a, b, c]) => (window as any).__mock.realtime.setAvailability(a as string, b as string, c as number),
    [nftId, editionId, available],
  )
}

export async function realtime(page: Page, action: 'replayLast' | 'dropConnections') {
  await page.evaluate((name) => (window as any).__mock.realtime[name](), action)
}

export async function sendStale(page: Page, nftId: string) {
  await page.evaluate((id) => (window as any).__mock.realtime.sendStaleNft(id), nftId)
}

export async function blockRealtime(page: Page, value: boolean) {
  await page.evaluate((v) => (window as any).__mock.realtime.block(v), value)
}

export async function waitForRealtime(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (window as any).__mock.realtime.connections()))
    .toBeGreaterThan(0)
  await page.waitForTimeout(200)
}

export function ordersCount(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('jg.mock.db.v1')
    return raw ? (JSON.parse(raw) as { orders: unknown[] }).orders.length : 0
  })
}

export async function login(page: Page, user = ADA, path = '/login') {
  await gotoApp(page, path)
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

export async function addToCart(page: Page, nftId = NFT.id, quantity = 1) {
  await gotoApp(page, `/nfts/${nftId}`)
  await page.getByLabel('Quantidade').fill(String(quantity))
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByText(/Adicionado ao carrinho/)).toBeVisible()
}

export const cartLink = (page: Page) => page.getByRole('link', { name: /^Carrinho,/ })

export async function connectWallet(page: Page) {
  await page.getByRole('button', { name: /^Conectar/ }).click()
  await expect(page.getByText(/Conectada/)).toBeVisible()
}

export async function openFilters(page: Page) {
  const trigger = page.getByRole('button', { name: /^Filtros/ })
  if (await trigger.isVisible()) {
    await trigger.click()
    return true
  }
  return false
}

export async function closeFilters(page: Page, opened: boolean) {
  if (opened) await page.getByRole('button', { name: 'Ver resultados' }).click()
}

export async function cardPrices(page: Page): Promise<number[]> {
  const texts = await page.locator('article').allInnerTexts()
  return texts.map((text) => {
    const match = text.match(/([\d.,]+)\s*ETH/)
    return match ? Number.parseFloat(match[1]!.replace(',', '.')) : Number.NaN
  })
}

export async function waitForImages(page: Page) {
  await page.evaluate(() =>
    Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined))),
  )
}
