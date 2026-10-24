import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../../app/persistence/memory.ts'
import { createAppStore } from '../../app/store/app-store.ts'
import { toIsoDate } from '../../core/dates.ts'
import App from './App.svelte'

const today = () => toIsoDate('2026-11-18')

async function renderApp() {
  const store = createAppStore({ storage: createMemoryStorage(), today, newId: () => 'id-1' })
  render(App, { props: { store, today } })
  await store.getState().start()
  return store
}

describe('App', () => {
  it('starts on the start screen when nothing is stored', async () => {
    await renderApp()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mulai dari mana?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Impor dari GanttProject/ })).toBeInTheDocument()
  })

  it('opens the demo with a keyboard-navigable task table', async () => {
    await renderApp()
    await fireEvent.click(await screen.findByRole('button', { name: 'Coba dengan proyek demo' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Peluncuran Kedai Kopi' }),
    ).toBeInTheDocument()
    const grid = screen.getByRole('treegrid', { name: 'Daftar tugas' })
    const rows = within(grid).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(13)
    expect(rows[0]).toHaveAttribute('tabindex', '0')
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true')

    rows[0]?.focus()
    await fireEvent.keyDown(grid, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(document.activeElement).toBe(within(grid).getAllByRole('row')[2])
    })

    // Back to the summary row, then collapse it.
    await fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    await fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    await waitFor(() => {
      expect(within(grid).getAllByRole('row')).toHaveLength(1 + 10)
    })
    expect(within(grid).getAllByRole('row')[1]).toHaveAttribute('aria-expanded', 'false')

    await fireEvent.keyDown(grid, { key: 'Enter' })
    expect(within(grid).getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('switches the time scale', async () => {
    await renderApp()
    await fireEvent.click(await screen.findByRole('button', { name: 'Coba dengan proyek demo' }))
    const zoomOut = await screen.findByRole('button', { name: 'Perkecil skala waktu' })
    await fireEvent.click(zoomOut)
    expect(zoomOut).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Perbesar skala waktu' })).toBeEnabled()
  })
})
