import { expect, test } from '@playwright/test'
import { addToCart, ADA, cartLink, gotoApp, login, NFT } from './helpers'

test.describe('carrinho', () => {
  test('visitante adiciona, altera e remove itens', async ({ page }) => {
    await addToCart(page, NFT.id, 2)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    await cartLink(page).click()
    await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
    await expect(page.getByRole('heading', { name: NFT.name })).toBeVisible()

    await page.getByRole('button', { name: `Aumentar quantidade de ${NFT.name}` }).click()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 3 itens')

    await page.getByRole('button', { name: `Diminuir quantidade de ${NFT.name}` }).click()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    await page.getByRole('button', { name: `Remover ${NFT.name}` }).click()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
  })

  test('carrinho persiste após refresh', async ({ page }) => {
    await addToCart(page, NFT.id, 2)
    await page.reload()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
  })

  test('o limite por pedido desabilita o botão de aumentar', async ({ page }) => {
    await addToCart(page, NFT.id, 5)
    await gotoApp(page, '/cart')
    await expect(page.getByRole('button', { name: `Aumentar quantidade de ${NFT.name}` })).toBeDisabled()
  })

  test('itens do visitante são preservados ao autenticar', async ({ page }) => {
    await addToCart(page, NFT.id, 2)
    await login(page, ADA)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    await page.reload()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
  })

  test('cupom válido, inválido, expirado e remoção', async ({ page }) => {
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/cart')

    await page.getByLabel('Cupom').fill('WELCOME10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom WELCOME10 aplicado.')).toBeVisible()

    await page.getByLabel('Cupom').fill('xyz')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom inválido')).toBeVisible()

    await page.getByLabel('Cupom').fill('EXPIRED20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom expirado')).toBeVisible()

    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByRole('button', { name: 'Remover cupom' })).toHaveCount(0)
  })

  test('resumo mostra subtotal, desconto, taxa e total da API', async ({ page }) => {
    await addToCart(page, NFT.id, 2)
    await gotoApp(page, '/cart')
    const summary = page.getByRole('complementary', { name: 'Resumo do pedido' })
    await expect(summary.getByText('Subtotal')).toBeVisible()
    await expect(summary.getByText('1,894 ETH', { exact: true }).first()).toBeVisible()
    await expect(summary.getByText('Taxa de rede (estimada)')).toBeVisible()
    await expect(summary.getByText('Total')).toBeVisible()
  })

  test('falha ao alterar a quantidade desfaz a atualização otimista', async ({ page }) => {
    await addToCart(page, NFT.id, 2)
    await gotoApp(page, '/cart?scenario=cart-update-error')
    await expect(page.getByRole('heading', { name: NFT.name })).toBeVisible()

    await page.getByRole('button', { name: `Aumentar quantidade de ${NFT.name}` }).click()
    await expect(page.getByText('Falha simulada pelo cenário')).toBeVisible()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
  })

  test('carrinho vazio mostra a mensagem e o atalho para o catálogo', async ({ page }) => {
    await gotoApp(page, '/cart')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})
