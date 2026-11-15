import { expect, test } from '@playwright/test'
import { ADA, gotoApp, login, PNG_1X1 } from './helpers'

test.describe('perfil', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoApp(page, '/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('edita os dados e persiste após refresh', async ({ page }) => {
    await page.getByLabel('Nome').first().fill('Ada L.')
    await page.getByLabel('Bio').fill('Colecionadora de arte digital')
    await page.getByRole('button', { name: 'Salvar dados' }).click()
    await expect(page.getByText('Dados salvos.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ada L.' })).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Bio')).toHaveValue('Colecionadora de arte digital')
  })

  test('valida os dados e trata e-mail em uso', async ({ page }) => {
    await page.getByLabel('Nome').first().fill('')
    await page.getByRole('button', { name: 'Salvar dados' }).click()
    await expect(page.getByText('Informe seu nome')).toBeVisible()

    await page.getByLabel('Nome').first().fill(ADA.name)
    await page.getByLabel('E-mail').fill('bruno@jungle.test')
    await page.getByRole('button', { name: 'Salvar dados' }).click()
    await expect(page.getByText('Este e-mail já está em uso')).toBeVisible()
  })

  test('envia um avatar válido e recusa arquivo inválido', async ({ page }) => {
    const input = page.getByLabel('Enviar nova imagem')

    await input.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByText('Use uma imagem PNG, JPEG ou WebP')).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1X1 })
    await expect(page.getByText('Avatar atualizado.')).toBeVisible()
    await expect(page.getByRole('img', { name: `Avatar de ${ADA.name}` })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('img', { name: `Avatar de ${ADA.name}` })).toBeVisible()
  })

  test('altera a senha com validação e erro da API', async ({ page }) => {
    await page.getByLabel('Senha atual').fill('errada123')
    await page.getByLabel('Nova senha', { exact: true }).fill('Nova@1234')
    await page.getByLabel('Confirmar nova senha').fill('Nova@1234')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta')).toBeVisible()

    await page.getByLabel('Senha atual').fill(ADA.password)
    await page.getByLabel('Confirmar nova senha').fill('diferente1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()

    await page.getByLabel('Confirmar nova senha').fill('Nova@1234')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await gotoApp(page, '/login')
    await page.getByLabel('E-mail').fill(ADA.email)
    await page.getByLabel('Senha').fill('Nova@1234')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })
})

test.describe('carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoApp(page, '/wallets')
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  })

  test('cadastra carteira secundária com validação', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    await page.getByLabel('Nome').fill('Reserva')
    await page.getByLabel('Endereço').fill('0x123')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText(/Endereço inválido/)).toBeVisible()

    await page.getByLabel('Endereço').fill(`0x${'b'.repeat(40)}`)
    await page.getByLabel('Tipo').selectOption('primary')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Já existe uma carteira principal')).toBeVisible()

    await page.getByLabel('Tipo').selectOption('secondary')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText(/Reserva · Secundária/)).toBeVisible()

    await page.reload()
    await expect(page.getByText(/Reserva · Secundária/)).toBeVisible()
  })

  test('edita a carteira principal e recusa endereço duplicado', async ({ page }) => {
    await page.getByRole('button', { name: 'Editar Carteira principal' }).click()
    await page.getByLabel('Nome').fill('Principal renomeada')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText(/Principal renomeada · Principal/)).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    await page.getByLabel('Nome').fill('Duplicada')
    await page.getByLabel('Endereço').fill('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Endereço já cadastrado')).toBeVisible()
  })
})
