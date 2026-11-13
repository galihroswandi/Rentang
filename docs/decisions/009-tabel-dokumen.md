# 009. Tabel di dokumen

- **Status:** Diterima (menunggu review pemilik)
- **Tanggal:** 2026-11-13

## Konteks

Dokumen proyek ([ADR 007](007-dokumen-proyek.md)) belum punya tabel, dan impor `.md` menurunkan tabel menjadi blok kode. Pemilik meminta editor bisa membuat tabel dan membaca tabel Markdown.

## Keputusan

- **Dependensi:** `@tiptap/extension-table` 3.32.0 (satu versi dengan paket TipTap lain di ADR 007; memuat `Table`, `TableRow`, `TableHeader`, `TableCell`). Ikut chunk editor yang dimuat malas.
- **Membuat:** menu "/" punya "Tabel" (3 × 3 dengan baris judul). Saat caret di dalam tabel, bilah kecil di atasnya menambah baris dan kolom (atas/bawah, kiri/kanan), menyalakan baris judul, menghapus baris, kolom, atau tabel. Tab dan Shift+Tab pindah antar sel; Tab di sel terakhir menambah baris.
- **Isi:** `table` → `tableRow` → `tableHeader` | `tableCell` → blok (paragraf). Tidak ada atribut yang wajib; lebar kolom tidak bisa diseret.
- **Membaca Markdown:** `src/core/markdown.ts` membaca tabel GFM: baris judul, baris pemisah dengan jumlah sel yang sama, lalu baris isi sampai baris kosong atau blok berikutnya. Baris isi dipotong atau dilengkapi sesuai lebar judul supaya tabel selalu persegi. `\|` adalah garis tegak di dalam sel; tanda tebal, miring, kode, dan tautan di sel tetap terbaca. Perataan (`:-:`) dibuang karena editor tidak punya pengaturannya. Judul yang jumlah selnya beda dengan pemisah dianggap paragraf, seperti di GFM.
- **Teks polos** (`plainTextOf`): sel satu baris dipisah tab, baris tabel dipisah baris baru.

## Konsekuensi

- Dokumen yang sudah diimpor dengan tabel sebagai blok kode tidak berubah; hanya impor berikutnya yang menghasilkan tabel.
- Tabel tanpa lebar kolom yang bisa diatur; sel berisi paragraf saja (tanpa daftar di dalam sel dari Markdown).
- Ekspor ke Markdown dan menempel tabel Markdown ke editor belum ada.

## Alternatif

- **Tabel buatan sendiri di atas `contenteditable`:** dilarang CLAUDE.md dan rapuh.
- **`@tiptap/markdown`:** menambah dependensi besar hanya untuk satu blok; pembaca yang ada sudah cukup.
