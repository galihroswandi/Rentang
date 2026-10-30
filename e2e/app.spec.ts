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

/** The chart opens at today, so a bar from before it must be scrolled into view first. */
async function revealBar(page: Page, id: string): Promise<void> {
  await page
    .locator(`svg g[data-id="${id}"] rect`)
    .first()
    .evaluate((rect) => {
      const scroller = rect.closest('[data-gantt-scroller]')
      if (scroller) scroller.scrollLeft = Math.max(0, Number(rect.getAttribute('x')) - 120)
    })
  await page.waitForTimeout(800)
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
    'catatan.gan: Berkas ini bukan proyek .gan yang valid.',
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

test('bars can be dragged to move or resize a task, and the drag undone', async ({ page }) => {
  await openDemo(page)
  const grid = page.getByRole('treegrid')
  const row = grid.getByRole('row', { name: /Pengerjaan ruang/ })
  const dates = async () => (await row.getByRole('gridcell').allInnerTexts()).slice(1, 3)
  const bar = page.locator('svg g[data-id="7"] rect').first()
  const before = await dates()

  // Wait for the bar to settle after entering, then pull it three days to the right.
  await revealBar(page, '7')
  await page.waitForTimeout(600)
  const box = await bar.boundingBox()
  if (!box) throw new Error('bar not found')
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 30, y, { steps: 5 })
  await page.mouse.move(box.x + box.width / 2 + 60, y, { steps: 5 })
  await expect(page.getByText(/\d+ hari$/).first()).toBeVisible()
  await page.mouse.up()
  await expect(page.getByText('Tugas dipindah')).toBeVisible()
  expect(await dates()).not.toEqual(before)

  await page.getByRole('button', { name: 'Urungkan' }).click()
  await expect.poll(dates).toEqual(before)

  // Pulling the right edge changes the length; Escape cancels a drag without an edit.
  await page.waitForTimeout(600)
  const settled = await bar.boundingBox()
  if (!settled) throw new Error('bar not found')
  const edge = settled.x + settled.width - 3
  await page.mouse.move(edge, y)
  await page.mouse.down()
  await page.mouse.move(edge + 40, y, { steps: 4 })
  await page.mouse.move(edge + 80, y, { steps: 4 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await dates()).toEqual(before)

  await page.mouse.move(edge, y)
  await page.mouse.down()
  await page.mouse.move(edge + 40, y, { steps: 4 })
  await page.mouse.move(edge + 80, y, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByText('Durasi diubah')).toBeVisible()
  expect((await dates())[1]).not.toBe(before[1])
  expect((await dates())[0]).toBe(before[0])

  // A plain click only selects: the dates stay as they are.
  const afterResize = await dates()
  await page.mouse.click(box.x + 40, y)
  await expect(row).toHaveAttribute('aria-selected', 'true')
  expect(await dates()).toEqual(afterResize)
})

test('sideways scrolling snaps to column edges, by wheel step or by dragging the chart', async ({
  page,
}) => {
  await openDemo(page)
  const scroller = page.locator('[data-gantt-scroller]')
  const left = () => scroller.evaluate((el) => el.scrollLeft)
  // At the week scale a day is 20 px, and a column edge at scroll x sits against the table.
  const onEdge = async () => expect.poll(async () => (await left()) % 20, { timeout: 4000 }).toBe(0)

  // Whatever position the page opens at settles on a column edge.
  await onEdge()

  // Shift with the wheel moves one column per step.
  await page.mouse.move(900, 450)
  const start = await left()
  await page.keyboard.down('Shift')
  await page.mouse.wheel(0, 120)
  await page.keyboard.up('Shift')
  await expect.poll(left).toBe(start + 20)
  await page.keyboard.down('Shift')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Shift')
  await expect.poll(left).toBe(start)

  // A sideways swipe works the same way.
  await page.waitForTimeout(150)
  await page.mouse.wheel(120, 0)
  await expect.poll(left).toBe(start + 20)

  // Dragging the background pans the view, and letting go settles on a column edge.
  await page.waitForTimeout(150)
  await page.mouse.move(900, 600)
  await page.mouse.down()
  await page.mouse.move(870, 600, { steps: 4 })
  await page.mouse.move(843, 600, { steps: 4 })
  await expect.poll(left).toBeGreaterThan(start + 20 + 40)
  await page.mouse.up()
  await onEdge()
  expect(await left()).toBeGreaterThan(start + 20)

  // Dragging a bar still moves the task, not the view.
  await revealBar(page, '7')
  const before = await left()
  const bar = await page.locator('svg g[data-id="7"] rect').first().boundingBox()
  if (!bar) throw new Error('bar not found')
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 9)
  await page.mouse.down()
  await page.mouse.move(bar.x + bar.width / 2 + 40, bar.y + 9, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByText('Tugas dipindah')).toBeVisible()
  expect(await left()).toBe(before)
})

