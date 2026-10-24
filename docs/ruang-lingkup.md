# Rentang: ruang lingkup dan prompt Claude Code

24 Oktober 2026 · Galih Roswandi

> **Perubahan dari versi asli dokumen:** lapisan UI memakai **Svelte 5**, bukan React. Padanannya: Radix diganti Bits UI, jsx-a11y diganti pemeriksaan a11y kompiler Svelte dan `eslint-plugin-svelte`. Alasan dan rinciannya di [ADR 001](decisions/001-stack.md). Selebihnya dokumen ini sama dengan aslinya.

Rentang adalah aplikasi web satu halaman untuk memantau jadwal dan kemajuan semua proyek Anda di satu tempat, dengan Gantt sebagai inti dan dokumen tulisan di sampingnya.

## Ringkasan dan tujuan

- **Masalah:** GanttProject untuk jadwal dan Notion untuk tulisan membuat pembaruan harus dilakukan di dua tempat, sehingga akhirnya tidak sempat diperbarui.
- **Tujuan utama:** alat harian yang menggantikan keduanya untuk proyek Anda sendiri (kerja, keuangan, karir).
- **Tujuan kedua:** bukti kemampuan untuk recruiter dan calon klien freelance, lewat demo publik berdata fiktif dan studi kasus di portofolio.
- **Ukuran keberhasilan:** satu proyek nyata dikelola penuh di Rentang selama 2 minggu tanpa kembali ke GanttProject atau Notion untuk jadwal dan catatan.
- **Batas waktu:** 8 minggu dengan sekitar 8-10 jam per minggu. Setelah itu proyek dibekukan, apa pun statusnya.
- **Bukan tujuan:** tiruan Notion penuh (database, halaman bersarang), sinkronisasi antarperangkat, kolaborasi, dan aplikasi ponsel.

## Ruang lingkup MVP

MVP adalah penampil dan editor Gantt yang membuka berkas `.gan`, menyimpan ke berkas `.rentang`, dan memuat dokumen proyek sederhana.

**Inti, tidak dipotong:**

- Impor `.gan` dengan laporan impor (berhasil, diubah, dilewati)
- Tugas bertingkat, milestone, dependensi finish-to-start dengan lag
- Gantt: tampil, lalu seret dan ubah durasi dengan pratinjau; zoom Hari, Minggu, Bulan
- Jalur kritis dan undo/redo untuk semua suntingan
- Kalender kerja (akhir pekan dan hari libur); durasi dihitung dalam hari kerja
- Catatan tugas dan dokumen proyek (halaman datar, editor yang sama), dengan tautan ke tugas
- Layar Proyek: kartu per proyek, filter Bidang (Kerja, Keuangan, Karir)
- Simpan otomatis ke berkas, deteksi konflik, penyangga pemulihan di IndexedDB
- Mode demo berdata fiktif; tema terang dan gelap dari token

**Dipotong dari bawah jika jadwal meleset (urutan potong):**

1. Resource (penugasan nama saja)
2. Pratinjau dampak hari libur dan detail kalender
3. Kerapian layar Proyek (data tetap dihitung)

**Ditunda setelah MVP:** ekspor `.gan`, Google Drive API, kanban, properti kustom, tampilan tersimpan, tipe dependensi selain finish-to-start, baseline, grafik beban resource, bentrok antarproyek, timeline lintas proyek, palet perintah dan pencarian, canvas atau Web Worker, sinkronisasi, kolaborasi, tampilan ponsel.

**Kriteria selesai yang terukur:**

- Berkas `.gan` fiktif berisi 200 tugas terbuka dan tampil di bawah 1 detik.
- Seret dan ubah durasi tidak patah pada 200 tugas; undo/redo bekerja untuk semua suntingan.
- Jalur kritis cocok dengan kasus uji yang dihitung manual.
- Berkas `.rentang` yang disimpan lalu dibuka ulang identik (uji bolak-balik).
- Tidak ada pelanggaran aksesibilitas serius pada cek otomatis; tabel dapat dinavigasi dengan keyboard.
- Demo publik dan repo hanya memuat data fiktif.
- Satu proyek nyata dipakai penuh selama 2 minggu.

## Keputusan teknis

Satu repo, tiga lapisan dengan ketergantungan satu arah (ui ke app ke core), TypeScript strict, dan aplikasi statis tanpa server.

