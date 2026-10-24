import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { generateProject } from '../src/core/test-utils/generate-project.ts'
import { toGan } from '../src/core/test-utils/to-gan.ts'

const fixture = 'fixtures/kedai-kopi-demo.gan'

async function expectNoSeriousViolations(page: Page): Promise<void> {
  // Let entrance animations settle so colours are checked at their final values.
  await page.waitForTimeout(900)
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    )
  expect(serious).toEqual([])
}

async function openDemo(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Coba dengan proyek demo' }).click()
  await expect(page.getByRole('treegrid', { name: 'Daftar tugas' })).toBeVisible()
}

test('imports a .gan file through the report, lists it and keeps it after a reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Mulai dari mana?' })).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.locator('input[accept=".gan"]').setInputFiles(fixture)
  const dialog = page.getByRole('dialog', { name: 'Laporan impor' })
  await expect(
    dialog.getByText('1 dependensi start-to-start menjadi finish-to-start'),
  ).toBeVisible()
  await expectNoSeriousViolations(page)

  await dialog.getByRole('button', { name: 'Simpan dan buka proyek' }).click()
  const grid = page.getByRole('treegrid', { name: 'Daftar tugas' })
  await expect(grid.getByRole('row')).toHaveCount(1 + 14)
  await expectNoSeriousViolations(page)

  await page.getByRole('button', { name: 'Daftar proyek', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Proyek terakhir' })).toBeVisible()
  await expect(page.getByText('kedai-kopi-demo.gan')).toBeVisible()
  await expectNoSeriousViolations(page)
  await page.getByRole('button', { name: 'Kartu' }).click()
  await expectNoSeriousViolations(page)

  await page.reload()
  await page.getByRole('button', { name: /Peluncuran Kedai Kopi/ }).click()
  await expect(grid.getByRole('row')).toHaveCount(1 + 14)
})

test('cancelling the import report keeps the start screen', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[accept=".gan"]').setInputFiles(fixture)
  await page.getByRole('button', { name: 'Batal' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Mulai dari mana?' })).toBeVisible()
})

test('reports a file that is not a project', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[accept=".gan"]').setInputFiles({
    name: 'catatan.gan',
    mimeType: 'application/xml',
    buffer: Buffer.from('<catatan/>'),
  })
  await expect(page.getByRole('alert')).toContainText(
    'catatan.gan: Berkas ini bukan proyek GanttProject.',
  )
})

test('opens 200 tasks in under a second', async ({ page }) => {
  const gan = toGan(generateProject(200))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Mulai dari mana?' })).toBeVisible()

  // Timed inside the page, so Playwright's polling does not count. Reading the report is the
  // user's time, so the clock pauses between the dialog appearing and "Simpan" being pressed.
  await page.evaluate(() => {
    const timing = { picked: 0, report: 0, saved: 0, shown: 0 }
    Object.assign(window, { timing })
    document.addEventListener('change', () => (timing.picked = performance.now()), true)
    new MutationObserver((_, observer) => {
      if (timing.report === 0 && document.querySelector('[role="dialog"]')) {
        timing.report = performance.now()
      }
      if (
        timing.saved > 0 &&
        document.querySelectorAll('[role="treegrid"] tbody tr').length === 200
      ) {
        observer.disconnect()
        requestAnimationFrame(() => (timing.shown = performance.now()))
      }
    }).observe(document.body, { childList: true, subtree: true })
  })

  await page.locator('input[accept=".gan"]').setInputFiles({
    name: 'proyek-besar.gan',
    mimeType: 'application/xml',
    buffer: Buffer.from(gan),
  })
  const save = page.getByRole('button', { name: 'Simpan dan buka proyek' })
  await expect(save).toBeVisible()
  await save.evaluate((button: HTMLButtonElement) => {
    ;(window as unknown as { timing: { saved: number } }).timing.saved = performance.now()
    button.click()
  })
  await expect(page.getByRole('treegrid').getByRole('row')).toHaveCount(1 + 200)
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { timing: { shown: number } }).timing.shown),
    )
    .toBeGreaterThan(0)

  const { picked, report, saved, shown } = await page.evaluate(
    () =>
      (window as unknown as { timing: Record<'picked' | 'report' | 'saved' | 'shown', number> })
        .timing,
  )
  const elapsed = report - picked + (shown - saved)
  test.info().annotations.push({
    type: '200 tugas',
    description: `${elapsed.toFixed(0)} ms (laporan ${(report - picked).toFixed(0)} ms, tampil ${(shown - saved).toFixed(0)} ms)`,
  })
  expect(elapsed).toBeLessThan(1000)
})