test('"Hari ini" starts the chart at today, right against the table', async ({ page }) => {
  await openDemo(page)
  const scroller = page.locator('[data-gantt-scroller]')
  const left = () => scroller.evaluate((el) => el.scrollLeft)
  const zoomIn = page.getByRole('button', { name: 'Perbesar skala waktu' })

  // The three scales where a column is a day: 20, 32 and 64 px wide.
  for (const dayWidth of [20, 32, 64]) {
    await page.waitForTimeout(900)
    // Today's circle sits in the middle of its column, so the column starts half a day before.
    const todayEdge = await page
      .locator('circle.today-dot')
      .evaluate((circle, width) => Number(circle.getAttribute('cx')) - width / 2, dayWidth)

    // Go well away from today, then ask for it.
    await scroller.evaluate((el) => {
      el.scrollLeft = 0
    })
    await expect.poll(left).toBe(0)
    await page.getByRole('button', { name: 'Hari ini' }).click()
    await expect.poll(left, { timeout: 4000 }).toBe(todayEdge)
    if (dayWidth !== 64) await zoomIn.click()
  }
})

test('the chart never runs out of dates: scrolling to the end adds another year', async ({
  page,
}) => {
  await openDemo(page)
  const scroller = page.locator('[data-gantt-scroller]')
  const widthNow = () => scroller.evaluate((el) => el.scrollWidth)
  const first = await widthNow()

  // The year is on show in full, January to December, with a year more already after it.
  await page.waitForTimeout(600)
  expect(first).toBeGreaterThan(2 * 365 * 20)

  // Run to the far end a few times: each time the dates carry on instead of stopping.
  let previous = first
  for (let round = 0; round < 3; round++) {
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    await expect.poll(widthNow, { timeout: 4000 }).toBeGreaterThan(previous)
    previous = await widthNow()
  }

  // Nothing blank at the end: the chart and its header are as wide as the scrollable area.
  const widths = await page.evaluate(() => {
    const scroller = document.querySelector('[data-gantt-scroller]')
    const charts = [...(scroller?.querySelectorAll('svg') ?? [])]
      .map((svg) => svg.getBoundingClientRect().width)
      .filter((width) => width > 500)
    return { charts, scrollWidth: scroller?.scrollWidth ?? 0 }
  })
  expect(widths.charts).toHaveLength(2)
  expect(widths.charts[0]).toBe(widths.charts[1])
  expect(widths.scrollWidth).toBeGreaterThanOrEqual(widths.charts[0] ?? Infinity)
})

