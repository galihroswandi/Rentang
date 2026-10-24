# 003. Format simpan dan penyimpanan berkas

- **Status:** Diterima (format dan migrasi dibangun di Tahap 0; penyedia penyimpanan di Tahap 1 dan 3)
- **Tanggal:** 2026-10-24

## Konteks

Tulisan dan jadwal harus tetap milik pengguna dan bertahan lebih lama dari aplikasinya. Pengguna memakai satu komputer dengan Chrome atau Edge dan Google Drive for Desktop, yang memberi riwayat revisi gratis untuk berkas biasa. Sumber data awal adalah berkas GanttProject (`.gan`), yang formatnya tidak bisa kita kendalikan.

## Keputusan

**Satu proyek = satu berkas `.rentang`**, berisi JSON `{ schemaVersion, project }` seperti pada `projectFileSchema` di `src/core/model.ts`. Versi saat ini 1.

**Migrasi berurutan.** `src/core/migrations.ts` menyimpan satu fungsi per versi (dari N ke N + 1). `loadProjectFile()` menerapkan semuanya lalu memvalidasi hasilnya dengan Zod. Galatnya terstruktur: bukan objek, tanpa `schemaVersion`, versi lebih baru dari aplikasi, migrasi hilang, atau proyek tidak valid. Berkas dari versi lebih baru ditolak, tidak ditebak.

**`.gan` hanya diimpor, tidak pernah ditulis balik.** `importGan()` menghasilkan proyek dan laporan impor `{ imported, changed, skipped }` berisi kode terstruktur yang dirangkai menjadi kalimat oleh UI. Yang diubah: dependensi selain finish-to-start dijadikan finish-to-start, durasi milestone dijadikan 0, persen selesai dibulatkan. Yang dilewati: baseline, properti kustom, libur berulang, dan referensi yang putus.

**Penyimpanan lewat antarmuka `StorageProvider`** di `src/app/persistence`:

- `browser.ts` (Tahap 1): IndexedDB lewat Dexie, untuk mode demo dan sebelum izin berkas diberikan.
- `file.ts` (Tahap 3): File System Access API dengan simpan otomatis. Sebelum menulis, waktu ubah berkas dibandingkan dengan saat dibuka; kalau berubah di luar Rentang, pengguna diperingatkan. IndexedDB menjadi penyangga pemulihan bila izin berkas terputus.

**Data nyata tidak boleh masuk repo.** `.gitignore` mengabaikan `*.gan` dan `*.rentang` kecuali di `fixtures/`, dan `pnpm check:data-files` di CI gagal bila ada yang lolos.

## Konsekuensi

- Berkas bisa dibaca manusia, di-diff, dan dicadangkan oleh Drive tanpa kode tambahan.
- Setiap perubahan skema wajib disertai migrasi dan test-nya; `migrations.test.ts` memeriksa rantai migrasi tidak berlubang.
- File System Access API hanya ada di Chromium. Browser lain memakai unduh dan unggah sebagai cadangan.
- Mengimpor `.gan` bersifat lossy secara sengaja; laporan impor membuat kehilangan itu terlihat.

## Alternatif

- **IndexedDB sebagai sumber utama:** tidak perlu izin berkas, tetapi data terkunci di profil browser dan mudah hilang saat data situs dibersihkan.
- **Menulis balik ke `.gan`:** pengguna bisa kembali ke GanttProject, tetapi berisiko merusak berkas asli karena modelnya tidak setara.
- **Satu berkas untuk semua proyek:** satu tempat saja, tetapi konflik dan kerusakan berdampak ke semua proyek.
- **Google Drive API:** sinkron lintas perangkat, tetapi butuh OAuth dan ditunda setelah MVP.
