import { addToCart, expect, login, open, test } from './fixtures'

// Regressão visual com dados estáveis (fixtures determinísticas + cenário "fast").
test.describe('Regressão visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('início @mobile', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: [page.getByRole('button', { name: 'Abrir painel de mocks' })] })
  })

  test('detalhe @mobile', async ({ page }) => {
    await open(page, '/nft/nft-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: [page.getByRole('button', { name: 'Abrir painel de mocks' })] })
  })

  test('carrinho @mobile', async ({ page }) => {
    await open(page, '/')
    await addToCart(page, 'nft-001', 2)
    await expect(page.getByTestId('cart-summary')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: [page.getByRole('button', { name: 'Abrir painel de mocks' }), page.locator('[data-sonner-toaster]')] })
  })

  test('pagamento @mobile', async ({ page }) => {
    await open(page, '/')
    await login(page, 'ana')
    await addToCart(page, 'nft-001', 2)
    await page.goto('/pagamento')
    await expect(page.getByTestId('quote-lines')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: [page.getByRole('button', { name: 'Abrir painel de mocks' }), page.locator('[data-sonner-toaster]')] })
  })
})
