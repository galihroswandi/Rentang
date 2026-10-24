# Rentang

Pelacak proyek **local-first** di browser: satu sumber data tugas dengan tampilan tabel, kanban, dan timeline. Data tersimpan di perangkat Anda (IndexedDB), tanpa akun dan tanpa server.

> Status: dalam pengembangan bertahap. Lihat [ruang lingkup](docs/SCOPE.md) untuk rencana lengkap.

## Menjalankan

Prasyarat: Node.js 22 atau lebih baru (versi yang dipakai tercatat di `.nvmrc`).

```bash
npm install
npm run dev
```

Aplikasi terbuka di <http://localhost:5173>.

## Skrip

| Skrip                  | Fungsi                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`          | Server pengembangan Vite dengan hot reload                                        |
| `npm run build`        | Typecheck lalu build produksi ke `dist/`                                          |
| `npm run preview`      | Menyajikan hasil build secara lokal                                               |
| `npm run lint`         | ESLint (type-aware, `eslint-plugin-svelte`)                                       |
| `npm run typecheck`    | Pemeriksaan tipe (`svelte-check` dan `tsc -b`) untuk kode, test, dan konfigurasi  |
| `npm run test`         | Test unit dengan Vitest, sekali jalan                                             |
| `npm run test:watch`   | Vitest dalam mode watch                                                           |
| `npm run format`       | Memformat seluruh berkas dengan Prettier                                          |
| `npm run format:check` | Memeriksa format tanpa mengubah berkas                                            |
| `npm run check`        | Menjalankan format:check, lint, typecheck, test, dan build berurutan (dipakai CI) |

## Struktur

```text
src/
  domain/    Skema, tipe, dan fungsi murni (tanpa Svelte, tanpa IndexedDB)
  db/        Lapisan akses data (Dexie)
  features/  Tampilan Svelte: tabel, kanban, timeline
  ui/        Komponen UI generik
tests/       Test unit dan komponen
docs/        Ruang lingkup dan ADR
```

## Dokumentasi

- [Ruang lingkup](docs/SCOPE.md)
- [Architecture Decision Records](docs/adr/README.md)

## Lisensi

[MIT](LICENSE)
