import { addToCart, expect, login, open, setScenario, test } from './fixtures'

/** Abre o pagamento; a rede já vem da carteira principal (Ethereum para a Ana). */
async function goToCheckout(page: import('@playwright/test').Page) {
  await page.goto('/pagamento')
  await expect(page.getByTestId('quote-lines')).toBeVisible()
}

test.describe('Compra', () => {
  test('compra completa do catálogo ao recibo confirmado @mobile', async ({ page }) => {
    await open(page, '/')
    await login(page, 'ana')
    await addToCart(page, 'nft-001', 2)
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
    await page.getByTestId('go-checkout').click()
    await expect(page).toHaveURL(/\/pagamento/)
    // compra em um passo: rede pré-selecionada pela carteira principal
    await expect(page.getByTestId('quote-lines')).toBeVisible()
    const total = await page.getByTestId('summary-total').textContent()
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByTestId('order-pending').or(page.getByTestId('order-confirmed'))).toBeVisible()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText(total!)
    await expect(page.getByTestId('receipt-lines').getByRole('listitem')).toHaveCount(1)
    // itens comprados saem do carrinho
    await page.goto('/carrinho')
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('pagamento recusado preserva itens do carrinho', async ({ page }) => {
    await open(page, '/', ['fast', 'payment-declined'])
    await login(page, 'ana')
    await addToCart(page, 'nft-002')
    await goToCheckout(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
  })

  test('clique repetido cria um único pedido', async ({ page }) => {
    await open(page, '/', ['fast', 'pending-hold'])
    await login(page, 'ana')
    await addToCart(page, 'nft-004')
    await goToCheckout(page)
    const btn = page.getByTestId('confirm-order')
    await btn.dblclick({ force: true })
    await btn.click({ force: true, timeout: 1000 }).catch(() => {})
    await expect(page).toHaveURL(/\/pedido\//)
    const orders = await page.evaluate(() => window.__mocks!.state().orders.length)
    expect(orders).toBe(1)
  })

  test('timeout após criação do pedido recupera o mesmo pedido por idempotência', async ({ page }) => {
    await open(page, '/', ['fast', 'order-timeout'])
    await login(page, 'ana')
    await addToCart(page, 'nft-005')
    await goToCheckout(page)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 15_000 })
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    const state = await page.evaluate(() => {
      const s = window.__mocks!.state()
      return { orders: s.orders.length, keys: Object.keys(s.idempotency).length }
    })
    expect(state).toEqual({ orders: 1, keys: 1 })
  })

  test('alteração de preço via Socket.IO durante o checkout exige aceitar o novo valor', async ({ page }) => {
    await open(page, '/')
    await login(page, 'ana')
    await addToCart(page, 'nft-006')
    await goToCheckout(page)
    const before = await page.getByTestId('summary-total').textContent()
    // evento emitido pelo servidor Socket.IO simulado (MSW) → socket.io-client
    await page.evaluate(() => window.__mocks!.updateNft('nft-006', { editionId: 'nft-006-ed-3', priceFactor: '1.2' }))
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await expect(page.getByTestId('confirm-order')).toBeDisabled()
    await expect(page.getByTestId('summary-total')).not.toHaveText(before!)
    await page.getByRole('button', { name: 'Aceitar novo valor' }).click()
    await expect(page.getByTestId('confirm-order')).toBeEnabled()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
  })

  test('carteira recusa conexão', async ({ page }) => {
    await open(page, '/', ['fast', 'wallet-rejected'])
    await login(page, 'ana')
    await addToCart(page, 'nft-002')
    await goToCheckout(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByRole('alert').filter({ hasText: 'recusou a conexão' })).toBeVisible()
    await setScenario(page, ['fast'])
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedido\//)
  })
})
