# 0003. Svelte untuk lapisan UI

- **Status:** Diterima
- **Tanggal:** 2026-10-24

## Konteks

[ADR 0002](0002-stack.md) memilih React dan menolak Svelte dengan alasan React lebih umum dicari recruiter. Alasan itu berubah: proyek portofolio lain (Flowvest) sudah memakai Next.js, sehingga kemampuan di ekosistem React sudah terlihat di sana. Rentang berjalan sepenuhnya di browser tanpa server, dan kodenya baru berupa kerangka (belum ada fitur), jadi biaya berpindah masih kecil.

## Keputusan

Lapisan UI memakai **Svelte 5** (runes) dengan Vite. Bagian lain ADR 0002 tetap berlaku: TypeScript `strict`, Dexie, Zod, Vitest, Playwright, ESLint, Prettier, dan GitHub Actions.

| Kebutuhan     | Sebelumnya                                 | Sekarang                                                   |
| ------------- | ------------------------------------------ | ---------------------------------------------------------- |
| UI            | React                                      | Svelte 5 + `@sveltejs/vite-plugin-svelte`                  |
| Test komponen | `@testing-library/react`                   | `@testing-library/svelte`                                  |
| Lint          | `react-hooks`, `react-refresh`, `jsx-a11y` | `eslint-plugin-svelte`; aturan a11y bawaan kompiler Svelte |
| Typecheck     | `tsc -b`                                   | `svelte-check` untuk `src` dan `tests`, lalu `tsc -b`      |
| Format        | Prettier                                   | Prettier + `prettier-plugin-svelte`                        |

Tanpa SvelteKit: aplikasi satu halaman tanpa server tidak membutuhkan routing sisi server. Query reaktif Dexie (`liveQuery`) dipakai langsung sebagai store Svelte, sehingga tetap tanpa library state management.

## Alternatif

- **Tetap React:** ekosistem dan lowongan lebih besar, tetapi tidak menambah bukti kemampuan baru setelah Flowvest.
- **SvelteKit dengan adapter-static:** menambah struktur dan konfigurasi yang belum dibutuhkan; dapat ditambahkan nanti bila perlu routing.
- **Solid:** model reaktivitas mirip, tetapi ekosistem dan dokumentasinya lebih kecil daripada Svelte.

## Konsekuensi

- Kode komponen lebih ringkas dan bundle lebih kecil (build awal ±23 kB sebelum gzip).
- Lint a11y tidak sedetail `jsx-a11y` `strict`; pemeriksaan bergantung pada peringatan kompiler Svelte dan aturan `eslint-plugin-svelte`.
- Berkas `.svelte` tanpa blok `<script>` tidak dikenali `svelte-check`; setiap komponen memuat `<script lang="ts">`, kosong sekalipun.
- Ekosistem pustaka komponen lebih kecil; sejalan dengan keputusan membuat komponen sendiri tanpa UI kit.
- `src/domain` dan `src/db` tidak bergantung pada kerangka UI.
