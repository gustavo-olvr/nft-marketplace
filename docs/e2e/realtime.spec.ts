import { expect, test } from '@playwright/test'
import {
  addToCart,
  blockRealtime,
  changePrice,
  connectWallet,
  gotoApp,
  login,
  NFT,
  ordersCount,
  realtime,
  sendStale,
  setAvailability,
  waitForRealtime,
} from './helpers'

const confirm = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Confirmar pedido' })

test.describe('tempo real (Socket.IO via MSW)', () => {
  test('preço alterado no carrinho avisa, atualiza o resumo e pede aceite', async ({ page }) => {
    await login(page)
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/cart')
    await expect(page.getByRole('heading', { name: NFT.name })).toBeVisible()
    await waitForRealtime(page)

    await changePrice(page, NFT.id, NFT.editionId, 20)

    await expect(page.getByText(/O preço de Lunar Jaguar \(Standard\) mudou/)).toBeVisible()
    await expect(page.getByText('O preço mudou desde que você adicionou este item.')).toBeVisible()
    await expect(page.getByText('1,1364 ETH').first()).toBeVisible()

    await page.getByRole('button', { name: 'Aceitar novo preço' }).click()
    await expect(page.getByText('O preço mudou desde que você adicionou este item.')).toHaveCount(0)
  })

  test('o checkout impede confirmar com cotação desatualizada', async ({ page }) => {
    await login(page)
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/checkout')
    await connectWallet(page)
    await waitForRealtime(page)
    await expect(confirm(page)).toBeEnabled()

    await changePrice(page, NFT.id, NFT.editionId, 20)

    await expect(page.getByText(/O preço de Lunar Jaguar \(Standard\) mudou/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Revisar no carrinho' })).toBeVisible()
    await expect(confirm(page)).toBeDisabled()
    expect(await ordersCount(page)).toBe(0)
  })

  test('detalhe reflete preço e disponibilidade para visitantes', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await expect(page.getByRole('radio', { name: /Standard: 0,947 ETH/ })).toBeVisible()
    await waitForRealtime(page)

    await changePrice(page, NFT.id, NFT.editionId, 20)
    await expect(page.getByRole('radio', { name: /Standard: 1,1364 ETH/ })).toBeVisible()

    await setAvailability(page, NFT.id, NFT.editionId, 0)
    await expect(page.getByRole('radio', { name: /Standard: 1,1364 ETH · Esgotada/ })).toBeVisible()
    await expect(page.getByText(/Lunar Jaguar \(Standard\) esgotou/)).toBeVisible()
  })

  test('catálogo reflete a atualização sem recarregar', async ({ page }) => {
    await gotoApp(page, '/?q=lunar jaguar')
    await expect(page.getByText('0,947 ETH')).toBeVisible()
    await waitForRealtime(page)

    await changePrice(page, NFT.id, NFT.editionId, 20)
    await expect(page.getByText('1,1364 ETH')).toBeVisible()
  })

  test('eventos duplicados ou antigos não regridem o estado nem repetem efeitos', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await waitForRealtime(page)

    await changePrice(page, NFT.id, NFT.editionId, 20)
    const updated = page.getByRole('radio', { name: /Standard: 1,1364 ETH/ })
    await expect(updated).toBeVisible()
    const notices = page.getByText(/O preço de Lunar Jaguar \(Standard\) mudou/)
    await expect(notices).toHaveCount(1)

    await realtime(page, 'replayLast')
    await sendStale(page, NFT.id)
    await page.waitForTimeout(600)

    await expect(updated).toBeVisible()
    await expect(page.getByText('999')).toHaveCount(0)
    await expect(notices).toHaveCount(1)
  })

  test('queda de conexão avisa, reconecta e volta a receber eventos', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await waitForRealtime(page)

    await blockRealtime(page, true)
    await expect(page.getByText(/Conexão em tempo real interrompida/)).toBeVisible()

    await blockRealtime(page, false)
    await expect(page.getByText(/Conexão em tempo real interrompida/)).toHaveCount(0, { timeout: 20_000 })

    await changePrice(page, NFT.id, NFT.editionId, 20)
    await expect(page.getByRole('radio', { name: /Standard: 1,1364 ETH/ })).toBeVisible()
  })

  test('pedido pendente sobrevive à queda de conexão sem criar outra compra', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/checkout')
    await connectWallet(page)
    await waitForRealtime(page)
    await confirm(page).click()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()

    await blockRealtime(page, true)
    await page.waitForTimeout(4000)
    await blockRealtime(page, false)

    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 30_000 })
    expect(await ordersCount(page)).toBe(1)
  })

  test('recarregar a página com pedido pendente recupera o mesmo pedido', async ({ page }) => {
    await login(page)
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/checkout')
    await connectWallet(page)
    await confirm(page).click()
    await expect(page).toHaveURL(/\/orders\//)

    await page.reload()
    await expect(
      page.getByRole('heading', { name: /Aguardando confirmação|Pedido confirmado/ }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 20_000 })
    expect(await ordersCount(page)).toBe(1)
  })
})
