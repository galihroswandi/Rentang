import { expect, test } from '@playwright/test'

test('the dev server renders the app and can import a .gan file without errors', async ({
  page,
}) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Mulai dari mana?' })).toBeVisible()

  await page.locator('input[accept=".gan"]').setInputFiles('fixtures/kedai-kopi-demo.gan')
  await page.getByRole('button', { name: 'Simpan dan buka proyek' }).click()
  await expect(page.getByRole('treegrid', { name: 'Daftar tugas' }).getByRole('row')).toHaveCount(
    1 + 14,
  )

  expect(problems).toEqual([])
})
