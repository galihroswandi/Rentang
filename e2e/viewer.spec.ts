import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { generateProject } from '../src/core/test-utils/generate-project.ts'
import { toGan } from '../src/core/test-utils/to-gan.ts'

const fixture = 'fixtures/kedai-kopi-demo.gan'

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    )
  expect(serious).toEqual([])
}

test('imports a .gan file through the report and keeps it after a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Mulai dari mana?' })).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.locator('input[accept=".gan"]').setInputFiles(fixture)
  const dialog = page.getByRole('dialog', { name: 'Laporan impor' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByText('1 dependensi start-to-start menjadi finish-to-start'),
  ).toBeVisible()
  await expectNoSeriousViolations(page)

  await dialog.getByRole('button', { name: 'Simpan dan buka proyek' }).click()
  const grid = page.getByRole('treegrid', { name: 'Daftar tugas' })
  await expect(grid.getByRole('row')).toHaveCount(1 + 14)
  await expect(page.getByRole('heading', { level: 1, name: 'Peluncuran Kedai Kopi' })).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.reload()
  await expect(grid.getByRole('row')).toHaveCount(1 + 14)
  await expect(
    page.getByRole('navigation', { name: 'Proyek' }).getByRole('button', { name: /Peluncuran/ }),
  ).toHaveAttribute('aria-current', 'page')
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
  await page.goto('/')
  await page.getByRole('button', { name: 'Coba dengan proyek demo' }).click()
  const grid = page.getByRole('treegrid', { name: 'Daftar tugas' })
  const rows = grid.getByRole('row')
  await expect(rows).toHaveCount(1 + 13)

  // Tab from the time-scale buttons lands on the first task.
  await page.getByRole('button', { name: 'Bulan' }).focus()
  await page.keyboard.press('Tab')
  await expect(rows.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(rows.nth(2)).toBeFocused()
  await page.keyboard.press('End')
  await expect(rows.nth(13)).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowLeft')
  await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'false')
  await expect(rows).toHaveCount(1 + 10)
  await page.keyboard.press('ArrowRight')
  await expect(rows).toHaveCount(1 + 13)
  await page.keyboard.press('Enter')
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true')
})

test('the demo passes accessibility checks in both themes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Coba dengan proyek demo' }).click()
  await expect(page.getByText('Demo · data fiktif')).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.getByRole('button', { name: 'Gelap' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoSeriousViolations(page)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
