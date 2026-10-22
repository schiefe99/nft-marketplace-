import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@nft.test', password: 'Senha@123', name: 'Ana' },
  bruno: { email: 'bruno@nft.test', password: 'Senha@123', name: 'Bruno' },
}

type Scenario = string

/** Abre o app com um cenário de mocks determinístico (estado isolado por contexto). */
export async function open(page: Page, path = '/', scenarios: Scenario[] = ['fast']) {
  await page.addInitScript((s) => {
    // aplicado antes de qualquer script da página, somente na primeira carga do contexto
    if (!sessionStorage.getItem('__pw_init')) {
      localStorage.setItem('nft-mock-scenario', s)
      sessionStorage.setItem('__pw_init', '1')
    }
  }, scenarios.join(','))
  await go(page, path)
}

/** Navega e aguarda MSW + primeira renderização do app. */
export async function go(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(() => window.__mocksReady === true)
  await page.locator('main#conteudo').waitFor({ state: 'attached' })
}

export async function setScenario(page: Page, scenarios: Scenario[]) {
  await page.evaluate((s) => window.__mocks!.setScenario(s as never), scenarios)
}

export async function login(page: Page, user: keyof typeof USERS = 'ana', redirect?: string) {
  await go(page, `/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill(USERS[user].email)
  await dialog.getByLabel('Senha', { exact: true }).fill(USERS[user].password)
  await dialog.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** Adiciona um NFT ao carrinho pela página de detalhe. */
export async function addToCart(page: Page, nftId = 'nft-001', qty = 1) {
  await go(page, `/nft/${nftId}`)
  const main = page.locator('main')
  await expect(main.getByRole('heading', { level: 1 })).toBeVisible()
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768
  for (let i = 1; i < qty; i++) {
    if (isMobile) await page.locator('.fixed').getByRole('button', { name: 'Aumentar quantidade' }).click()
    else await main.getByRole('button', { name: 'Aumentar quantidade' }).first().click()
  }
  if (isMobile) await page.getByRole('button', { name: 'Comprar NFT' }).click()
  else await main.getByRole('button', { name: 'COMPRAR' }).click()
  await expect(page).toHaveURL(/\/carrinho/)
}

export const test = base
export { expect }