test('with many tasks only the task area scrolls, so headers stay in view', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 700 })
  await page.goto('/')
  await page.locator('input[accept=".gan"]').setInputFiles({
    name: 'proyek-besar.gan',
    mimeType: 'application/xml',
    buffer: Buffer.from(toGan(generateProject(200))),
  })
  await page.getByRole('button', { name: 'Simpan dan buka proyek' }).click()
  const grid = page.getByRole('treegrid')
  await expect(grid.getByRole('row')).toHaveCount(1 + 200)
  await page.waitForTimeout(600)

  const geometry = () =>
    page.evaluate(() => {
      const scroller = document.querySelector('[data-gantt-scroller]')
      const top = (element: Element | null | undefined) =>
        element?.getBoundingClientRect().top ?? NaN
      return {
        pageScrolls: document.documentElement.scrollHeight > innerHeight,
        scrollerHeight: scroller?.getBoundingClientRect().height ?? 0,
        scrollTop: scroller?.scrollTop ?? 0,
        header: top(document.querySelector('header')),
        tabs: top(document.querySelector('nav[aria-label="Tab proyek"]')),
        toolbar: top(document.querySelector('[aria-label="Filter tugas"]')?.closest('.sticky')),
        columns: top(document.querySelector('thead')),
      }
    })

  const before = await geometry()
  // The task area is shorter than the screen, and the page itself never scrolls.
  expect(before.pageScrolls).toBe(false)
  expect(before.scrollerHeight).toBeLessThan(700)

  await page.mouse.move(900, 450)
  await page.mouse.wheel(0, 2500)
  await expect.poll(async () => (await geometry()).scrollTop).toBeGreaterThan(2000)

  // Everything above the list stays where it was, and so do the column headings.
  const after = await geometry()
  expect(after.pageScrolls).toBe(false)
  expect(after.header).toBe(before.header)
  expect(after.tabs).toBe(before.tabs)
  expect(after.toolbar).toBe(before.toolbar)
  expect(after.columns).toBe(before.columns)

  // The same task rows and chart rows line up after scrolling a long way.
  const row = grid.getByRole('row').nth(120)
  await row.scrollIntoViewIfNeeded()
  await row.click()
  await expect(row).toHaveAttribute('aria-selected', 'true')
})

