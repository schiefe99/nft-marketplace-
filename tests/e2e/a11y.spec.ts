import { expect, open, test } from './fixtures'

test.describe('Acessibilidade', () => {
  test('navegação por teclado, link de pular e foco visível', async ({ page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)
    // foco visível (outline do :focus-visible)
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
    expect(outline).not.toBe('none')
  })

  test('diálogo prende e devolve o foco', async ({ page }) => {
    await open(page, '/')
    const trigger = page.getByRole('button', { name: 'Buscar', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('formulário associa mensagens de erro aos campos', async ({ page }) => {
    await open(page, '/login')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Entrar' }).click()
    const email = dialog.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy!.split(' ').pop()}`)).toHaveText('Informe um e-mail válido.')
    await expect(email).toBeFocused()
  })

  test('sem overflow horizontal em 390, 768 e 1440 px @mobile', async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await open(page, '/')
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `largura ${width}`).toBeLessThanOrEqual(0)
    }
  })
})
