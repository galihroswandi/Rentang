# 004. Antarmuka penampil (Tahap 1)

- **Status:** Diterima
- **Tanggal:** 2026-10-24

## Konteks

Tahap 1 membuat proyek bisa dilihat: layar Mulai, laporan impor, tabel tugas, dan Gantt hanya baca, dengan penyimpanan di browser. Targetnya: 200 tugas tampil di bawah 1 detik, tabel dapat dinavigasi dengan keyboard, dan cek axe lulus. Acuannya artboard 1a, 1b, dan 3a di kanvas desain.

## Keputusan

**Gaya: Tailwind v4 yang membaca token.** `src/ui/shell/global.css` mengosongkan palet, huruf, dan radius bawaan Tailwind, lalu memetakan setiap utilitas ke variabel di `docs/design/tokens.css` (`@theme inline`). Kelas seperti `bg-surface` atau `stroke-critical` selalu memakai token, dan tema gelap cukup mengganti nilai token. Tailwind juga menulis nama yang sama ke `@layer theme`, tetapi token yang tanpa layer selalu menang di urutan cascade.

**Token tambahan dari artboard Proyek › Gantt:** `sidebar`, `selected`, `selected-row`, `today`, `summary-bar`, dan `on-amber`. Nilainya diambil apa adanya dari kanvas; tidak ada warna baru.

**Huruf di-host sendiri** lewat `@fontsource/ibm-plex-sans` dan `@fontsource/ibm-plex-mono`. Tidak ada permintaan ke Google Fonts, sesuai janji di layar Mulai bahwa berkas tidak dikirim ke mana pun, dan aplikasi siap dipakai offline.

**Primitif: Bits UI** hanya untuk dialog Laporan impor, yang butuh fokus terkunci, Escape, dan pengembalian fokus. Kontrol lain cukup dengan `<button>` biasa.

**State: Zustand vanilla** di `src/app/store`, tanpa Svelte, sehingga alur impor dan buka diuji di Node. `ui/shell/context.ts` membungkusnya menjadi store Svelte (`$app`). Jadwal dan jalur kritis dihitung sekali saat proyek dibuka.

**Penyimpanan: `StorageProvider`** dengan `browser.ts` (Dexie). Ringkasan (persen, jumlah terlambat) disimpan bersama proyek agar sidebar tidak perlu menjadwalkan ulang. Berkas disimpan sebagai JSON dan divalidasi ulang setiap dimuat. Bila IndexedDB tidak tersedia, `memory.ts` dipakai untuk sesi itu saja.

**Tabel: treegrid WAI-ARIA dengan fokus per baris.** Dibangun di atas `<table role="treegrid">` dengan roving tabindex. Panah atas/bawah, Home/End, dan PageUp/PageDown berpindah baris. Kanan/kiri membuka atau menutup grup, atau melompat ke induk. Enter memilih. Aturan tombolnya fungsi murni (`treegrid-keys.ts`). Jalur kritis diumumkan pembaca layar lewat teks tersembunyi; Gantt-nya `aria-hidden` karena tabel memuat informasi yang sama.

**Gantt: SVG dari modul tata letak murni** (`ui/gantt/layout.ts`). Komponen hanya menggambar data dari modul itu. Zoom Hari 32 px, Minggu 15 px (token `--day-width`), dan Bulan 4 px per hari. Header atas berlabel per minggu, sehingga bulan tetap terbaca saat digulir; di zoom Bulan berlabel per bulan. Jalur kritis ditandai tepi 2 px, bukan warna saja.

**Satu kontainer scroll** untuk tabel dan Gantt. Tabel menempel di kiri, header menempel di atas, sesuai catatan skala di kanvas. Belum ada virtualisasi: 200 tugas tampil dalam sekitar 210-260 ms, diukur di dalam browser oleh e2e.

**Hari ini** dibaca dari jam lokal di `ui/today.ts` lalu dikirim ke core sebagai `IsoDate`. Proyek demo menggeser tanggalnya per minggu relatif terhadap hari ini, supaya selalu tampak sedang berjalan.

**Impor `.gan`** kini menghitung ulang persen tugas induk dari anak-anaknya dan mencatatnya di laporan, sesuai desain laporan impor.

**Ditunda dari desain ke tahap berikutnya:** Beranda, tab Dokumen/Resource/Kalender, panel detail tugas, kartu "Proyek kosong", tombol Tugas/Urungkan/Ulangi, dan "Simpan sebagai…". Elemen-elemen itu tidak ditampilkan sama sekali, supaya tidak ada tombol yang tidak berfungsi.

## Konsekuensi

- Semua warna di UI dijamin berasal dari token. Menambah warna berarti menambah token, dan itu butuh persetujuan pemilik.
- Bundle JS sekitar 135 kB gzip, terutama dari Zod, Dexie, Bits UI, dan parser XML. Importer bisa dimuat malas bila ukuran ini menjadi masalah.
- Tanpa virtualisasi, ribuan tugas akan lambat. Sesuai aturan proyek, virtualisasi atau canvas baru dipertimbangkan setelah terbukti lambat dengan pengukuran.
- Svelte memperingatkan `role="treegrid"` pada `<table>`. Peringatan itu diabaikan secara lokal, karena ARIA in HTML mengizinkannya dan contoh treegrid APG memakai pola yang sama.

## Alternatif

- **CSS bertingkup Svelte tanpa Tailwind:** lebih idiomatis di Svelte, tetapi menyimpang dari stack yang dipilih dan kurang relevan di lowongan.
- **Google Fonts:** tanpa dependensi, tetapi ada permintaan ke pihak ketiga dan tidak berjalan offline.
- **Grid berbasis `<div>`:** tanpa peringatan Svelte, tetapi kehilangan semantik tabel asli bila role-nya tidak dikenali.
- **Dua kontainer scroll yang disinkronkan:** lebih mudah ditata, tetapi rentan meleset satu baris dan butuh JavaScript untuk menyelaraskan scroll.
