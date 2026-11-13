# 007. Dokumen proyek

- **Status:** Diterima (menunggu review pemilik)
- **Tanggal:** 2026-11-11

## Konteks

Ruang lingkup MVP memuat "catatan tugas dan dokumen proyek (halaman datar, editor yang sama), dengan tautan ke tugas", dengan TipTap sebagai editor ([ADR 001](001-stack.md), Tahap 3). Pemilik meminta tampilan Dokumen dibuat mengikuti usulan desain "Dokumen proyek" di kanvas: daftar dokumen di kiri, halaman di tengah, ringkasan di kanan, menu "/" untuk memilih blok, dan "@" untuk menyebut tugas.

## Keputusan

**Editor.** TipTap 3.32.0: `@tiptap/core`, `pm`, `starter-kit`, `extension-list`, `extensions`, `extension-mention`, dan `suggestion`. Dipakai langsung tanpa pembungkus Svelte. Modul `src/ui/docs/editor.ts` dimuat malas (`import()`), jadi TipTap (sekitar 128 kB gzip) berada di chunk sendiri dan baru diunduh saat dokumen dibuka. Core tetap tanpa TipTap: `src/core/rich-text.ts` hanya membaca JSON-nya (teks, jumlah kata, judul, sebutan tugas).

**Isi.** `document.content` menyimpan JSON editor apa adanya. Bloknya:

- paragraf, Judul 1 dan Judul 2;
- daftar, daftar bernomor, daftar centang;
- kutipan dan sorotan (`callout`);
- sebutan tugas (`taskMention` dengan `id` dan `label`).

Judul disimpan dengan level 1 dan 2, tetapi digambar sebagai h3 dan h4 karena judul dokumen sudah h2. Isi yang tidak cocok dengan skema editor dibuka hanya-baca, supaya isinya tidak tertimpa.

**Sebutan tugas.** Yang disimpan hanya id dan nama saat ditulis. Chip di halaman, kartu di samping, dan "Disebut di" di dialog tugas membaca nama, persen, tanggal, dan keterlambatan dari jadwal saat itu. Tugas yang dihapus tampil dicoret, dan mengurungkan penghapusan memulihkan tautannya.

**Waktu ubah.** `documents[].updatedAt` opsional (timestamp ISO yang ditulis app). Skema tetap versi 2 karena field-nya opsional, jadi berkas lama tetap valid.

**Undo.** Mengetik adalah suntingan biasa lewat `store.edit`, dengan dua pilihan baru:

- `quiet`: tanpa toast;
- `mergeKey`: suntingan berturut-turut dengan kunci yang sama menjadi satu langkah. Patch langkah itu dihitung ulang, jadi isi dokumen tersimpan sekali, bukan sekali per ketikan.

Kuncinya adalah dokumen ditambah kunjungan ke editor. Isi disimpan 500 ms setelah berhenti mengetik, saat editor ditinggalkan, dan saat tab disembunyikan. Ctrl+Z di dalam editor memakai riwayat TipTap yang lebih rinci; di luar editor memakai riwayat aplikasi.

**Jadwal tidak dihitung ulang** bila tugas, dependensi, dan kalender tidak berubah (objek Immer yang sama). Mengetik di dokumen tidak menjalankan penjadwalan.

**Catatan tugas.** `noteTextOf` kini membaca catatan berbentuk JSON (hasil impor `.gan` dan demo). Dialog tugas tidak lagi menampilkannya kosong lalu menghapusnya saat disimpan. Teks yang tidak diubah menyimpan dokumen aslinya; teks yang diubah disimpan sebagai dokumen editor.

**Impor Markdown.** Tombol "Impor .md" (toolbar Dokumen dan tampilan kosong) membuat satu dokumen baru per berkas `.md`, `.markdown`, atau `.mdown`; beberapa berkas sekaligus menjadi satu langkah undo. Pembacanya `src/core/markdown.ts`, buatan sendiri tanpa dependensi baru (sekitar 800 baris, murni, dengan test): ia hanya menghasilkan blok yang dikenal editor. Yang tidak punya padanan diturunkan, bukan ditolak: tabel menjadi blok kode berisi barisnya, gambar menjadi tautan ke gambar itu, HTML tetap teks, dan tautan selain `http(s)`, `mailto`, `tel` hanya menyisakan teksnya. Judul dokumen diambil dari `title` di front matter atau `# Judul` di awal berkas (judul di bawahnya naik satu tingkat bila itu satu-satunya `#`), selain itu dari nama berkas. Berkas di atas 1 MB atau berisi byte nol ditolak dengan pesan di halaman. Test `src/ui/docs/markdown-import.test.ts` memuat hasilnya ke editor TipTap asli, supaya dokumen impor tidak terbuka hanya-baca. Ekspor ke `.md` dan seret-lepas berkas `.md` belum ada.

## Konsekuensi

- Bundle utama naik sekitar 33 kB untuk komponen Dokumen; TipTap ada di chunk terpisah.
- Ketikan yang belum lewat 500 ms bisa hilang bila halaman ditutup paksa. Menyembunyikan tab sudah menyimpannya.
- Undo di luar editor mengurungkan satu kunjungan sekaligus. Untuk langkah kecil, pakai Ctrl+Z di dalam editor.
- Dialog tugas masih menyunting catatan sebagai teks polos, jadi mengubah teksnya menghapus format dan sebutan di catatan itu. Editor yang sama untuk catatan tugas (panel tugas di usulan desain) belum dibuat.

## Alternatif

- **Pustaka Markdown (marked, markdown-it, `@tiptap/markdown`):** parsing lebih lengkap, tetapi dependensi baru di luar ADR 001, dan keluarannya tetap harus dipetakan ke skema editor yang sempit. Pembaca kecil yang hanya memahami blok yang dikenal editor lebih mudah dijaga dan diuji.
- **Editor buatan sendiri di atas `contenteditable`:** dilarang CLAUDE.md dan rapuh.
- **Setiap ketikan satu langkah undo:** riwayat 100 langkah habis oleh ketikan dan menggeser suntingan Gantt.
- **Riwayat terpisah untuk dokumen:** dua tombol Urungkan dengan arti berbeda. Ditolak, karena kriteria MVP meminta undo untuk semua suntingan dalam satu riwayat.
- **Menyimpan nama dan tanggal tugas di dalam sebutan:** bisa dibaca tanpa jadwal, tetapi cepat usang.
