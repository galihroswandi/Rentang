import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importGan } from '../../core/gan/map.ts'
import type { ImportReport } from '../../core/gan/report.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { describeNotice, describeOpenError } from './error-text.ts'
import { describeReport } from './report-text.ts'

describe('describeReport', () => {
  it('describes the demo fixture import', () => {
    const result = importGan(readFileSync(resolve('fixtures/kedai-kopi-demo.gan'), 'utf8'), {
      projectId: 'p',
    })
    if (!result.ok) throw new Error('import failed')
    expect(describeReport(result.value.report, result.value.project)).toEqual({
      counts: { imported: 14, changed: 2, skipped: 3 },
      imported: [
        '14 tugas, termasuk 3 tugas induk dan 1 milestone',
        '11 dependensi',
        '1 resource dan 1 penugasan',
        'Kalender kerja: Senin sampai Jumat',
        'Catatan 1 tugas (teks polos) masuk ke catatan tugas',
      ],
      changed: [
        {
          text: '1 dependensi start-to-start menjadi finish-to-start. Jadwal bisa bergeser.',
          detail: 'Desain interior → Cetak menu & papan harga',
        },
        {
          text: 'Persen selesai pada 1 tugas induk dihitung ulang dari anak-anaknya',
          detail: 'Persiapan',
        },
      ],
      skipped: [
        { text: '1 baseline tersimpan', detail: '“Rencana awal”' },
        { text: 'Kolom kustom “Anggaran”' },
        { text: '1 hari libur berulang tiap tahun', detail: 'Tahun Baru (1 Januari)' },
      ],
    })
  })

  it('describes every kind of change and skip', () => {
    const report: ImportReport = {
      imported: { tasks: 2, dependencies: 0, resources: 0, assignments: 0, holidays: 3 },
      changed: [
        { code: 'dependency-type-converted', from: '2', to: '3', original: 'finish-to-finish' },
        { code: 'dependency-type-converted', from: '3', to: '4', original: 'unknown' },
        { code: 'milestone-duration-reset', taskId: '13', originalDuration: 1 },
        { code: 'zero-duration-raised', taskId: '2' },
        { code: 'progress-adjusted', taskId: '2', original: '120' },
        { code: 'lag-reset', from: '2', to: '3', original: 'x' },
        { code: 'default-work-week' },
      ],
      skipped: [
        { code: 'baseline', name: 'A' },
        { code: 'baseline', name: 'B' },
        { code: 'recurring-holiday', month: '8', day: '17', name: '' },
        { code: 'invalid-holiday', year: '2026', month: '2', day: '30' },
        { code: 'unsupported-calendar-day', type: 'WORKING_DAY' },
        { code: 'invalid-task', taskId: '99', reason: 'invalid-start' },
        { code: 'invalid-link', taskId: '2' },
        { code: 'dangling-dependency', from: '2', to: '98' },
        { code: 'self-dependency', taskId: '2' },
        { code: 'dangling-assignment', taskId: '2', resourceId: 'r' },
      ],
    }
    const text = describeReport(report, { ...coffeeShopProject(), tasks: [] })
    expect(text.imported).toEqual([
      '2 tugas',
      '0 dependensi',
      'Kalender kerja: Senin sampai Jumat',
      '3 hari libur',
    ])
    expect(text.changed.map((line) => line.text)).toEqual([
      '1 dependensi finish-to-finish menjadi finish-to-start. Jadwal bisa bergeser.',
      '1 dependensi berjenis tidak dikenal menjadi finish-to-start. Jadwal bisa bergeser.',
      'Durasi 1 milestone dijadikan 0 hari',
      '1 tugas berdurasi 0 dijadikan 1 hari kerja',
      'Persen selesai 1 tugas dibulatkan ke 0–100',
      'Jeda 1 dependensi tidak terbaca dan dijadikan 0',
      'Minggu kerja tidak terbaca, jadi dipakai Senin sampai Jumat',
    ])
    expect(text.changed[0]?.detail).toBe('#2 → #3')
    expect(text.skipped.map((line) => line.text)).toEqual([
      '2 baseline tersimpan',
      '1 hari libur berulang tiap tahun',
      '1 hari libur bertanggal tidak valid',
      '1 pengecualian kalender selain hari libur',
      '1 tugas tidak terbaca',
      '1 tautan tugas yang tidak valid',
      '2 dependensi yang rusak atau ganda',
      '1 penugasan ke tugas atau resource yang tidak ada',
    ])
    expect(text.skipped[1]?.detail).toBe('17 Agustus')
  })
})

describe('error text', () => {
  it.each([
    [
      { type: 'malformed-xml', message: 'x', line: 3 },
      'Berkas ini bukan XML yang valid (baris 3).',
    ],
    [{ type: 'not-a-gan-file' }, 'Berkas ini bukan proyek GanttProject.'],
    [{ type: 'invalid-structure', issues: [] }, 'Struktur berkas .gan tidak bisa dibaca.'],
    [{ type: 'invalid-project', issues: [] }, 'Isi proyek tidak valid, jadi berkas tidak dibuka.'],
    [{ type: 'not-an-object' }, 'Berkas ini bukan berkas Rentang.'],
    [{ type: 'missing-schema-version' }, 'Berkas ini bukan berkas Rentang.'],
    [
      { type: 'newer-schema-version', version: 4 },
      'Berkas ini dibuat oleh versi Rentang yang lebih baru (skema 4).',
    ],
    [
      { type: 'missing-migration', fromVersion: 1 },
      'Berkas memakai skema lama (1) yang tidak dikenali.',
    ],
    [{ type: 'invalid-json' }, 'Berkas .rentang rusak: isinya bukan JSON yang valid.'],
    [{ type: 'unsupported-file' }, 'Jenis berkas tidak didukung. Pilih berkas .gan atau .rentang.'],
    [{ type: 'not-found' }, 'Proyek tidak ditemukan di penyimpanan browser.'],
  ] as const)('describes %j', (error, text) => {
    expect(describeOpenError(error)).toBe(text)
  })

  it('describes notices', () => {
    expect(
      describeNotice({ kind: 'open-failed', fileName: 'a.gan', error: { type: 'not-a-gan-file' } }),
    ).toBe('a.gan: Berkas ini bukan proyek GanttProject.')
    expect(describeNotice({ kind: 'storage-failed' })).toContain('Penyimpanan browser')
  })
})
