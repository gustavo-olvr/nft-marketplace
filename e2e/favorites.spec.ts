import { expect, test } from '@playwright/test'
import { gotoApp, login, NFT, setScenario } from './helpers'

const add = { name: `Adicionar ${NFT.name} aos favoritos` }
const remove = { name: `Remover ${NFT.name} dos favoritos` }

test.describe('favoritos', () => {
  test('visitante é levado ao login e volta ao NFT', async ({ page }) => {
    await gotoApp(page, `/nfts/${NFT.id}`)
    await page.getByRole('button', add).click()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('E-mail').fill('ada@jungle.test')
    await page.getByLabel('Senha').fill('Senha@123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(new RegExp(`/nfts/${NFT.id}`))
  })

  test('favoritar e desfavoritar persiste após refresh', async ({ page }) => {
    await login(page)
    await gotoApp(page, `/nfts/${NFT.id}`)

    await page.getByRole('button', add).click()
    await expect(page.getByRole('button', remove)).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(page.getByRole('button', remove)).toBeVisible()

    await page.getByRole('button', remove).click()
    await expect(page.getByRole('button', add)).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByRole('button', add)).toBeVisible()
  })

  test('falha na mutation desfaz a atualização otimista e permite tentar de novo', async ({ page }) => {
    await login(page)
    await gotoApp(page, `/nfts/${NFT.id}?scenario=favorite-error`)

    await page.getByRole('button', add).click()
    await expect(page.getByText(/Não foi possível atualizar seus favoritos/)).toBeVisible()
    await expect(page.getByRole('button', add)).toHaveAttribute('aria-pressed', 'false')

    await setScenario(page, 'default')
    await page.getByRole('button', add).click()
    await expect(page.getByRole('button', remove)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/Não foi possível atualizar seus favoritos/)).toHaveCount(0)
  })
})
