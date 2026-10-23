import { expect, open, setScenario, test } from './fixtures'

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico @mobile', async ({ page }) => {
    await open(page, '/mercado')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)

    // busca
    await page.getByLabel('Buscar no catálogo').fill('nomad')
    await expect(page).toHaveURL(/q=nomad/)
    await expect(grid.getByTestId('nft-card').first()).toContainText(/Nomad/)
    const nomadCount = await grid.getByTestId('nft-card').count()
    expect(nomadCount).toBeGreaterThan(0)

    // filtros combinados (rede) + ordenação por menor preço
    await page.getByLabel('Buscar no catálogo').fill('')
    await expect(page).not.toHaveURL(/q=/)
    if ((page.viewportSize()?.width ?? 1440) < 1024) await page.getByRole('button', { name: 'Abrir filtros' }).click()
    const filters = (page.viewportSize()?.width ?? 1440) < 1024 ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Filtros' })
    await filters.getByRole('button', { name: /^Arte digital/ }).click()
    await filters.getByRole('button', { name: /^Ethereum/ }).click()
    // no celular a ordenação fica dentro do painel de filtros
    const phone = (page.viewportSize()?.width ?? 1440) < 768
    if (phone) await filters.getByLabel('Ordenar por:').selectOption('price-asc')
    if ((page.viewportSize()?.width ?? 1440) < 1024) await page.getByRole('button', { name: /Ver resultados/ }).click()
    await expect(page).toHaveURL(/category=.*digital-art/)
    await expect(page).toHaveURL(/network=ethereum/)
    if (!phone) await page.getByLabel('Ordenar por:').selectOption('price-asc')
    await expect(page).toHaveURL(/sort=price-asc/)

    await expect(page.getByTestId('results-status')).not.toContainText('atualizando')
    await expect
      .poll(async () => {
        const prices = await grid.getByTestId('nft-price').allTextContents()
        const nums = prices.map((p) => Number(p.replace(/[^\d.]/g, '')))
        return nums.length > 0 && nums.every((n, i) => i === 0 || nums[i - 1] <= n)
      })
      .toBe(true)

    // limpar e paginar
    await page.getByRole('button', { name: 'Limpar filtros' }).first().click()
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('results-status')).not.toContainText('atualizando')
    await expect(grid).not.toHaveClass(/opacity-70/)
    const firstOnPage2 = await grid.getByTestId('nft-card').first().textContent()

    // mudança de filtro reinicia a paginação
    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page).toHaveURL(/tab=trending/)

    // histórico restaura estado anterior (página 2)
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(grid.getByTestId('nft-card').first()).toHaveText(firstOnPage2!)

    // refresh preserva URL e resultados
    await page.reload()
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  test('resultado vazio', async ({ page }) => {
    await open(page, '/mercado?q=inexistente-xyz')
    await expect(page.getByTestId('empty-state')).toContainText('Nenhum NFT encontrado')
  })

  test('skeleton em carregamento lento, falha e recuperação após nova tentativa', async ({ page }) => {
    await open(page, '/mercado', ['slow'])
    await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 })

    await setScenario(page, ['fast', 'server-error'])
    await page.goto('/mercado?q=ape')
    await expect(page.getByTestId('error-state')).toBeVisible({ timeout: 15_000 })
    await setScenario(page, ['fast'])
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem a busca atual', async ({ page }) => {
    // cenário: 1ª listagem rápida, 2ª ("golden") lenta, 3ª ("ivory") rápida
    await open(page, '/mercado', ['out-of-order'])
    const grid = page.getByTestId('catalog-grid')
    await expect(grid).toBeVisible({ timeout: 10_000 })
    const input = page.getByLabel('Buscar no catálogo')
    await input.fill('golden')
    await page.waitForRequest((r) => r.url().includes('q=golden'))
    await input.fill('ivory')
    await expect(page).toHaveURL(/q=ivory/)
    await expect(grid.getByRole('heading', { name: /Ivory Baron/ })).toBeVisible()
    // a resposta antiga (1500 ms) chegaria por último — ou é cancelada pelo AbortSignal
    await page.waitForTimeout(1700)
    // …e não sobrescreve os resultados da busca atual
    await expect(grid.getByRole('heading', { name: /Golden/ })).toHaveCount(0)
    await expect(grid.getByRole('heading', { name: /Ivory Baron/ })).toBeVisible()
  })
})
