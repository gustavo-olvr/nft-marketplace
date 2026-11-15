import { expect, test } from '@playwright/test'
import { gotoApp, NFT, SOLD_OUT_NFT } from './helpers'

test.describe('detalhe do NFT', () => {
  test('acesso direto e navegação a partir do catálogo', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await expect(page.getByRole('heading', { level: 1, name: NFT.name })).toBeVisible()
    await expect(page).toHaveTitle(new RegExp(NFT.name))

    await gotoApp(page, '/?q=lunar jaguar')
    await page.getByRole('link', { name: NFT.name }).click()
    await expect(page).toHaveURL(new RegExp(`/nfts/${NFT.id}`))
    await expect(page.getByRole('heading', { level: 1, name: NFT.name })).toBeVisible()
  })

  test('NFT inexistente e rota inexistente', async ({ page }) => {
    await gotoApp(page, '/nfts/abc')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page.getByRole('heading', { name: 'Catálogo de NFTs' })).toBeVisible()

    await gotoApp(page, '/rota-que-nao-existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição esgotada desabilita a compra', async ({ page }) => {
    await gotoApp(page, `/nfts/${SOLD_OUT_NFT.id}`)
    await expect(page.getByText('Edição esgotada.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  })

  test('quantidade respeita o limite por pedido', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await expect(page.getByText('Máximo de 5 por pedido.')).toBeVisible()
    const quantity = page.getByLabel('Quantidade')
    await quantity.fill('99')
    await expect(quantity).toHaveValue('5')
    await quantity.fill('0')
    await expect(quantity).toHaveValue('1')
  })

  test('trocar de edição atualiza o limite', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await page.getByRole('radio', { name: /Limited/ }).check()
    await expect(page.getByText('Máximo de 3 por pedido.')).toBeVisible()
  })
})
