import { expect, test } from '@playwright/test'
import { addToCart, connectWallet, gotoApp, login, NFT, ordersCount, setScenario } from './helpers'

test.describe('falhas de rede e recuperação', () => {
  test('latência alta mostra skeleton e depois o conteúdo', async ({ page }) => {
    await gotoApp(page, '/?scenario=slow')
    await expect(page.getByText('Carregando catálogo…')).toBeAttached()
    await expect(page.locator('.skeleton').first()).toBeVisible()
    await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.skeleton')).toHaveCount(0)
  })

  test('sem conexão mostra erro e recupera ao tentar novamente', async ({ page }) => {
    await gotoApp(page, '/?scenario=offline')
    await expect(page.getByText(/Não foi possível carregar o catálogo/)).toBeVisible({ timeout: 20_000 })

    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('article').first()).toBeVisible()
    await expect(page.getByText(/^48 resultados/)).toBeVisible()
  })

  test('falhas transitórias do catálogo são repetidas automaticamente', async ({ page }) => {
    await gotoApp(page, '/?scenario=catalog-error')
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20_000 })
  })

  test('erro 500 ao criar o pedido não cria pedido e permite nova tentativa', async ({ page }) => {
    await login(page)
    await addToCart(page, NFT.id, 1)
    await gotoApp(page, '/checkout?scenario=server-error')
    await connectWallet(page)
    await page.getByRole('button', { name: 'Confirmar pedido' }).click()

    await expect(page.getByText('Falha simulada pelo cenário')).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'Confirmar novamente' })).toBeEnabled()

    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Confirmar novamente' }).click()
    await expect(
      page.getByRole('heading', { name: /Aguardando confirmação|Pedido confirmado/ }),
    ).toBeVisible()
    expect(await ordersCount(page)).toBe(1)
  })

  test('acesso negado às carteiras mostra erro com nova tentativa', async ({ page }) => {
    await login(page)
    await gotoApp(page, '/wallets?scenario=forbidden')
    await expect(page.getByText(/Não foi possível carregar as carteiras/)).toBeVisible()

    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText(/Carteira principal/)).toBeVisible()
  })

  test('cadastro com conflito simulado pelo cenário', async ({ page }) => {
    await gotoApp(page, '/register?scenario=register-conflict')
    await page.getByLabel('Nome').fill('Nova Pessoa')
    await page.getByLabel('E-mail').fill('nova.pessoa@jungle.test')
    await page.getByLabel('Senha').fill('Senha@789')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Este e-mail já está em uso')).toBeVisible()
  })
})
