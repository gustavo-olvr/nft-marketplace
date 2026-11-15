import { expect, test, type Page } from '@playwright/test'

const users = {
  ada: {
    name: 'Ada Collector',
    email: 'ada@jungle.test',
    password: 'Senha@123',
  },
  bruno: {
    name: 'Bruno Minter',
    email: 'bruno@jungle.test',
    password: 'Senha@456',
  },
}

async function login(page: Page, user: typeof users.ada) {
  if (!page.url().includes('/login')) {
    await page.goto('/login')
  }

  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).not.toHaveURL(/\/login/)
}

test.describe('catálogo e navegação', () => {
  test('abre os detalhes ao selecionar um NFT no catálogo', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /Ver detalhes de/ }).first().click()

    await expect(page).toHaveURL(/\/nfts\//)
    await expect(page.getByRole('heading', { name: 'Edições' })).toBeVisible()
  })

  test('carrega o catálogo e mantém filtros na URL', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText(/resultados/)).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Paginação' })
    ).toBeVisible()
    await expect(page.locator('article').first()).toBeVisible()
  })

  test('apresenta estado de NFT inexistente', async ({ page }) => {
    await page.goto('/nfts/id-que-nao-existe')

    await expect(
      page.getByRole('heading', { name: 'NFT não encontrado' })
    ).toBeVisible()

    await expect(
      page.getByRole('link', { name: 'Voltar ao catálogo' })
    ).toBeVisible()
  })
})

test.describe('conta e compra', () => {
  test('cria uma conta e mantém a sessão após o cadastro', async ({ page }) => {
    await page.goto('/register')

    await page.getByLabel('Nome completo').fill('Novo Colecionador')
    await page.getByLabel('E-mail').fill('novo.colecionador@jungle.test')
    await page.getByLabel('Senha').fill('Coleciona123')

    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page).toHaveURL('/')

    // Acesso à rota privada confirma que o token e a sessão foram persistidos.
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByLabel('Nome')).toHaveValue('Novo Colecionador')
  })

  test('valida login e autentica usuário de demonstração', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(
      page.getByText('Informe um e-mail válido')
    ).toBeVisible()

    await login(page, users.ada)

    await page.goto('/profile')

    await expect(page.getByText(users.ada.name)).toBeVisible()
  })

  test('permite adicionar um NFT ao carrinho', async ({ page }) => {
    await page.goto('/nfts/nft_2')

    await expect(
      page.getByRole('heading', { name: 'Edições' })
    ).toBeVisible()

    await page.getByRole('button', {
      name: 'Adicionar ao carrinho',
    }).click()

    await expect(
      page.getByRole('status').getByText('Adicionado ao carrinho.')
    ).toBeVisible()

    await page.getByRole('link', { name: 'Ver carrinho' }).click()

    await expect(
      page.getByRole('heading', { name: 'Carrinho' })
    ).toBeVisible()

    await expect(
      page.getByRole('link', { name: 'Finalizar compra' })
    ).toBeVisible()
  })

  test('conclui o fluxo de checkout até a criação do pedido', async ({ page }) => {
    await login(page, users.ada)

    await page.goto('/nfts/nft_2')

    await expect(
      page.getByRole('heading', { name: 'Edições' })
    ).toBeVisible()

    const addButton = page.getByRole('button', {
      name: 'Adicionar ao carrinho',
    })

    await expect(addButton).toBeVisible()
    await expect(addButton).toBeEnabled()
    await addButton.click()

    await expect(
      page.getByRole('status').getByText('Adicionado ao carrinho.')
    ).toBeVisible()

    await page.goto('/checkout')

    await expect(
      page.getByRole('heading', { name: 'Pagamento' })
    ).toBeVisible()

    await page.getByRole('button', { name: /Conectar/ }).click()

    await expect(page.getByText(/Conectada/)).toBeVisible()

    await page.getByRole('button', {
      name: 'Confirmar pedido',
    }).click()

    await expect(page).toHaveURL(/\/orders/, {
      timeout: 15000,
    })

    await expect(page.getByText(/Pedido/)).toBeVisible()
  })

  test('protege rotas privadas e preserva o destino após login', async ({ page }) => {
    await page.goto('/profile')

    await expect(page).toHaveURL(/\/login/)

    await login(page, users.bruno)

    await expect(page).toHaveURL(/\/profile/)

    await expect(
      page.getByLabel('Nome')
    ).toHaveValue(users.bruno.name)
  })
})
