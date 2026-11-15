import { expect, test } from '@playwright/test'
import { ADA, gotoApp, login, NFT } from './helpers'

const PUBLIC_ROUTES = ['/', `/nfts/${NFT.id}`, '/cart', '/login', '/register']
const WIDTHS = [390, 768, 1440]

test.describe('acessibilidade e responsividade', () => {
  for (const width of WIDTHS) {
    test(`sem overflow horizontal em ${width}px (visitante)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const route of PUBLIC_ROUTES) {
        await gotoApp(page, route)
        await expect(page.getByRole('main')).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `overflow em ${route}`).toBeLessThanOrEqual(0)
      }
    })

    test(`sem overflow horizontal em ${width}px (usuário autenticado)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await login(page, ADA)
      for (const route of ['/', `/nfts/${NFT.id}`, '/cart', '/checkout', '/profile', '/wallets']) {
        await gotoApp(page, route)
        await expect(page.getByRole('main')).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `overflow em ${route}`).toBeLessThanOrEqual(0)
      }
    })
  }

  test('cada página tem um main, um h1 e título próprio', async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await gotoApp(page, route)
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      expect(await page.title()).toMatch(/NFT Marketplace/)
    }
  })

  test('imagens do catálogo têm texto alternativo', async ({ page }) => {
    await gotoApp(page)
    await expect(page.locator('article img').first()).toBeVisible()
    const missing = await page
      .locator('img')
      .evaluateAll((images) => images.filter((image) => !(image as HTMLImageElement).alt.trim()).length)
    expect(missing).toBe(0)
  })

  test('foco visível ao navegar por teclado', async ({ page }) => {
    await gotoApp(page, '/login')
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThan(0)
  })

  test('login completo apenas com teclado', async ({ page }) => {
    await gotoApp(page, '/login')
    await page.getByLabel('E-mail').focus()
    await page.keyboard.type(ADA.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type(ADA.password)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('erros de formulário ficam associados aos campos', async ({ page }) => {
    await gotoApp(page, '/register')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    for (const label of ['Nome', 'E-mail', 'Senha']) {
      const field = page.getByLabel(label)
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const id = await field.getAttribute('aria-describedby')
      expect(id).toBeTruthy()
      await expect(page.locator(`[id="${id}"]`)).toBeVisible()
    }
  })

  test('drawer de filtros controla o foco (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'o drawer só existe abaixo de 768px')
    await gotoApp(page)

    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    await expect(dialog).toBeVisible()
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('skeleton do catálogo tem as mesmas dimensões do conteúdo', async ({ page }) => {
    await gotoApp(page, '/?scenario=slow')
    const skeleton = page
      .getByRole('status')
      .filter({ hasText: 'Carregando catálogo' })
      .locator('.grid > div')
      .first()
    await expect(skeleton).toBeVisible()
    const before = await skeleton.boundingBox()

    const card = page.locator('article').first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    const after = await card.boundingBox()

    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(before!.width - after!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1)
  })

  test('skeleton respeita a preferência por movimento reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoApp(page, '/?scenario=slow')
    const block = page.locator('.skeleton').first()
    await expect(block).toBeVisible()
    expect(await block.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })

  test('skeleton tem shimmer quando o movimento não é reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await gotoApp(page, '/?scenario=slow')
    const block = page.locator('.skeleton').first()
    await expect(block).toBeVisible()
    expect(await block.evaluate((el) => getComputedStyle(el).animationName)).toBe('shimmer')
  })
})
