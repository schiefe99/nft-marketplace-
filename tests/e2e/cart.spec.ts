import { addToCart, expect, login, open, test } from './fixtures'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh e login @mobile', async ({ page }) => {
    await open(page, '/')
    // visitante
    await addToCart(page, 'nft-001')
    await addToCart(page, 'nft-002')
    await expect(page.getByTestId('cart-row')).toHaveCount(2)
    const row = page.getByTestId('cart-row').first()
    await row.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(row.getByTestId('quantity-value')).toHaveText('2')
    const subtotal = await page.getByTestId('summary-subtotal').textContent()

    // cupom inválido e expirado
    await page.getByLabel('Código promocional').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText('Cupom inválido.')
    await page.getByLabel('Código promocional').fill('EXPIRADO20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText('Este cupom expirou.')
    await page.getByLabel('Código promocional').fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('applied-coupon')).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).not.toHaveText('(-) 00.00')

    // remoção
    await page.getByTestId('cart-row').nth(1).getByRole('button', { name: /Remover/ }).click()
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    expect(await page.getByTestId('summary-subtotal').textContent()).not.toBe(subtotal)

    // refresh mantém
    await page.reload()
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    await expect(page.getByTestId('applied-coupon')).toBeVisible()

    // itens do visitante preservados ao autenticar
    await login(page, 'bruno', '/carrinho')
    await expect(page).toHaveURL(/\/carrinho/)
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    await expect(page.getByTestId('cart-row').getByTestId('quantity-value')).toHaveText('2')
  })

  test('alteração de preço via Socket.IO é informada no carrinho', async ({ page }) => {
    await open(page, '/')
    await addToCart(page, 'nft-007')
    const total = await page.getByTestId('summary-total').textContent()
    await page.evaluate(() => window.__mocks!.updateNft('nft-007', { editionId: 'nft-007-ed-3', priceFactor: '1.5' }))
    await expect(page.getByTestId('cart-issues')).toBeVisible()
    await expect(page.getByTestId('price-changed')).toBeVisible()
    await expect(page.getByTestId('summary-total')).not.toHaveText(total!)
    await expect(page.getByTestId('go-checkout')).toBeDisabled()
    await page.getByRole('button', { name: 'Entendi, usar novos preços' }).click()
    await expect(page.getByTestId('cart-issues')).toBeHidden()
    await expect(page.getByTestId('go-checkout')).toBeEnabled()
  })
})
