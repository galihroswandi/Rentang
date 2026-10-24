import { describe, expect, it } from 'vitest'
import type { StoredProjectSummary } from '../../app/persistence/storage-provider.ts'
import { toIsoDate } from '../../core/dates.ts'
import { filterProjects, milestoneText, relativeDay, shortDateFrom } from './list-text.ts'

const today = toIsoDate('2026-11-18')
// Local noon, so the calendar day is the same in every time zone the tests run in.
const at = (date: string) => new Date(`${date}T12:00:00`).toISOString()

function project(overrides: Partial<StoredProjectSummary> = {}): StoredProjectSummary {
  return {
    id: 'p',
    name: 'Peluncuran Kedai Kopi',
    area: 'work',
    origin: 'gan',
    fileName: 'kedai-kopi.gan',
    progress: 30,
    lateCount: 0,
    nextMilestone: { name: 'Soft opening', date: toIsoDate('2026-12-09') },
    isComplete: false,
    updatedAt: at('2026-11-18'),
    openedAt: at('2026-11-18'),
    ...overrides,
  }
}

describe('relativeDay', () => {
  it.each([
    ['2026-11-18', 'Hari ini'],
    ['2026-11-17', 'Kemarin'],
    ['2026-11-15', '3 hari lalu'],
    ['2026-11-11', '1 minggu lalu'],
    ['2026-10-20', '4 minggu lalu'],
    ['2026-09-10', '2 bulan lalu'],
    ['2025-10-01', '1 tahun lalu'],
    ['2026-11-20', 'Hari ini'],
  ])('%s is %s', (date, text) => {
    expect(relativeDay(at(date), today)).toBe(text)
  })

  it('shows a dash for a missing time', () => {
    expect(relativeDay('', today)).toBe('—')
    expect(relativeDay('kemarin', today)).toBe('—')
  })
})

describe('milestoneText', () => {
  it('shows the next milestone, with the year only when it differs', () => {
    expect(milestoneText(project(), today)).toEqual({
      name: 'Soft opening',
      date: '9 Des',
      done: false,
    })
    expect(shortDateFrom(toIsoDate('2027-01-20'), today)).toBe('20 Jan 2027')
  })

  it('marks a finished project and handles one without milestones', () => {
    expect(milestoneText(project({ isComplete: true }), today)).toEqual({
      name: 'Semua tugas selesai',
      date: 'Selesai',
      done: true,
    })
    expect(milestoneText(project({ nextMilestone: null }), today)).toBeNull()
  })
})

describe('filterProjects', () => {
  const projects = [
    project({ id: 'a' }),
    project({ id: 'b', name: 'Reservasi Studio Tari', fileName: 'studio-tari.gan' }),
    project({ id: 'c', name: 'Café Sederhana', fileName: null }),
  ]

  it('matches every word in name or file, ignoring case and accents', () => {
    expect(filterProjects(projects, '').map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(filterProjects(projects, 'STUDIO').map((p) => p.id)).toEqual(['b'])
    expect(filterProjects(projects, 'kopi .gan').map((p) => p.id)).toEqual(['a'])
    expect(filterProjects(projects, 'cafe').map((p) => p.id)).toEqual(['c'])
    expect(filterProjects(projects, 'roti')).toEqual([])
  })
})
