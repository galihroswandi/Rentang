# ADR 008: Deploy ke Cloudflare Workers

Status: diterima (menunggu review pemilik)

## Konteks

Demo publik dihosting di Cloudflare Workers (static assets). Build Cloudflare menjalankan `pnpm run build` lalu `npx wrangler deploy`. Tanpa `wrangler.jsonc` dan tanpa `wrangler` di `package.json`, `wrangler deploy` mencoba menyetel proyek sendiri di mesin build dan gagal: pnpm 12 memblokir skrip build `esbuild` dan `workerd` (`ERR_PNPM_IGNORED_BUILDS`).

## Keputusan

1. `wrangler` menjadi devDependency (hanya alat deploy, tidak masuk bundel aplikasi).
2. `wrangler.jsonc` di root: aset dari `dist/`, `not_found_handling: single-page-application` supaya rute SPA jatuh ke `index.html`.
3. `pnpm-workspace.yaml` mengizinkan skrip build hanya untuk `esbuild` dan `workerd` (`allowBuilds`). Ini bukan monorepo; berkas itu hanya tempat konfigurasi pnpm.
4. Perintah deploy di Cloudflare: `npx wrangler deploy`.

## Konsekuensi

- Tidak ada backend, akun, atau telemetri aplikasi. `observability` Worker hanya log sisi Cloudflare untuk aset statis.
- Dependensi dev bertambah (`wrangler` dan turunannya); runtime aplikasi tidak berubah.
