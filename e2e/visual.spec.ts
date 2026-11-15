import { expect, test, type Page } from '@playwright/test'
import { addToCart, connectWallet, gotoApp, login, NFT, waitForImages } from './helpers'

async function stable(page: Page) {
  await waitForImages(page)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

test.describe('regressão visual @visual', () => {
  test('início', async ({ page }) => {
    await gotoApp(page, '/')
    await expect(page.locator('article').first()).toBeVisible()
    await stable(page)
    await expect(page).toHaveScreenshot('inicio.png')
  })

  test('detalhe do NFT', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await expect(page.getByRole('heading', { level: 1, name: NFT.name })).toBeVisible()
    await stable(page)
    await expect(page).toHaveScreenshot('detalhe.png')
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, NFT.id, 2)
    await gotoApp(page, '/cart')
    await expect(page.getByRole('heading', { name: NFT.name })).toBeVisible()
    await expect(page.getByText('Subtotal')).toBeVisible()
    await stable(page)
    await expect(page).toHaveScreenshot('carrinho.png')
  })

  test('pagamento', async ({ page }) => {
    await login(page)
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/checkout')
    await connectWallet(page)
    await expect(page.getByText('Subtotal')).toBeVisible()
    await stable(page)
    await expect(page).toHaveScreenshot('pagamento.png')
  })
})
