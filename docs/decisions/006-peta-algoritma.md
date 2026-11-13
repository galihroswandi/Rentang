# ADR 006: Peta algoritma

Status: diterima (menunggu review pemilik)

## Konteks

Developer baru sulit melihat bagaimana algoritma Rentang tersambung lintas lapisan (`core`, `app`, `ui`). Bila ada gejala, misalnya bar Gantt mendarat di tanggal yang salah, ia harus bertanya ke AI untuk tahu ke mana harus melihat. Dokumen biasa cepat usang, dan diagram buatan sendiri sulit dibaca tanpa notasi yang disepakati.

## Keputusan

1. **Alat terpisah di `tools/peta-algoritma/`.** Alat ini punya `package.json`, README, test (`node:test`), dan JSON Schema sendiri. Ia tidak mengimpor apa pun dari `src/`, tidak punya dependensi, dan bukan bagian dari build aplikasi. Bisa dipindah ke repo sendiri dengan `git subtree split --prefix tools/peta-algoritma` atau disalin ke proyek lain. Ini bukan monorepo: tidak ada workspace pnpm, dan Rentang menjalankannya lewat path.
2. **Isi peta Rentang di `docs/peta/`.** Ada satu berkas utama (`peta.config.json`) dan berkas per bagian: core, app, ui, alur, model, masalah, istilah. Formatnya JSON dengan `$schema`, supaya editor memberi autocomplete dan validasi.
3. **Notasi UML standar, dirender sendiri sebagai SVG:**
   - use case: apa yang bisa dilakukan pengguna;
   - urutan (sequence): alur lintas lapisan;
   - komponen/paket: arsitektur;
   - aktivitas: langkah tiap algoritma;
   - kelas: model data dan data turunan;
   - status: status simpan, seret bar, status tugas, dan impor yang menunggu.
4. **Relasi antarmodul dihitung dari impor kode**, bukan ditulis tangan, sehingga tidak bisa usang.
5. **Penjaga di CI (`pnpm peta:check --strict` dan `pnpm peta:test`).** Pemeriksaan gagal bila:
   - berkas atau simbol yang dirujuk peta tidak ada;
   - sebuah rujukan putus;
   - sebuah impor melanggar arah lapisan;
   - ada berkas di `src/**/*.{ts,svelte}` yang tidak masuk modul mana pun dan tidak tercantum di `ignore` beserta alasannya;
   - ada fungsi yang diekspor tetapi belum dijelaskan oleh sebuah algoritma, alur, atau gejala.
6. **Hasilnya satu HTML mandiri di `dist-peta/`** (tidak di-commit karena memuat path lokal untuk tautan VS Code). `pnpm peta` menjalankan server lokal yang memperbaruinya saat kode atau peta berubah.

## Alternatif yang ditolak

- **Docusaurus, VitePress, Starlight.** Menambah dependensi dan toolchain, padahal yang dibutuhkan adalah peta yang terhubung ke kode dan diperiksa terhadapnya. Mesin situs tidak menyediakan itu.
- **Mermaid atau PlantUML.** Diagramnya standar, tetapi Mermaid adalah dependensi besar di browser dan PlantUML butuh Java atau server. Klik ke baris kode dan sorotan antara diagram dan daftar langkah juga sulit dibuat.
- **Graf impor otomatis (dependency-cruiser, madge).** Hanya menunjukkan siapa mengimpor siapa, bukan algoritmanya. Kebutuhan ini dipenuhi oleh relasi otomatis di poin 4.

## Konsekuensi

- Mengganti nama, memindahkan, atau menambah berkas atau fungsi ekspor di `src` mewajibkan pembaruan peta. CI menolak bila tidak. Ini disengaja. Bila terlalu ketat, `--strict` bisa dilepas sehingga fungsi ekspor yang belum dijelaskan hanya menjadi peringatan.
- Isi penjelasan, langkah, alur, dan gejala tetap ditulis tangan. Penjaga menjamin rujukannya benar, bukan kebenaran penjelasannya.
- Simbol, impor, dan ekspor dibaca dengan pola teks, bukan parser TypeScript. Polanya diuji, tetapi gaya kode yang tidak biasa bisa luput.
