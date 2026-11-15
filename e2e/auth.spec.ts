import { expect, test } from '@playwright/test'
import { ADA, BRUNO, expireSession, gotoApp, login, NFT } from './helpers'

test.describe('conta e sessão', () => {
  test('cadastro cria a conta e inicia a sessão', async ({ page }) => {
    await gotoApp(page, '/register')
    await page.getByLabel('Nome').fill('Carla Teste')
    await page.getByLabel('E-mail').fill(`carla.${Date.now()}@jungle.test`)
    await page.getByLabel('Senha').fill('Senha@789')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Carla Teste' })).toBeVisible()
  })

  test('cadastro valida campos e trata conflito de e-mail', async ({ page }) => {
    await gotoApp(page, '/register')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Informe seu nome')).toBeVisible()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()
    await expect(page.getByText('Mínimo de 8 caracteres')).toBeVisible()

    await page.getByLabel('Nome').fill('Outra Ada')
    await page.getByLabel('E-mail').fill(ADA.email)
    await page.getByLabel('Senha').fill('Senha@789')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Este e-mail já está em uso')).toBeVisible()
  })

  test('login inválido mostra erro e login válido persiste após refresh', async ({ page }) => {
    await gotoApp(page, '/login')
    await page.getByLabel('E-mail').fill(ADA.email)
    await page.getByLabel('Senha').fill('senha-errada1')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('E-mail ou senha incorretos')).toBeVisible()

    await page.getByLabel('Senha').fill(ADA.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
    await expect(page.getByRole('link', { name: ADA.name })).toBeVisible()
  })

  test('rota privada redireciona ao login e retorna ao fluxo anterior', async ({ page }) => {
    await gotoApp(page, '/checkout')
    await expect(page).toHaveURL(/\/login\?.*redirect=/)
    await page.getByLabel('E-mail').fill(ADA.email)
    await page.getByLabel('Senha').fill(ADA.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  })

  test('logout encerra a sessão e protege as rotas', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

    await gotoApp(page, '/profile')
    await expect(page).toHaveURL(/\/login/)
  })

  test('sessão expirada leva ao login com aviso e retorna à tela anterior', async ({ page }) => {
    await login(page)
    await expireSession(page)

    await page.getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/Sua sessão expirou/)).toBeVisible()

    await page.getByLabel('E-mail').fill(ADA.email)
    await page.getByLabel('Senha').fill(ADA.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/wallets/)
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  })

  test('sessão expira pelo tempo (relógio controlado)', async ({ page }) => {
    await page.clock.install()
    await login(page)
    await page.clock.fastForward('01:05:00')

    await page.getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/Sua sessão expirou/)).toBeVisible()
  })

  test('troca de usuário não vaza dados privados', async ({ page }) => {
    await login(page, ADA)
    await gotoApp(page, `/nfts/${NFT.id}`)
    await page.getByRole('button', { name: `Adicionar ${NFT.name} aos favoritos` }).click()
    await expect(page.getByRole('button', { name: `Remover ${NFT.name} dos favoritos` })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await login(page, BRUNO)
    await gotoApp(page, `/nfts/${NFT.id}`)
    await expect(page.getByRole('button', { name: `Adicionar ${NFT.name} aos favoritos` })).toBeVisible()
    await expect(page.getByRole('link', { name: BRUNO.name })).toBeVisible()
  })

  test('validação do login é acessível', async ({ page }) => {
    await gotoApp(page, '/login')
    await page.getByRole('button', { name: 'Entrar' }).click()

    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Informe um e-mail válido')
  })
})
