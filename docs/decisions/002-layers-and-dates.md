# 002. Lapisan dan aturan tanggal

- **Status:** Diterima
- **Tanggal:** 2026-10-24

## Konteks

Logika paling berisiko (penjadwalan, jalur kritis, impor `.gan`) harus dibangun dan diuji lebih dulu, tanpa browser. Kalau logika itu tercampur dengan UI atau penyimpanan, test-nya lambat dan rapuh. Tanggal di JavaScript (`Date`) membawa jam dan zona waktu, padahal jadwal proyek hanya mengenal hari kalender. Bug klasiknya: tanggal bergeser satu hari tergantung zona waktu pengguna.

## Keputusan

**Tiga lapisan, ketergantungan satu arah.**

| Lapisan    | Isi                                                         | Boleh memakai |
| ---------- | ----------------------------------------------------------- | ------------- |
| `src/core` | Model, kalender, penjadwalan, jalur kritis, migrasi, `.gan` | core saja     |
| `src/app`  | Store, suntingan, riwayat, penyimpanan, demo                | app, core     |
| `src/ui`   | Komponen Svelte dan entri aplikasi (`src/ui/main.ts`)       | ui, app, core |

Penjaganya:

- `eslint-plugin-boundaries`: impor yang melanggar arah di atas gagal lint.
- `no-restricted-imports` di core: `svelte`, `react`, `dexie`, `zustand`, `immer`, dan `@tiptap` dilarang.
- `no-restricted-globals` di core: `window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `indexedDB` dilarang.
- `tsconfig.core.json` hanya memuat `lib: ["ES2023"]` tanpa DOM, sehingga API DOM yang lolos lint tetap gagal typecheck.

**Tanggal adalah string `YYYY-MM-DD`.** Tipenya `IsoDate` (string bermerek) dan dibuat lewat `parseIsoDate` atau `toIsoDate`. Aritmetika ada di `core/dates.ts` dan memakai nomor hari sejak 1970-01-01 (algoritme `days_from_civil` dari Howard Hinnant). Di `src/core`, `new Date`, `Date(...)`, `Date.*`, dan `Intl.DateTimeFormat` dilarang lewat `no-restricted-syntax`. Format tanggal untuk tampilan dilakukan di `ui`.

**Tanggal selesai tidak pernah disimpan.** Task menyimpan mulai yang diminta dan durasi dalam hari kerja. `schedule()` menghitung mulai dan selesai sebenarnya. Aturan penjadwalan:

- Mulai efektif = hari kerja pertama pada atau setelah max(mulai tersimpan, paling awal menurut dependensi).
- Selesai = hari kerja ke-`durasi`, dihitung dari hari mulai.
- Milestone berdurasi 0 dan berada di awal harinya, jadi penerusnya boleh mulai di hari yang sama.
- Dependensi ke atau dari tugas induk diterjemahkan menjadi dependensi antartugas daun. Hasilnya sama persis, karena tugas induk hanya rentang anak-anaknya.
- Siklus dikembalikan sebagai `{ ok: false, error: { type: 'dependency-cycle', taskIds } }`, tidak dilempar.

## Konsekuensi

- core diuji di Node tanpa jsdom; 200 tugas dijadwalkan dan dianalisis dalam beberapa milidetik.
- Tidak ada bug zona waktu di logika jadwal. Satu-satunya tempat yang perlu "hari ini" dari jam sistem adalah `app`, yang menyuntikkannya ke core sebagai `IsoDate`.
- Semua tanggal dari luar (berkas, input) harus divalidasi menjadi `IsoDate` dulu; Zod melakukannya di batas masuk.
- Kalender kerja dihitung hari demi hari. Cukup cepat untuk ratusan tugas; bila ada proyek bertahun-tahun yang terbukti lambat, perhitungan per minggu bisa ditambahkan tanpa mengubah antarmuka.

## Alternatif

- **Pustaka tanggal (date-fns, Temporal polyfill):** tetap berbasis `Date` atau menambah ukuran bundle; kebutuhan kita hanya lima operasi.
- **Menyimpan tanggal selesai:** lebih cepat dibaca, tetapi selalu berisiko tidak sinkron dengan durasi dan kalender.
- **Monorepo dengan paket `core` terpisah:** batas lebih keras, tetapi menambah konfigurasi build; lint dan tsconfig terpisah sudah cukup.
