import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, login, open, test } from './fixtures'

const here = path.dirname(fileURLToPath(import.meta.url))

test.describe('Perfil e carteiras', () => {
  test('edição de perfil, avatar e senha com erros de validação @mobile', async ({ page }) => {
    await open(page, '/')
    await login(page, 'ana')
    await page.goto('/conta/perfil')
    await page.getByLabel('Nome de exibição *').fill('A')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByLabel('Nome de exibição *')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Nome de exibição *')).toBeFocused()
    // conflito vindo da API
    await page.getByLabel('Nome de exibição *').fill('Ana Atualizada')
    await page.getByLabel('E-mail *').fill('bruno@nft.test')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible()
    await page.getByLabel('E-mail *').fill('ana@nft.test')
    await page.locator('#avatar-file').setInputFiles(path.join(here, 'assets', 'avatar.png'))
    await expect(page.getByTestId('avatar-preview')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição *')).toHaveValue('Ana Atualizada')
    await expect(page.getByTestId('avatar-preview')).toBeVisible()

    // senha
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha1')
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()
    await page.getByLabel('Senha atual').fill('Senha@123')
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()
  })

  test('cadastro e edição de carteiras com validação', async ({ page }) => {
    await open(page, '/')
    await login(page, 'ana')
    await page.goto('/conta/carteiras')
    const secondary = page.getByTestId('wallet-secondary-section')
    await secondary.getByRole('button', { name: 'Adicionar' }).click()
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByLabel('Apelido da carteira *')).toHaveAttribute('aria-invalid', 'true')
    await secondary.getByLabel('Apelido da carteira *').fill('Reserva')
    await secondary.getByLabel('Tipo de carteira *').selectOption('walletconnect')
    await secondary.getByLabel('Rede *').selectOption('polygon')
    await secondary.getByLabel('Endereço da carteira *').fill('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está cadastrado.')).toBeVisible()
    await secondary.getByLabel('Endereço da carteira *').fill('0xbDA5747bFD65F08deb54cb465eB87D40e51B197E')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('wallet-secondary-section').getByLabel('Apelido da carteira *')).toHaveValue('Reserva')
    // editar principal
    const primary = page.getByTestId('wallet-primary-section')
    await primary.getByLabel('Apelido da carteira *').fill('Minha MetaMask')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('wallet-primary-section').getByLabel('Apelido da carteira *')).toHaveValue('Minha MetaMask')
  })
})
