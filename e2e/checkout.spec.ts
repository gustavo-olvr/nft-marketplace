import { expect, test, type Page } from '@playwright/test'
import { addToCart, cartLink, connectWallet, gotoApp, login, NFT, ordersCount } from './helpers'

async function startCheckout(page: Page, scenario?: string) {
  await login(page)
  if (scenario) await gotoApp(page, `/?scenario=${scenario}`)
  await addToCart(page, NFT.id, 1)
  await gotoApp(page, '/checkout')
  await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
}

const confirm = (page: Page) => page.getByRole('button', { name: 'Confirmar pedido' })

test.describe('checkout e pedido', () => {
  test('compra completa: do catálogo ao recibo confirmado', async ({ page }) => {
    await login(page)
    await gotoApp(page, '/?q=lunar jaguar')
    await page.getByRole('link', { name: NFT.name }).click()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText(/Adicionado ao carrinho/)).toBeVisible()

    await cartLink(page).click()
    await page.getByRole('link', { name: 'Finalizar compra' }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()

    await connectWallet(page)
    await confirm(page).click()

    await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(NFT.name)).toBeVisible()
    await expect(page.getByText(/^0x/).first()).toBeVisible()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
  })

  test('valida os campos e exige a carteira conectada', async ({ page }) => {
    await startCheckout(page)
    await page.getByLabel('Nome').fill('')
    await confirm(page).click()
    await expect(page.getByText('Informe seu nome')).toBeVisible()
    await expect(page.getByText('Conecte a carteira para continuar')).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
  })

  test('conexão da carteira recusada', async ({ page }) => {
    await startCheckout(page, 'wallet-refused')
    await page.getByRole('button', { name: /^Conectar/ }).click()
    await expect(page.getByText('A carteira recusou a conexão')).toBeVisible()
  })

  test('conectar e desconectar a carteira', async ({ page }) => {
    await startCheckout(page)
    await connectWallet(page)
    await page.getByRole('button', { name: /^Desconectar/ }).click()
    await expect(page.getByRole('button', { name: /^Conectar/ })).toBeVisible()
  })

  test('pagamento recusado preserva os itens do carrinho', async ({ page }) => {
    await startCheckout(page, 'payment-declined')
    await connectWallet(page)
    await confirm(page).click()

    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Seus itens continuam no carrinho.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toHaveCount(0)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')
  })

  test('clique repetido não cria pedidos duplicados', async ({ page }) => {
    await startCheckout(page)
    await connectWallet(page)
    await confirm(page).dblclick()

    await expect(
      page.getByRole('heading', { name: /Aguardando confirmação|Pedido confirmado/ }),
    ).toBeVisible()
    await expect.poll(() => ordersCount(page)).toBe(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido por idempotência', async ({ page }) => {
    test.setTimeout(90_000)
    await startCheckout(page, 'order-timeout')
    await connectWallet(page)
    await confirm(page).click()

    await expect(page.getByText(/Não recebemos a resposta do servidor/)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Confirmar novamente' }).click()

    await expect(page.getByRole('heading', { name: /Aguardando confirmação|Pedido confirmado/ })).toBeVisible(
      {
        timeout: 20_000,
      },
    )
    expect(await ordersCount(page)).toBe(1)
  })

  test('preço alterado durante a compra exige nova confirmação', async ({ page }) => {
    await startCheckout(page, 'price-changed')
    await connectWallet(page)
    await confirm(page).click()

    await expect(page.getByText(/Os valores mudaram/)).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
    await expect(page.getByRole('link', { name: 'Revisar no carrinho' })).toBeVisible()
    await expect(confirm(page)).toBeDisabled()

    await page.getByRole('link', { name: 'Revisar no carrinho' }).click()
    await page.getByRole('button', { name: 'Aceitar novo preço' }).click()
    await page.getByRole('link', { name: 'Finalizar compra' }).click()
    await expect(confirm(page)).toBeEnabled()
    await confirm(page).click()
    await expect(
      page.getByRole('heading', { name: /Aguardando confirmação|Pedido confirmado/ }),
    ).toBeVisible()
  })

  test('edição esgotada durante a compra impede o pedido', async ({ page }) => {
    await startCheckout(page, 'sold-out')
    await connectWallet(page)
    await confirm(page).click()

    await expect(page.getByText(/ficou indisponível|Há itens que precisam de atenção/).first()).toBeVisible()
    expect(await ordersCount(page)).toBe(0)
  })

  test('pedido de outro usuário ou inexistente não é exibido', async ({ page }) => {
    await login(page)
    await gotoApp(page, '/orders/ord_inexistente')
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
  })
})
