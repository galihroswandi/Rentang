# 005. Desain baru, penyuntingan, dan skema v2

- **Status:** Diterima
- **Tanggal:** 2026-10-24

## Konteks

Pemilik proyek mengganti desain dengan kanvas baru ("Sketsa Daftar Proyek Rentang", halaman Desain): Daftar proyek sebagai beranda, tab untuk tiap proyek yang dibuka, serta tampilan Gantt dan Resource di dalam proyek. Desain itu memuat kontrol yang semula dijadwalkan untuk Tahap 2–3 (menambah dan mengubah tugas, mengelola orang dan role, menugaskan orang). Pemilik meminta semuanya dikerjakan sekarang, dengan animasi dan tampilan yang responsif.

## Keputusan

**Model, skema v2.** Task mendapat `type` opsional (IMP, DOC, DSG, BUG, FIX, REV) yang tampil sebagai chip. Proyek mendapat daftar `roles`, dan resource boleh menunjuk satu `roleId`. Migrasi v1 → v2 menambahkan `roles: []`, dan ini migrasi nyata pertama. Importer `.gan` membaca role kustom dan role bawaan GanttProject, serta mengubah awalan nama seperti `[IMP] Login` menjadi jenis tugas.

**Penyuntingan dengan undo.** Setiap suntingan adalah resep Immer murni di `src/app/edits`. `src/app/history` mencatat patch dan patch kebalikannya (maksimal 100 langkah per proyek). Store memvalidasi hasil dengan skema Zod sebelum menerimanya, menghitung ulang jadwal, lalu menyimpan otomatis. Setiap suntingan memunculkan toast "Urungkan". Pintasan Ctrl+Z dan Ctrl+Shift+Z / Ctrl+Y bekerja di luar kolom isian.

**Navigasi.** Header memuat Impor .gan, Buka, Proyek baru, dan tombol tema. Di bawahnya ada tab "Daftar proyek" plus satu tab per proyek yang dibuka. `active` di store bernilai `null` untuk daftar proyek, bukan string khusus, supaya tidak bentrok dengan id proyek.

**Ikon** memakai `@lucide/svelte`, set yang sama dengan kanvas. `src/ui/icons/Icon.svelte` hanya memetakan nama ke komponen Lucide.

**Token** diganti dengan palet kanvas baru (terang dan gelap), termasuk warna chip jenis tugas. Jalur kritis kini cincin merah yang bisa dinyalakan dari toolbar, tetap ditandai bentuk (cincin dan titik di tabel), bukan warna saja.

**Animasi.** Transisi Svelte dibungkus di `src/ui/motion.ts` dan kelas CSS (`stagger`, `grow-x`, `pop`) di `global.css`. Semuanya selesai seketika bila sistem meminta gerakan dikurangi. Contohnya: baris dan kartu muncul bertahap, batang Gantt tumbuh dari tanggal mulainya, geometri bergeser saat zoom, indikator segmented control meluncur, popover dan dialog muncul dengan skala, dan tema berganti dengan lingkaran (View Transitions API, bila didukung).

**Responsif.**

- Di bawah 768 px, tombol header menjadi ikon saja.
- Tabel Daftar proyek menumpuk menjadi kartu kecil lewat container query.
- Tabel Gantt di ponsel hanya menampilkan Nama dan %.
- Panel Resource turun ke bawah daftar.
- Dialog menjadi sheet dari bawah layar.

**Zoom enam tingkat.** Detail (64 px per hari, dengan nama hari), Hari (32), Minggu (20, bawaan), Bulan (6), Kuartal (3) dan Tahun (1,2). Bentuk header mengikuti lebar hari: tingkat lebar memakai rentang minggu di atas nomor hari, Bulan memakai bulan di atas awal minggu, Kuartal memakai tahun di atas bulan, dan Tahun memakai tahun di atas K1–K4. Dua tingkat terakhir menampilkan tahun penuh dan tidak mengarsir akhir pekan karena terlalu rapat. Tombol − dan + berhenti di ujungnya dan nama tingkat tampil di tengah. Ctrl atau Cmd dengan roda mouse (atau cubitan di trackpad) juga mengubah tingkat. Saat tingkat berubah, tanggal yang ada di tengah layar tetap di tengah; "Hari ini" tetap memusatkan hari ini.

**Kalender kerja.** Tombol Kalender di toolbar Gantt membuka dialog untuk memilih hari kerja (bawaan Senin–Jumat, jadi Sabtu dan Minggu libur, juga untuk proyek baru dan impor `.gan` tanpa kalender) dan menambah hari libur khusus bertanggal beserta namanya. Minimal satu hari kerja harus tetap aktif. Perubahan kalender adalah suntingan biasa dengan "Urungkan": jadwal dihitung ulang dan arsiran akhir pekan serta hari libur di Gantt mengikuti. Skala waktu bawaan Gantt adalah Minggu.

**Seret batang Gantt.** Menggeser batang memindah tanggal mulai, dan menarik tepi kanannya mengubah durasi. Aturannya ada di `ui/gantt/drag.ts` (fungsi murni): piksel dibulatkan ke hari penuh; pemindahan tidak pernah mendarat di hari libur (ke depan ke hari kerja berikutnya, ke belakang ke hari kerja sebelumnya); durasi dihitung dalam hari kerja dan tidak kurang dari 1. Milestone hanya bisa dipindah, dan tugas induk tidak bisa diseret karena tanggalnya dihitung dari subtugasnya. Selama diseret tampil bayangan putus-putus beserta tanggal dan durasi barunya; Esc membatalkan. Hasilnya satu suntingan dengan "Urungkan". Tabel dan dialog tugas tetap jalur keyboard, karena seret hanya pintasan mouse dan sentuhan. Tanggal yang disimpan adalah tanggal mulai yang _diminta_: bila tugas punya pendahulu, menyeretnya lebih awal dari yang diizinkan dependensi tidak mengubah tanggal sebenarnya, karena jadwal tetap dihitung dari dependensi.

**Lebar tabel Gantt** bisa diseret lewat pembatas (`role="slider"`, bisa juga dengan panah kiri/kanan) dan diingat per proyek. Tabel ikut melebar sendiri saat kolom ditambah dari menu Kolom.

## Konsekuensi

- Waktu tampil 200 tugas naik menjadi sekitar 540–660 ms, dari sekitar 300 ms, karena tabel dan Gantt yang lebih kaya. Masih di bawah target 1 detik, tetapi selisihnya menipis.
- Sebagian Tahap 2 dan 3 sudah dikerjakan. Yang belum: seret batang, dependensi yang bisa disunting, dokumen proyek, dan penyimpanan ke berkas.
- Status simpan menyebut "Tersimpan di browser", bukan "di Drive" seperti di kanvas, karena penyimpanan ke Drive belum ada.
- Preferensi tampilan (mode daftar, kolom, zoom, jalur kritis, lebar tabel, tema) disimpan di localStorage per browser, bukan di berkas proyek.

## Alternatif

- **Menyembunyikan kontrol yang belum berfungsi:** lebih kecil, tetapi tampilan menyimpang dari desain. Pemilik memilih mengerjakan semuanya.
- **Role sebagai teks bebas di resource:** tanpa daftar role, tidak bisa dikelola atau dipilih dari dropdown seperti di desain.
- **Jenis tugas hanya dari awalan nama:** tanpa perubahan skema, tetapi nama dan jenis tercampur dan sulit disunting.
- **Menyimpan salinan proyek utuh untuk undo:** lebih sederhana, tetapi memorinya membengkak pada proyek besar. Patch hanya menyimpan perubahannya.
