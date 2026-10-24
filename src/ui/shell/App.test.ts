import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import App from './App.svelte'

describe('App', () => {
  it('menampilkan judul aplikasi sebagai heading utama', () => {
    render(App)
    expect(screen.getByRole('heading', { level: 1, name: 'Rentang' })).toBeInTheDocument()
  })
})
