import { expect, test } from '@playwright/test'
import { cardPrices, closeFilters, gotoApp, openFilters, setScenario } from './helpers'

test.describe('catálogo', () => {
  test('busca atualiza a lista e a URL', async ({ page }) => {
    await gotoApp(page)
    await expect(page.getByText(/^48 resultados/)).toBeVisible()

    const opened = await openFilters(page)
    await page.getByLabel('Buscar').fill('jaguar')
    await expect(page).toHaveURL(/q=jaguar/)
    await closeFilters(page, opened)

    await expect(page.getByText(/^8 resultados/)).toBeVisible()
  })

  test('filtros combinados e botão de limpar', async ({ page }) => {
    await gotoApp(page)
    const opened = await openFilters(page)
    await page.getByLabel('Buscar').fill('jaguar')
    await page.getByRole('checkbox', { name: 'Arte' }).check()
    await expect(page).toHaveURL(/category=art/)
    await closeFilters(page, opened)
    await expect(page.getByText(/^2 resultados/)).toBeVisible()

    const reopened = await openFilters(page)
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await closeFilters(page, reopened)
    await expect(page.getByText(/^48 resultados/)).toBeVisible()
  })

  test('somente disponíveis exclui esgotados', async ({ page }) => {
    await gotoApp(page)
    const opened = await openFilters(page)
    await page.getByRole('checkbox', { name: 'Somente disponíveis' }).check()
    await closeFilters(page, opened)
    await expect(page.getByText(/^44 resultados/)).toBeVisible()
  })

  test('ordenação por preço', async ({ page }) => {
    await gotoApp(page, '/?sort=price_asc')
    await expect(page.locator('article').first()).toBeVisible()
    const asc = await cardPrices(page)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))

    const opened = await openFilters(page)
    await page.getByLabel('Ordenar por').selectOption('price_desc')
    await expect(page).toHaveURL(/sort=price_desc/)
    await closeFilters(page, opened)
    await expect
      .poll(async () => {
        const prices = await cardPrices(page)
        return prices[0]! >= prices[prices.length - 1]!
      })
      .toBe(true)
    const desc = await cardPrices(page)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
  })

  test('paginação, histórico e refresh preservam o estado', async ({ page }) => {
    await gotoApp(page)
    await expect(page.getByText('Página 1 de 4')).toBeVisible()

    await page.getByRole('button', { name: 'Próxima' }).click()
    await expect(page.getByText('Página 2 de 4')).toBeVisible()
    await expect(page).toHaveURL(/page=2/)

    await page.reload()
    await expect(page.getByText('Página 2 de 4')).toBeVisible()

    await page.goBack()
    await expect(page.getByText('Página 1 de 4')).toBeVisible()
    await page.goForward()
    await expect(page.getByText('Página 2 de 4')).toBeVisible()
  })

  test('mudar um filtro reinicia a paginação', async ({ page }) => {
    await gotoApp(page, '/?page=3')
    await expect(page.getByText('Página 3 de 4')).toBeVisible()
    const opened = await openFilters(page)
    await page.getByRole('checkbox', { name: 'Somente disponíveis' }).check()
    await closeFilters(page, opened)
    await expect(page.getByText(/Página 1 de/)).toBeVisible()
  })

  test('valores inválidos na URL caem nos padrões', async ({ page }) => {
    await gotoApp(page, '/?page=abc&category=banana&sort=xyz')
    await expect(page.getByText(/^48 resultados/)).toBeVisible()
    await expect(page.getByText('Página 1 de 4')).toBeVisible()
  })

  test('resultado vazio mantém os filtros disponíveis', async ({ page }) => {
    await gotoApp(page, '/?q=zzzz')
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    const opened = await openFilters(page)
    await expect(page.getByLabel('Buscar')).toHaveValue('zzzz')
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await closeFilters(page, opened)
    await expect(page.getByText(/^48 resultados/)).toBeVisible()
  })

  test('cenário de catálogo vazio', async ({ page }) => {
    await gotoApp(page, '/?scenario=empty')
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await setScenario(page, 'default')
  })

  test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ page }) => {
    await gotoApp(page, '/?scenario=out-of-order')
    await expect(page.getByText(/^48 resultados/)).toBeVisible({ timeout: 15_000 })

    const opened = await openFilters(page)
    const search = page.getByLabel('Buscar')
    await search.fill('jaguar')
    await expect(page.getByText(/^8 resultados/)).toBeVisible({ timeout: 15_000 })

    await search.fill('cosmic')
    await page.waitForTimeout(400)
    await search.fill('lunar jaguar')
    await page.waitForTimeout(3500)
    await closeFilters(page, opened)

    await expect(page.getByText(/^1 resultados/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Lunar Jaguar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Cosmic Jaguar' })).toHaveCount(0)
  })
})
