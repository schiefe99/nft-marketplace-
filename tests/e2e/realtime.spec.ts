import { addToCart, expect, go, login, open, test } from './fixtures'

test.describe('Tempo real', () => {
  test('eventos duplicados ou antigos não regridem o estado', async ({ page }) => {
    await open(page, '/nft/nft-002')
    const price = page.getByTestId('detail-price')
    await expect(price).toHaveText('1.69 ETH')
    await page.evaluate(() => window.__mocks!.updateNft('nft-002', { editionId: 'nft-002-ed-3', priceEth: '2' }))
    await expect(price).toHaveText('2 ETH')
    const first = await page.evaluate(() => window.__mocks!.eventHistory().at(-1)!.eventId)
    await page.evaluate(() => window.__mocks!.updateNft('nft-002', { editionId: 'nft-002-ed-3', priceEth: '3' }))
    await expect(price).toHaveText('3 ETH')
    // reenvia o evento antigo (versão menor) e duplica o mais novo
    await page.evaluate((id) => window.__mocks!.replayEvent(id), first)
    const last = await page.evaluate(() => window.__mocks!.eventHistory().at(-1)!.eventId)
    await page.evaluate((id) => window.__mocks!.replayEvent(id), last)
    await page.waitForTimeout(300)
    await expect(price).toHaveText('3 ETH')
  })

  test('desconexão com pedido pendente: retoma após reconectar e recarregar sem duplicar', async ({ page }) => {
    await open(page, '/', ['fast', 'pending-hold'])
    await login(page, 'ana')
    await addToCart(page, 'nft-008')
    await page.goto('/pagamento')
    await expect(page.getByTestId('quote-lines')).toBeVisible()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()

    // queda da conexão em tempo real
    await page.evaluate(() => window.__mocks!.dropSockets())
    await expect(page.getByTestId('realtime-reconnecting')).toBeVisible()
    await expect(page.getByTestId('realtime-reconnecting')).toBeHidden({ timeout: 10_000 })

    // recarrega: estado pendente recuperado e checkout bloqueia nova compra
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await page.goto('/pagamento')
    await expect(page.getByTestId('pending-order-banner')).toBeVisible()
    await expect(page.getByTestId('confirm-order')).toBeDisabled()

    // liquidação chega via order.updated
    await go(page, orderUrl)
    const orderId = orderUrl.split('/').pop()!
    await page.evaluate((id) => window.__mocks!.settleOrder(id, 'confirmed'), orderId)
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    expect(await page.evaluate(() => window.__mocks!.state().orders.length)).toBe(1)
  })
})