| Keputusan     | Pilihan                                                                               | Alasan                                                                  |
| ------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Aplikasi      | SPA Vite + Svelte 5 + TypeScript strict                                               | Sangat interaktif; React sudah ditunjukkan di proyek lain (ADR 001)     |
| Repo          | Satu paket, folder core, app, ui                                                      | Monorepo menambah beban; batas dijaga lint otomatis                     |
| core          | TypeScript murni, tanpa Svelte, DOM, atau Dexie                                       | Diuji di Node; tidak ada ketergantungan UI                              |
| Tanggal       | String YYYY-MM-DD, tanpa objek Date di core                                           | Bug zona waktu tidak mungkin terjadi                                    |
| State         | Zustand, undo/redo lewat patch Immer                                                  | Ringkas dan mudah diuji                                                 |
| Penjadwalan   | Fungsi murni: dokumen masuk, hasil keluar (tanggal akhir, jalur kritis, siklus)       | Tanggal akhir dihitung, tidak disimpan                                  |
| Gantt         | SVG; modul tata letak murni terpisah; mesin status drag dengan pointer events         | Diuji tanpa browser; aksesibel; canvas baru di atas sekitar 1.000 tugas |
| Penyimpanan   | Antarmuka StorageProvider: berkas lokal (File System Access API), browser saja (demo) | Satu komputer; Google Drive API ditunda                                 |
| Format simpan | Satu proyek = satu berkas JSON `.rentang` dengan schemaVersion dan migrasi            | Seperti draw.io; impor `.gan` tetap terpisah                            |
| Parser .gan   | fast-xml-parser, Zod, model domain, laporan impor                                     | Berjalan sama di Node dan browser                                       |
| Editor        | TipTap, isi disimpan sebagai JSON, dimuat malas                                       | Tidak menulis editor sendiri                                            |
| UI            | Tailwind dan primitif Bits UI; token CSS variables                                    | Aksesibilitas ditangani primitif; relevan di lowongan                   |
| Test          | Vitest (core), Playwright (alur utama), cek aksesibilitas otomatis                    | Kualitas yang bisa ditunjukkan                                          |
| Hosting       | Berkas statis; PWA agar bisa offline                                                  | Murah; tanpa server                                                     |

**Model data.** Project (nama, bidang, kalender, tugas, dependensi, resource, penugasan, dokumen). Task (id, nama, mulai, durasi dalam hari kerja, persen selesai, penanda milestone, induk, urutan, catatan JSON, tautan opsional). Dependency (dari, ke, tipe finish-to-start, lag). Resource dan Assignment. Calendar (hari kerja dan daftar hari libur). Document (judul, isi JSON, urutan). Tanggal akhir tidak pernah disimpan.

**Penyimpanan.** Layar Proyek memakai daftar berkas terakhir dengan ringkasan yang disimpan sementara, jadi angkanya mengikuti berkas yang terakhir dibuka. "Simpan" memeriksa waktu ubah berkas dan memperingatkan jika berkas berubah di luar Rentang. IndexedDB menjadi penyangga pemulihan saat izin berkas terputus.

**Desain.** Acuannya kanvas desain (Contoh Desain Pelacak Gantt): satu aksen amber, netral hangat, warna hanya untuk makna, jalur kritis ditandai tepi tebal, bukan warna saja, dan huruf IBM Plex Sans serta Plex Mono untuk angka.

## Tahap kerja dan titik berhenti

Delapan minggu dalam lima tahap; tiap tahap punya kriteria selesai dan boleh dihentikan di akhirnya.

1. **Tahap 0, minggu 1-2: fondasi dan inti.** Repo, TypeScript strict, lint dengan aturan batas lapisan, CI, token desain, lalu core: model, kalender kerja, penjadwalan, jalur kritis, parser `.gan`, migrasi skema, dan fixture fiktif. Selesai bila: CI hijau (typecheck, lint, test, build); impor `.gan` fiktif lolos test; jalur kritis cocok dengan kasus yang dihitung manual; lint gagal jika core mengimpor UI atau DOM; penjadwalan 200 tugas di bawah 50 ms.
2. **Tahap 1, minggu 3: penampil.** Shell aplikasi dan tema, tabel dan Gantt hanya baca, layar Mulai, laporan impor, penyedia penyimpanan "browser saja". Selesai bila: berkas 200 tugas tampil di bawah 1 detik; tabel dapat dinavigasi dengan keyboard; cek aksesibilitas otomatis lulus. Titik ini sudah bisa dipamerkan.
3. **Tahap 2, minggu 4-5: interaksi (MVP minimum).** Seret dan ubah durasi dengan pratinjau, dependensi, undo/redo, tooltip batang, pesan Urungkan. Selesai bila: semua suntingan bisa diurungkan; seret tetap lancar pada 200 tugas; uji Playwright untuk alur seret dan urungkan lulus. Aturan potong: jika belum selesai di akhir minggu 5, potong item 1 sampai 3 dari daftar potong di atas dan lanjutkan.
4. **Tahap 3, minggu 6-7: berkas, dokumen, proyek.** Penyedia berkas lokal dengan simpan otomatis, deteksi konflik, dan penyangga pemulihan; catatan tugas dan dokumen proyek (TipTap); layar Proyek dengan Bidang; kalender kerja; resource ringan. Selesai bila: uji bolak-balik berkas `.rentang` identik; peringatan konflik muncul saat berkas diubah di luar; dokumen dan tugas saling tertaut; ringkasan proyek benar terhadap kasus uji.
5. **Tahap 4, minggu 8: rilis.** Mode demo berdata fiktif, polesan aksesibilitas, README dan catatan keputusan (ADR), studi kasus untuk portofolio. Selesai bila: semua kriteria MVP terpenuhi, lalu proyek dibekukan.