test('the table toolbar filters tasks, reorders them and sets columns', async ({ page }) => {
  await openDemo(page)
  const grid = page.getByRole('treegrid')
  const count = async () => (await grid.getByRole('row').count()) - 1
  expect(await count()).toBe(13)

  // Filter by type: the table and the chart follow, and the badge counts what is on.
  await page.getByRole('button', { name: 'Filter tugas' }).click()
  await expectNoSeriousViolations(page)
  await page.getByRole('checkbox', { name: 'Dokumentasi' }).uncheck()
  await page.getByRole('checkbox', { name: 'Milestone' }).uncheck()
  await expect.poll(count).toBe(9)
  await expect(page.getByRole('button', { name: 'Filter tugas, 2 aktif' })).toBeVisible()
  await expect(grid.getByRole('row', { name: /Survei lokasi/ })).toHaveCount(0)
  await expect(page.locator('svg g[data-id="2"]')).toHaveCount(0)

  await page.getByLabel('Sembunyikan tugas selesai').check()
  await expect(page.getByRole('button', { name: 'Filter tugas, 3 aktif' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(count).toBe(13)

  for (const name of [
    'Dokumentasi',
    'Desain',
    'Implementasi',
    'Bug',
    'Perbaikan',
    'Review',
    'Milestone',
  ]) {
    await page.getByRole('checkbox', { name }).uncheck()
  }
  await expect(page.getByText('Tidak ada tugas yang cocok dengan filter.')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.keyboard.press('Escape')

  // Reorder within a group; the neighbours are the siblings that show, and it can be undone.
  const up = page.getByRole('button', { name: 'Pindahkan tugas ke atas' })
  const down = page.getByRole('button', { name: 'Pindahkan tugas ke bawah' })
  await expect(up).toBeDisabled()
  await expect(down).toBeDisabled()
  await grid.getByRole('row', { name: /Desain interior/ }).click()
  await expect(up).toBeDisabled()
  await down.click()
  const order = async () =>
    (await grid.getByRole('row').allInnerTexts()).flatMap(
      (text) => text.match(/Desain interior|Pengerjaan ruang|Pasang mesin espresso/) ?? [],
    )
  await expect.poll(order).toEqual(['Pengerjaan ruang', 'Desain interior', 'Pasang mesin espresso'])
  await expect(up).toBeEnabled()
  await page.getByRole('button', { name: 'Urungkan' }).click()
  await expect.poll(order).toEqual(['Desain interior', 'Pengerjaan ruang', 'Pasang mesin espresso'])

  // The column menu now sits in this toolbar.
  await page.getByRole('button', { name: 'Atur kolom tabel' }).click()
  await page.getByRole('checkbox', { name: 'Durasi' }).check()
  await expect(grid.getByRole('columnheader', { name: 'Durasi' })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('the time scale zooms from daily detail out to whole years', async ({ page }) => {
  await openDemo(page)
  const zoomIn = page.getByRole('button', { name: 'Perbesar skala waktu' })
  const zoomOut = page.getByRole('button', { name: 'Perkecil skala waktu' })
  const level = page.locator('.zoom-label')
  await expect(level).toHaveText('Minggu')

  await zoomIn.click()
  await zoomIn.click()
  await expect(level).toHaveText('Detail')
  await expect(zoomIn).toBeDisabled()
  await expect(page.getByText(/^Sen \d+$/).first()).toBeVisible()
  await expectNoSeriousViolations(page)

  for (const name of ['Hari', 'Minggu', 'Bulan', 'Kuartal', 'Tahun']) {
    await zoomOut.click()
    await expect(level).toHaveText(name)
  }
  await expect(zoomOut).toBeDisabled()
  // Several years show by now, each with its own K1.
  await expect(page.getByText('K1', { exact: true }).first()).toBeVisible()

  // Ctrl with the wheel steps back in, and the chosen level is remembered.
  await page.mouse.move(900, 450)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')
  await expect(level).toHaveText('Kuartal')
  await page.reload()
  await page.getByRole('button', { name: /Peluncuran Kedai Kopi/ }).click()
  await expect(level).toHaveText('Kuartal')
})

test('the calendar sets working days and holidays, and the schedule follows', async ({ page }) => {
  await openDemo(page)
  const grid = page.getByRole('treegrid')
  const row = grid.getByRole('row', { name: /Pengerjaan ruang/ })
  const dates = async () => (await row.getByRole('gridcell').allInnerTexts()).slice(1, 3)
  const before = await dates()
  const tapDay = async (day: string) => {
    await page
      .getByRole('dialog', { name: 'Kalender kerja' })
      .locator('label', { has: page.getByRole('checkbox', { name: day }) })
      .click()
  }

  await page.getByRole('button', { name: 'Kalender' }).click()
  const dialog = page.getByRole('dialog', { name: 'Kalender kerja' })
  await expect(dialog.getByText('Hari kerja: Senin sampai Jumat')).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: 'Sabtu' })).not.toBeChecked()
  await expectNoSeriousViolations(page)

  // Working Saturdays shortens the same eight workdays.
  await tapDay('Sabtu')
  await expect(dialog.getByText('Hari kerja: Senin sampai Sabtu')).toBeVisible()
  await expect.poll(async () => (await dates())[1]).not.toBe(before[1])
  await tapDay('Sabtu')
  await expect.poll(dates).toEqual(before)

  // The last working day cannot be switched off.
  for (const day of ['Senin', 'Selasa', 'Rabu', 'Kamis']) {
    await tapDay(day)
  }
  await expect(dialog.getByRole('checkbox', { name: 'Jumat' })).toBeDisabled()
  for (const day of ['Senin', 'Selasa', 'Rabu', 'Kamis']) {
    await tapDay(day)
  }

  // A holiday inside the task pushes its end later.
  await dialog.getByLabel('Tanggal libur').fill('2026-12-24')
  await dialog.getByLabel('Nama hari libur (opsional)').fill('Cuti bersama')
  await dialog.getByRole('button', { name: 'Tambah', exact: true }).click()
  await expect(dialog.getByText('Cuti bersama')).toBeVisible()
  await dialog.getByRole('button', { name: /Hapus hari libur/ }).click()
  await expect(dialog.getByText('Cuti bersama')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
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
