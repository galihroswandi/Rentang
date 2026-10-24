# 001. Stack

- **Status:** Diterima
- **Tanggal:** 2026-10-24

## Konteks

Rentang adalah SPA tanpa server yang sangat interaktif (Gantt yang bisa diseret, undo/redo, editor dokumen), dikerjakan satu orang dalam 8 minggu dengan 8-10 jam per minggu. Ia juga bukti kemampuan bagi recruiter dan klien freelance. Proyek portofolio lain (Flowvest) sudah memakai Next.js, jadi kemampuan di ekosistem React sudah terlihat di sana. Dokumen ruang lingkup aslinya menyebut React; keputusan ini menggantinya dengan Svelte.

## Keputusan

| Kebutuhan         | Pilihan                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paket dan runtime | pnpm, Node LTS (24)                                                                                                                                                |
| Build             | Vite, tanpa SvelteKit                                                                                                                                              |
| UI                | Svelte 5 (runes)                                                                                                                                                   |
| Bahasa            | TypeScript strict penuh (lihat CLAUDE.md)                                                                                                                          |
| State aplikasi    | Zustand (`zustand/vanilla`) dan Immer; undo/redo dari patch Immer (Tahap 2)                                                                                        |
| Validasi          | Zod; tipe diturunkan dari skema                                                                                                                                    |
| Parser .gan       | fast-xml-parser, dengan `XMLValidator` bawaannya untuk memeriksa sintaks XML                                                                                       |
| Penyimpanan       | File System Access API; Dexie untuk penyangga IndexedDB (Tahap 1 ke atas)                                                                                          |
| Editor dokumen    | TipTap (Tahap 3)                                                                                                                                                   |
| Gaya dan primitif | Tailwind CSS, Bits UI sebagai primitif aksesibel, token di `docs/design/tokens.css`                                                                                |
| Test              | Vitest + `@vitest/coverage-v8`, Testing Library Svelte, Playwright, `@axe-core/playwright`                                                                         |
| Kualitas kode     | ESLint flat config: typescript-eslint `strictTypeChecked`, `eslint-plugin-svelte`, `eslint-plugin-boundaries`; Prettier + `prettier-plugin-svelte`; `svelte-check` |

Padanan untuk pustaka khusus React di prompt asli:

- **Radix → Bits UI.** Bits UI adalah primitif headless untuk Svelte dengan perilaku keyboard dan ARIA serupa Radix.
- **jsx-a11y → a11y kompiler Svelte.** Kompiler Svelte memberi peringatan a11y yang dilaporkan sebagai galat oleh `svelte/valid-compile`. Pemeriksaan saat berjalan ditangani axe di Playwright.
- **Zustand tetap.** `zustand/vanilla` tidak bergantung pada React. Lapisan `app` jadi tidak bergantung pada kerangka UI dan bisa diuji di Node. `ui` berlangganan store lewat adaptor kecil.

Dependensi baru di luar daftar prompt: `@vitest/coverage-v8` (syarat coverage 90%), serta `svelte-check`, `eslint-plugin-svelte`, `prettier-plugin-svelte`, dan `@testing-library/svelte` sebagai alat Svelte.

Catatan: `XMLValidator` di fast-xml-parser ditandai usang. Penggantinya, paket `fast-xml-validator`, sempat dipakai tetapi dicabut karena dependensinya memanggil `Buffer` saat dimuat, sehingga halaman kosong di server dev Vite (build produksi lolos karena kodenya dibuang tree-shaking). Smoke test e2e untuk server dev menjaga hal serupa.

## Konsekuensi

- Kode komponen lebih ringkas dan bundle lebih kecil.
- Lint a11y statis tidak sedetail `jsx-a11y` `strict`; axe di Playwright untuk tiap layar utama menjadi pengaman utama.
- Komponen `.svelte` tanpa blok `<script>` tidak dikenali `svelte-check`; setiap komponen memuat `<script lang="ts">`, kosong sekalipun.
- Ekosistem Svelte lebih kecil daripada React; sejalan dengan larangan memakai pustaka Gantt jadi.
- `typecheck` menjalankan `svelte-check` lalu `tsc -b`, sehingga sedikit lebih lambat.

## Alternatif

- **React (sesuai prompt asli):** ekosistem dan lowongan terbesar, tetapi tidak menambah bukti kemampuan baru setelah Flowvest.
- **SvelteKit dengan adapter-static:** menambah routing dan konfigurasi yang belum dibutuhkan aplikasi satu halaman.
- **Store Svelte sebagai pengganti Zustand:** lebih idiomatis, tetapi lapisan `app` jadi bergantung pada Svelte dan undo/redo tetap butuh Immer.
- **Melt UI:** primitif Svelte yang lebih rendah tingkatnya; Bits UI lebih mirip Radix dan lebih cepat dipakai.
- **npm:** dipakai sebelum ini; pnpm lebih cepat, lebih ketat soal dependensi tak terdeklarasi, dan diminta prompt.
