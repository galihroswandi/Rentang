# Rentang

Aplikasi web satu halaman untuk memantau jadwal dan kemajuan semua proyek di satu tempat, dengan **Gantt** sebagai inti dan dokumen tulisan di sampingnya. Membuka berkas GanttProject (`.gan`), menyimpan ke berkas `.rentang` di komputer Anda. Tanpa akun dan tanpa server.

> **Status:** desain baru diterapkan. Anda bisa mengimpor `.gan` atau membuka `.rentang`, membaca laporan impor, mengelola proyek dari Daftar proyek (tabel atau kartu), membuka beberapa proyek dalam tab, menambah dan mengubah tugas, mengelola orang dan role, serta mengurungkan setiap suntingan. Proyek tersimpan di browser. Belum ada: seret batang Gantt, menyunting dependensi, dokumen proyek, dan simpan ke berkas. Rencana lengkap ada di [ruang lingkup](docs/ruang-lingkup.md).

## Menjalankan

Prasyarat: Node.js 24 (tercatat di `.nvmrc`) dan pnpm 10.

```bash
pnpm install
pnpm dev
```

Aplikasi terbuka di <http://localhost:5173>.

## Perintah

| Perintah             | Fungsi                                                                        |
| -------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`           | Server pengembangan dengan hot reload                                         |
| `pnpm build`         | Typecheck lalu build produksi ke `dist/`                                      |
| `pnpm typecheck`     | `svelte-check` dan `tsc -b`                                                   |
| `pnpm lint`          | ESLint, termasuk aturan batas lapisan                                         |
| `pnpm test`          | Test unit (Vitest)                                                            |
| `pnpm test:coverage` | Test dengan coverage; core minimal 90%                                        |
| `pnpm test:e2e`      | Test end-to-end, aksesibilitas, dan waktu tampil 200 tugas (Playwright + axe) |
| `pnpm format`        | Memformat dengan Prettier                                                     |
| `pnpm check`         | Semua pemeriksaan CI: format, berkas data, lint, test + coverage, build       |

## Struktur

```text
src/
  core/     TypeScript murni: model, tanggal, kalender, jadwal, jalur kritis, migrasi, impor .gan
  app/      Store aplikasi, suntingan dan riwayat undo, penyimpanan browser, proyek demo
  ui/       Komponen Svelte: header dan tab, Daftar proyek, Gantt, Resource, dialog
docs/
  ruang-lingkup.md   Ruang lingkup, tahap, dan risiko
  decisions/         Catatan keputusan arsitektur (ADR)
  design/tokens.css  Token desain terang dan gelap
fixtures/   Berkas .gan fiktif untuk test
e2e/        Test Playwright
```

Ketergantungan hanya ke satu arah: `ui → app → core`. Lint dan CI gagal bila aturan ini dilanggar ([ADR 002](docs/decisions/002-layers-and-dates.md)).

## Tahap

| Tahap | Isi                                                        | Status  |
| ----- | ---------------------------------------------------------- | ------- |
| 0     | Fondasi dan inti (core, lint, CI, token)                   | Selesai |
| 1     | Penampil: shell, tabel dan Gantt hanya baca, laporan impor | Selesai |
| 2     | Interaksi: seret, ubah durasi, dependensi, undo/redo       | —       |
| 3     | Berkas, dokumen, layar Proyek, kalender kerja              | —       |
| 4     | Rilis: demo fiktif, polesan aksesibilitas, studi kasus     | —       |

Setelah Tahap 4, proyek dibekukan.

## Keputusan

- [001. Stack](docs/decisions/001-stack.md)
- [002. Lapisan dan aturan tanggal](docs/decisions/002-layers-and-dates.md)
- [003. Format simpan dan penyimpanan berkas](docs/decisions/003-save-format-and-file-storage.md)
- [004. Antarmuka penampil](docs/decisions/004-viewer-ui.md)
- [005. Desain baru, penyuntingan, dan skema v2](docs/decisions/005-redesign-and-editing.md)

## Lisensi

[MIT](LICENSE)