test('the task table works from the keyboard', async ({ page }) => {
  await openDemo(page)
  const rows = page.getByRole('treegrid').getByRole('row')
  await expect(rows).toHaveCount(1 + 13)

  await rows.nth(1).focus()
  await page.keyboard.press('ArrowDown')
  await expect(rows.nth(2)).toBeFocused()
  await expect(rows.nth(2)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(rows.nth(13)).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowLeft')
  await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'false')
  await expect(rows).toHaveCount(1 + 10)
  await page.keyboard.press('ArrowRight')
  await expect(rows).toHaveCount(1 + 13)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Ubah tugas' })).toBeVisible()
})

test('tasks can be added, edited, deleted and every edit undone', async ({ page }) => {
  await openDemo(page)
  const grid = page.getByRole('treegrid')
  await grid.getByRole('row', { name: /Desain interior/ }).click()

  await page.getByRole('button', { name: 'Tugas', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tugas baru' })
  await dialog.getByLabel('Nama tugas').fill('Pasang papan nama')
  await dialog.getByText('Desain', { exact: true }).click()
  await dialog.getByLabel('Durasi (hari kerja)').fill('3')
  await expectNoSeriousViolations(page)
  await dialog.getByRole('button', { name: 'Tambah tugas' }).click()
  const added = grid.getByRole('row', { name: /Pasang papan nama/ })
  await expect(added).toBeVisible()

  await page.getByRole('button', { name: 'Urungkan' }).click()
  await expect(added).toBeHidden()
  await page.keyboard.press('Control+Shift+Z')
  await expect(added).toBeVisible()

  await added.dblclick()
  const edit = page.getByRole('dialog', { name: 'Ubah tugas' })
  await edit.getByText('50%', { exact: true }).click()
  await edit.getByRole('button', { name: 'Simpan' }).click()
  await expect(added.getByRole('gridcell').last()).toHaveText('50%')
  await page.keyboard.press('Control+z')
  await expect(added.getByRole('gridcell').last()).toHaveText('0%')

  await added.dblclick()
  await page.getByRole('button', { name: 'Hapus tugas' }).click()
  await page.getByRole('button', { name: 'Ya, hapus' }).click()
  await expect(added).toBeHidden()
  await expect(grid.getByRole('row')).toHaveCount(1 + 13)
})

test('people can be added, given a role, assigned and removed', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Resource', exact: true }).click()
  await expectNoSeriousViolations(page)

  await page.getByRole('button', { name: 'Orang', exact: true }).click()
  const name = page.getByLabel('Nama', { exact: true })
  await expect(name).toBeFocused()
  await name.fill('Wulan Sari')
  await name.press('Enter')
  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'Barista' })
  await page.getByRole('button', { name: 'Tugaskan ke tugas' }).click()
  await page.getByLabel('Tugas', { exact: true }).selectOption({ label: '[DOC] Pelatihan barista' })
  await page.getByRole('button', { name: 'Tugaskan', exact: true }).click()

  const person = page.getByRole('button', { name: /Wulan Sari/ })
  await expect(person).toContainText('Barista')
  await expect(person).toContainText('1 tugas')

  await page.getByRole('button', { name: 'Kelola role' }).first().click()
  await page.getByLabel('Nama role baru').fill('Kasir')
  await page.getByRole('button', { name: 'Tambah', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Nama role').last()).toHaveValue('Kasir')
  await expectNoSeriousViolations(page)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Hapus dari proyek' }).click()
  await expect(person).toBeHidden()
})

test('the project view passes accessibility checks in dark mode and on a phone', async ({
  page,
}) => {
  await openDemo(page)
  await page.getByRole('switch', { name: /Jalur kritis/ }).click()
  await page.getByRole('button', { name: 'Ganti ke mode gelap' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoSeriousViolations(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoSeriousViolations(page)
  await page.getByRole('button', { name: 'Resource', exact: true }).click()
  await expectNoSeriousViolations(page)
  await page.getByRole('button', { name: 'Daftar proyek', exact: true }).click()
  await expectNoSeriousViolations(page)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
