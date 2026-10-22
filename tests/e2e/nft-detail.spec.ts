import { expect, login, open, test } from './fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto, edição indisponível e limite de quantidade @mobile', async ({ page }) => {
    await open(page, '/nft/nft-003')
    await expect(page.getByRole('heading', { level: 1, name: 'Neon Vessel #552' })).toBeVisible()
    // edição 1/1 indisponível neste NFT: exposta como desabilitada e com motivo
    const unavailable = page.getByRole('radio', { name: /^1\/1( |$)/ })
    await expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    await expect(unavailable).toHaveAccessibleName(/indisponível/)
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768
    const buy = isMobile ? page.getByRole('button', { name: 'Comprar NFT' }) : page.getByRole('button', { name: 'COMPRAR' })
    // edição 1/10: limite por pedido = 10
    await page.getByRole('radio', { name: /^1\/10( |$)/ }).click()
    await expect(buy).toBeEnabled()
    const scope = isMobile ? page.locator('.fixed') : page.locator('main')
    const plus = scope.getByRole('button', { name: 'Aumentar quantidade' }).first()
    for (let i = 0; i < 12; i++) if (await plus.isEnabled()) await plus.click()
    await expect(plus).toBeDisabled()
    await expect(scope.getByTestId('quantity-value').first()).toHaveText('10')
  })

  test('NFT esgotado não permite compra', async ({ page }) => {
    await open(page, '/nft/nft-013')
    await expect(page.getByTestId('edition-hint')).toContainText('esgotada')
    await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeDisabled()
  })

  test('NFT inexistente', async ({ page }) => {
    await open(page, '/nft/nao-existe')
    await expect(page.getByTestId('nft-not-found')).toBeVisible()
  })

  test('rota inexistente mostra 404', async ({ page }) => {
    await open(page, '/qualquer/coisa')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('favoritos: falha da mutation faz rollback e o estado persiste após sucesso', async ({ page }) => {
    await open(page, '/')
    await login(page, 'ana')
    await page.goto('/nft/nft-003')
    const fav = page.getByTestId('detail-favorite')
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    // falha injetada no handler MSW
    await page.evaluate(() => window.__mocks!.failNext('PUT', '/api/me/favorites/', 500))
    await fav.click()
    await expect(page.getByText('Não foi possível favoritar')).toBeVisible()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    // nova tentativa com sucesso
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByTestId('detail-favorite')).toHaveAttribute('aria-pressed', 'true')
  })
})