**Aturan berhenti.** Setelah minggu 8, tidak ada fitur baru apa pun statusnya. Gagasan baru masuk daftar "Nanti", bukan dikerjakan. Pemakaian nyata selama 2 minggu berjalan paralel mulai akhir tahap 3.

## Risiko dan mitigasi

Risiko terbesar bukan teknis, melainkan proyek ini menelan waktu pencarian kerja dan membengkak menjadi tiruan Notion.

| Risiko                                         | Mitigasi                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Proyek menelan waktu pencarian kerja           | Batas 8 minggu, aturan berhenti, daftar "Nanti" untuk gagasan baru                                                                             |
| Gantt interaktif lebih sulit dari perkiraan    | Logika paling berisiko (jadwal, jalur kritis) dibangun dan diuji lebih dulu di core; ada urutan potong                                         |
| Meluas menjadi tiruan Notion                   | Dokumen hanya halaman datar; backlog dan bug dikelola sebagai tugas Gantt                                                                      |
| Kehilangan tulisan yang tidak tergantikan      | Simpan ke berkas di folder Google Drive for Desktop (riwayat revisi Drive), penyangga IndexedDB, peringatan konflik                            |
| Data nyata bocor ke repo atau demo             | Fixture dan demo hanya fiktif; berkas `.gan` dan `.rentang` di luar folder fixtures diabaikan git dan dicek CI; tanpa nama klien atau instansi |
| File System Access API hanya di Chromium       | Cadangan berupa unduh dan unggah; mode demo memakai penyimpanan browser                                                                        |
| Persen selesai diisi manual sehingga data basi | Penanda "terakhir diperbarui" dan pembaruan persen dalam dua ketukan                                                                           |
| Kasus tepi format `.gan`                       | Laporan impor, fixture beragam, dan Rentang tidak pernah menulis balik ke berkas `.gan` asli                                                   |

## Asumsi yang belum dikonfirmasi

Jadwal dan ruang lingkup di atas bergantung pada asumsi berikut; jika salah satunya meleset, bagian terkait perlu dihitung ulang.

- [ ] Tujuan utama adalah alat harian; pamer kepada recruiter menjadi tujuan kedua.
- [ ] Waktu tersedia sekitar 8-10 jam per minggu, dan portofolio tidak harus rilis lebih dulu.
- [ ] "Tugas keuangan" berarti pekerjaan mengembangkan Flowvest sebagai proyek. Tagihan dan target tabungan yang berulang tetap di Flowvest, bukan di Rentang.
- [ ] "Karir" berarti proyek seperti portofolio dan persiapan freelance. Daftar lamaran kerja (mirip kanban) tidak masuk MVP.
- [ ] Google Drive for Desktop terpasang di komputer yang dipakai. Jika tidak, Google Drive API naik ke tahap 3 dan jadwal bertambah sekitar 3-5 hari.
- [ ] Dipakai di satu komputer dengan Chrome atau Edge; ponsel dan perangkat lain tidak dibutuhkan sekarang.
- [ ] Kenyamanan teknis menengah, sehingga bagian graf dan undo/redo dijadwalkan awal.
- [ ] Tulisan lama di Notion tidak diimpor pada MVP; impor Markdown menyusul bila perlu.
- [ ] Berkas GanttProject yang dimaksud berekstensi `.gan`; nama aplikasi Rentang dengan berkas `.rentang`.

## Prompt untuk Claude Code

Aturan kerja, aturan keras, dan perintah proyek dari prompt asli ada di [CLAUDE.md](../CLAUDE.md). Rincian tiap tahap ada di bagian "Tahap kerja" di atas. Test emas Tahap 0 (Proyek Peluncuran Kedai Kopi) ada di `src/core/test-utils/coffee-shop.ts`, beserta test-nya di `src/core/schedule.test.ts` dan `src/core/critical-path.test.ts`.
