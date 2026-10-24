# Rentang

SPA tanpa server untuk memantau jadwal dan kemajuan proyek: Gantt sebagai inti, dokumen tulisan per proyek, simpan ke berkas `.rentang`. Pengguna: satu developer, dipakai harian di satu komputer (Chrome/Edge), plus demo publik berdata fiktif.

Sumber kebenaran ruang lingkup: [docs/ruang-lingkup.md](docs/ruang-lingkup.md). Keputusan arsitektur: [docs/decisions/](docs/decisions/).

## Bahasa

- Antarmuka: Indonesia.
- Kode, nama berkas, komentar: Inggris.
- Dokumen (`docs/`, README) dan percakapan dengan pemilik: Indonesia, ringkas.

## Aturan keras

1. Semua data (fixture, demo, contoh, test) fiktif. Jangan pernah memakai data kerja nyata atau menyebut nama klien atau instansi di kode, data, commit, atau dokumentasi.
2. Tiga lapisan: `src/core`, `src/app`, `src/ui`. Ketergantungan hanya satu arah: ui boleh memakai app dan core, app boleh memakai core, core tidak boleh memakai siapa pun. core adalah TypeScript murni: dilarang mengimpor svelte, react, DOM API, dexie, zustand, immer, tiptap. Dijaga lint (`eslint-plugin-boundaries`, `no-restricted-imports`, `no-restricted-globals`) dan `tsconfig.core.json` tanpa DOM; CI gagal bila dilanggar.
3. Tanggal adalah string `'YYYY-MM-DD'` (tipe `IsoDate`). Dilarang `new Date`, `Date.now`, `Intl.DateTimeFormat` di `src/core` (lint `no-restricted-syntax`). Aritmetika tanggal hanya di `src/core/dates.ts`.
4. Tanggal selesai tugas tidak pernah disimpan; selalu dihitung dari mulai, durasi hari kerja, dependensi, dan kalender (`src/core/schedule.ts`).
5. TypeScript strict penuh: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Dilarang `any` dan `@ts-ignore`; `@ts-expect-error` hanya dengan komentar alasan.
6. Rentang tidak pernah menulis balik ke berkas `.gan` asli. Format simpan sendiri adalah `.rentang` (JSON dengan `schemaVersion`).

## Cara kerja

- Kerjakan satu tahap saja (lihat "Tahap kerja" di ruang lingkup). Berhenti di akhir tahap, laporkan, tunggu persetujuan.
- Logika core ditulis bersama test-nya. Tidak ada logika core tanpa test. Coverage core minimal 90%.
- Commit kecil dan sering (Conventional Commits). Jangan push atau membuat PR kecuali diminta.
- Jangan menambah dependensi di luar stack ([ADR 001](docs/decisions/001-stack.md)) tanpa ADR.
- Jangan mengubah desain atau token (`docs/design/tokens.css`) tanpa persetujuan pemilik.
- Sebelum menyatakan selesai, jalankan `pnpm check` dan tempelkan hasilnya. Jangan menyatakan selesai bila ada yang merah.

## Jangan lakukan

- Pustaka Gantt jadi, atau editor teks buatan sendiri.
- Backend, akun, analytics, atau telemetri.
- Monorepo, canvas, atau Web Worker sebelum terbukti lambat dengan pengukuran.
- Fitur di luar daftar MVP (kanban, ekspor `.gan`, Google Drive API, palet perintah, properti kustom, baseline, dependensi selain finish-to-start).
- localStorage untuk dokumen proyek.

## Perintah

| Perintah                | Fungsi                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm dev`              | Server pengembangan Vite                                         |
| `pnpm build`            | Typecheck lalu build produksi ke `dist/`                         |
| `pnpm typecheck`        | `svelte-check` lalu `tsc -b` (core, app, test, config)           |
| `pnpm lint`             | ESLint, termasuk batas lapisan dan larangan `Date` di core       |
| `pnpm test`             | Vitest sekali jalan (proyek `core` di Node, `ui` di jsdom)       |
| `pnpm test:coverage`    | Vitest dengan coverage; gagal bila core di bawah 90%             |
| `pnpm test:e2e`         | Playwright + axe (butuh `pnpm exec playwright install chromium`) |
| `pnpm check:data-files` | Gagal bila ada berkas `.gan` atau `.rentang` di luar `fixtures/` |
| `pnpm format`           | Prettier                                                         |
| `pnpm check`            | Semua pemeriksaan CI berurutan                                   |

## Peta kode

- `src/core/dates.ts`, `calendar.ts`: tanggal tanpa `Date`, kalender kerja.
- `src/core/model.ts`: skema Zod dan tipe; `CURRENT_SCHEMA_VERSION`.
- `src/core/graph.ts`, `schedule.ts`, `critical-path.ts`: graf dependensi antartugas daun, penjadwalan maju, jalur kritis.
- `src/core/migrations.ts`: migrasi `.rentang` per versi.
- `src/core/gan/`: `parse.ts` (XML ke struktur tervalidasi), `map.ts` (ke model + laporan), `report.ts` (tipe laporan).
- `src/core/summary.ts`: rollup persen, status tugas, ringkasan proyek.
- `src/core/test-utils/`: proyek emas Kedai Kopi, generator proyek deterministik, dan `toGan` untuk membuat `.gan` besar di test (hanya untuk test; Rentang tidak menulis `.gan`).
- `src/app/persistence/`: `StorageProvider`, `browser.ts` (Dexie), `memory.ts`.
- `src/app/store/app-store.ts`: state aplikasi (Zustand vanilla): layar, proyek terbuka, impor yang menunggu konfirmasi.
- `src/app/demo/`: proyek demo fiktif, tanggalnya digeser relatif ke hari ini.
- `src/ui/shell/`: App, Sidebar, tema, konteks store (`$app`), `global.css` (Tailwind dipetakan ke token).
- `src/ui/table/`: `rows.ts` (baris pohon tugas), `treegrid-keys.ts`, `TaskTable.svelte`.
- `src/ui/gantt/`: `layout.ts` (geometri murni), `GanttChart.svelte`.
- `src/ui/import/`: dialog dan teks Laporan impor, teks galat.

## Catatan UI

- Warna hanya lewat utilitas Tailwind yang dipetakan ke token (`bg-surface`, `stroke-critical`, ...). Jangan menulis hex di komponen.
- Logika UI yang bisa diuji tanpa browser ditaruh di modul `.ts` murni dan diuji; komponen `.svelte` diuji hanya bila punya logika.
- `fixtures/kedai-kopi-demo.gan`: satu-satunya tempat berkas `.gan` boleh ada.
