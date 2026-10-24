# 0002. Pilihan stack

- **Status:** Diterima; bagian UI (React) digantikan oleh [ADR 0003](0003-svelte-untuk-ui.md)
- **Tanggal:** 2026-10-17

## Konteks

Aplikasi berjalan sepenuhnya di browser tanpa server, dengan data di IndexedDB. Anggaran ±50 jam menuntut tooling yang matang dan minim konfigurasi. Sebagai portofolio, stack sebaiknya umum dipakai industri agar mudah dinilai, dan kualitas kode (tipe, test, lint) harus terlihat.

## Keputusan

| Kebutuhan         | Pilihan                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Build dan dev     | Vite                                                                                      |
| UI                | React                                                                                     |
| Bahasa            | TypeScript dengan `strict` dan `noUncheckedIndexedAccess`                                 |
| Penyimpanan       | Dexie di atas IndexedDB                                                                   |
| Validasi dan tipe | Zod; tipe TS diturunkan dari skema                                                        |
| Test unit         | Vitest + Testing Library + fake-indexeddb                                                 |
| Test end-to-end   | Playwright (satu alur utama)                                                              |
| Kualitas kode     | ESLint (typescript-eslint `strictTypeChecked`, react-hooks, jsx-a11y `strict`) + Prettier |
| CI                | GitHub Actions menjalankan `npm run check`                                                |
| Timeline          | SVG (alasan rinci menyusul di ADR tersendiri)                                             |

State aplikasi diambil langsung dari Dexie (query reaktif) tanpa library state management. Tidak ada UI kit; komponen dibuat sendiri agar ringan dan aksesibilitasnya terkendali.

Catatan versi: ESLint dikunci di 9.x karena `eslint-plugin-jsx-a11y` belum mendukung ESLint 10. Template Vite terbaru memakai oxlint; diganti ESLint agar sesuai stack dan aturan aksesibilitas bisa dipakai.

## Alternatif

- **Next.js atau Remix:** fitur server tidak dibutuhkan untuk aplikasi tanpa server; menambah kompleksitas.
- **Svelte atau Solid:** ringan, tapi React lebih umum dicari recruiter dan klien.
- **IndexedDB langsung atau `idb`:** lebih sedikit dependensi, tapi migrasi skema dan query reaktif harus dibuat sendiri.
- **localStorage:** sinkron, kuota kecil, tanpa indeks; tidak cocok untuk ratusan tugas dengan catatan.
- **Valibot atau ArkType:** lebih kecil dari Zod, tapi ekosistem dan keterbacaannya bagi peninjau lebih rendah.
- **Jest:** butuh konfigurasi transformasi tambahan; Vitest berbagi konfigurasi dengan Vite.
- **Biome atau oxlint:** lebih cepat, tapi belum menyediakan setara aturan `jsx-a11y` dan type-aware lint selengkap typescript-eslint.

## Konsekuensi

- Lint type-aware membuat `npm run lint` lebih lambat, tapi menangkap kelas galat yang lebih luas.
- Tanpa state management, logika data harus disiplin berada di `src/db` dan `src/domain`, terpisah dari komponen.
- Mengganti stack di tengah jalan memerlukan ADR baru dan persetujuan pemilik.
