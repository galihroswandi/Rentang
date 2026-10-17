# Ruang Lingkup: Rentang

Dokumen acuan ruang lingkup proyek. Bila ada pertentangan antara dokumen ini dan instruksi kerja, pemilik proyek memutuskan.

## Tujuan

1. **Utama:** proyek portofolio yang dipamerkan ke recruiter dan calon klien freelance.
2. **Kedua:** dipakai sendiri sebagai pelacak proyek pribadi.

Prinsip: hasil yang **selesai dan rapi** lebih penting daripada fitur yang banyak. Anggaran total ±50 jam kerja.

## Produk

Aplikasi web pelacak proyek **local-first**:

- Satu sumber data tugas dengan tiga tampilan: **tabel**, **kanban**, **timeline** (Gantt sederhana, SVG).
- Catatan Markdown per tugas (textarea + pratinjau tersanitasi).
- Penyimpanan lokal di browser (IndexedDB).
- Ekspor/impor JSON berversi; ekspor tambahan `.md` per tugas.
- Tanpa akun, tanpa server, tanpa telemetri.

## Stack

Vite, React, TypeScript `strict`, Dexie (IndexedDB), Zod, Vitest + fake-indexeddb, Playwright (satu alur utama), ESLint + Prettier, GitHub Actions. Timeline dirender dengan SVG.

## Model data (skema versi 1)

| Entitas   | Field                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Project` | `id`, `name`, `createdAt`                                                                                                                         |
| `Task`    | `id`, `projectId`, `title`, `status` (`todo` \| `doing` \| `done`), `startDate`, `endDate`, `progress` (0–100), `isMilestone`, `notesMd`, `order` |

- Tanggal berupa string `YYYY-MM-DD`, tanpa jam dan zona waktu.
- Milestone: `startDate == endDate`.
- Tidak ada dependensi antartugas di skema 1.
- Skema memakai nomor versi dan migrasi Dexie.
- Semua data masuk (impor, form) divalidasi Zod; tipe TypeScript diturunkan dari skema Zod.

## Tahapan

| Tahap | Isi                                                       | Anggaran |
| ----- | --------------------------------------------------------- | -------- |
| 0     | Fondasi repo, tooling, CI, dokumen awal                   | ±4 jam   |
| 1     | Model data, penyimpanan, tampilan tabel                   | ±10 jam  |
| 2     | Kanban (drag + kontrol keyboard)                          | ±6 jam   |
| 3     | Timeline SVG baca-saja                                    | ±10 jam  |
| 4     | Catatan Markdown, ekspor/impor                            | ±8 jam   |
| 5     | Mode demo, audit aksesibilitas, dokumentasi, deploy       | ±10 jam  |
| 6     | _Opsional:_ drag dan resize di timeline (atas permintaan) | —        |

Setelah tahap 5, proyek dianggap cukup. Bila sebuah tahap diperkirakan melebihi anggarannya lebih dari 30%, ruang lingkup dipangkas.

## Aturan tetap

- Semua data demo, contoh, test, dan tangkapan layar **fiktif**. Tema demo: "merintis kedai kopi kecil".
- TypeScript `strict`; tanpa `any`, dan tanpa `@ts-ignore` kecuali disertai alasan.
- Setiap tahap meninggalkan repo hijau: lint, typecheck, test, build.
- Commit kecil, Conventional Commits.
- Keputusan arsitektur yang tidak sepele dicatat sebagai ADR di `docs/adr/`.
- Aksesibilitas sejak awal: operasi keyboard, label, kontras memadai.

## Di luar ruang lingkup

Dependensi tugas, jalur kritis, properti kustom, tampilan tersimpan, halaman bersarang, editor blok, impor `.gan`, akun, sinkronisasi, server, analitik/telemetri, canvas untuk timeline, library besar (state management, UI kit, editor rich text).
