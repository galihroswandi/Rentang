import type { Notice, OpenFileError } from '../../app/store/app-store.ts'

export function describeOpenError(error: OpenFileError): string {
  switch (error.type) {
    case 'malformed-xml':
      return `Berkas ini bukan XML yang valid (baris ${String(error.line)}).`
    case 'not-a-gan-file':
      return 'Berkas ini bukan proyek GanttProject.'
    case 'invalid-structure':
      return 'Struktur berkas .gan tidak bisa dibaca.'
    case 'invalid-project':
      return 'Isi proyek tidak valid, jadi berkas tidak dibuka.'
    case 'not-an-object':
    case 'missing-schema-version':
      return 'Berkas ini bukan berkas Rentang.'
    case 'newer-schema-version':
      return `Berkas ini dibuat oleh versi Rentang yang lebih baru (skema ${String(error.version)}).`
    case 'missing-migration':
      return `Berkas memakai skema lama (${String(error.fromVersion)}) yang tidak dikenali.`
    case 'invalid-json':
      return 'Berkas .rentang rusak: isinya bukan JSON yang valid.'
    case 'unsupported-file':
      return 'Jenis berkas tidak didukung. Pilih berkas .gan atau .rentang.'
    case 'not-found':
      return 'Proyek tidak ditemukan di penyimpanan browser.'
  }
}

export function describeNotice(notice: Notice): string {
  if (notice.kind === 'storage-failed') {
    return 'Penyimpanan browser tidak bisa dipakai, jadi perubahan tidak tersimpan. Periksa izin situs atau mode penjelajahan pribadi.'
  }
  return `${notice.fileName}: ${describeOpenError(notice.error)}`
}
