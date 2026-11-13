import { expect, test } from '@playwright/test'

test('the dev server renders the app, imports a .gan file and opens a document without errors', async ({
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

  // The document editor is loaded on demand, unbundled here.
  await page.getByRole('button', { name: 'Dokumen', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: 'Dokumen baru' }).click()
  await page.getByRole('textbox', { name: 'Isi dokumen' }).click()
  await page.keyboard.type('Catatan pertama')
  await expect(page.getByRole('textbox', { name: 'Isi dokumen' })).toContainText('Catatan pertama')

  expect(problems).toEqual([])
})
