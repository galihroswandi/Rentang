# peta-algoritma

Peta algoritma interaktif untuk sebuah basis kode: setiap modul, algoritma, dan alur dijelaskan dengan diagram UML standar, setiap kotak bisa diklik untuk membuka kodenya tepat di barisnya, dan seluruh peta diperiksa terhadap kode supaya tidak pernah usang.

- **Tanpa dependensi.** Node.js 20+ saja. Hasilnya satu berkas HTML mandiri yang bisa dibuka langsung dari disk atau dihosting.
- **Diagram UML yang dirender sendiri (SVG):** use case, urutan (sequence), komponen/paket, aktivitas, kelas, dan status.
- **Diperiksa di CI:** berkas, simbol, rujukan, arah lapisan, cakupan berkas, dan fungsi ekspor yang belum dijelaskan.
- **Relasi otomatis:** siapa memakai siapa dihitung dari impor kode, bukan ditulis tangan.
- **Untuk developer baru:** halaman Mulai (arsitektur, aturan emas, rute belajar), pencarian global, indeks gejala ("Ada masalah?"), istilah, dan indeks berkas.

## Pemakaian

```bash
node tools/peta-algoritma/bin/peta.js dev    --config docs/peta/peta.config.json   # buka di browser, diperbarui otomatis
node tools/peta-algoritma/bin/peta.js check  --config docs/peta/peta.config.json   # untuk CI
node tools/peta-algoritma/bin/peta.js build  --config docs/peta/peta.config.json   # tulis HTML
node tools/peta-algoritma/bin/peta.js schema > tools/peta-algoritma/schema.json   # JSON Schema untuk editor
```

| Opsi              | Fungsi                                                          |
| ----------------- | --------------------------------------------------------------- |
| `--config <file>` | Berkas peta utama (bawaan `peta.config.json` di folder kerja)   |
| `--strict`        | Peringatan dianggap galat (mis. fungsi ekspor belum dijelaskan) |
| `--out <file>`    | Lokasi HTML, menimpa `output` di konfigurasi                    |
| `--public`        | Tanpa path lokal; tautan kode hanya ke GitHub (untuk dihosting) |
| `--port <nomor>`  | Port untuk `dev` (bawaan 4319)                                  |

Dipakai dari kode: `import { analyze, renderHtml } from 'peta-algoritma'`.

## Memakai di proyek lain

Alat ini tidak mengimpor apa pun dari proyek yang dipetakan. Untuk memakainya di proyek lain:

1. Salin folder `tools/peta-algoritma/` (atau pisahkan dengan `git subtree split --prefix tools/peta-algoritma`, lalu pasang dari repo itu sebagai devDependency).
2. Buat `peta.config.json` dan berkas-berkas isinya (lihat format di bawah). Tambahkan `"$schema"` yang menunjuk ke `schema.json` supaya editor memberi autocomplete dan validasi.
3. Jalankan `peta check` di CI dan `peta dev` saat menulis peta.

## Format peta

Berkas utama boleh memecah isinya ke beberapa berkas lewat `include`. Semua berkas memakai skema yang sama; daftar (`modules`, `flows`, ...) digabungkan.

```jsonc
{
  "$schema": "../../tools/peta-algoritma/schema.json",
  "title": "Peta algoritma Contoh",
  "system": "Contoh", // nama di batas diagram use case
  "language": "id", // id | en
  "root": "../..", // akar proyek, relatif terhadap berkas ini
  "output": "dist-peta/index.html",
  "editor": "vscode", // vscode | cursor | idea | none
  "repository": { "url": "https://github.com/pemilik/repo", "branch": "main" },
  "include": ["core.json", "alur.json"],
  "coverage": { "include": ["src/**/*.ts", "src/**/*.svelte"], "exclude": ["**/*.test.ts"] },
  "rules": { "layers": "error", "exports": "warn" },
  "layers": [
    { "id": "ui", "name": "UI", "summary": "…", "color": "#7c5cc4", "mayUse": ["ui", "core"] },
    { "id": "core", "name": "Core", "summary": "…", "mayUse": ["core"] },
  ],
  "groups": [{ "id": "hitung", "layer": "core", "name": "Hitungan" }],
  "ignore": [{ "file": "src/test-setup.ts", "reason": "Penyiapan test." }],
}
```

### Modul dan algoritma (diagram aktivitas)

```jsonc
{
  "id": "jadwal",
  "group": "hitung",
  "name": "Penjadwalan",
  "summary": "Satu kalimat untuk kartu.",
  "description": "Peran modul.",
  "files": ["src/core/schedule.ts"],
  "tests": ["src/core/schedule.test.ts"],
  "rules": ["Invarian modul"],
  "pitfalls": ["Jebakan"],
  "diagrams": ["model-data"],
  "algorithms": [
    {
      "id": "maju",
      "name": "Forward pass",
      "summary": "…",
      "symbols": ["schedule"], // simbol yang diklik ke kodenya
      "input": "…",
      "output": "…",
      "steps": [
        "Aksi biasa",
        { "do": "Aksi dengan kode", "code": "buildGraph" },
        { "if": "Ada siklus?", "then": [{ "stop": "Kembalikan galat" }] },
        { "if": "Milestone?", "then": ["…"], "else": ["…"], "yes": "ya", "no": "tidak" },
        { "loop": "Masih ada tugas?", "body": ["…"], "next": "berikutnya", "done": "selesai" },
        { "stop": "Kembalikan hasil", "code": "scheduleGraph" },
      ],
      "examples": [{ "given": "…", "result": "…", "note": "…" }],
      "rules": ["…"],
      "pitfalls": ["…"],
      "complexity": "O(V + E)",
    },
  ],
}
```

`steps` dirender sebagai diagram aktivitas UML: titik awal, aksi, keputusan dengan penjaga, perulangan dengan panah balik, dan titik akhir. `stop` mengakhiri cabangnya.

### Alur (diagram use case + urutan)

```jsonc
{
  "id": "seret-bar",
  "name": "Menyeret bar",
  "category": "gantt",
  "summary": "…",
  "trigger": "…",
  "result": "…",
  "actors": [
    { "id": "pengguna", "name": "Pengguna", "type": "actor" },
    { "id": "db", "name": "IndexedDB", "type": "database" },
  ],
  "messages": [
    { "from": "pengguna", "to": "chart", "text": "tekan bar" },
    {
      "from": "chart",
      "to": "drag",
      "text": "resolveDrag(input)",
      "code": "resolveDrag",
      "note": "Penjelasan langkah.",
    },
    { "from": "drag", "to": "chart", "text": "DragResult", "kind": "return" },
    {
      "fragment": "alt",
      "label": "valid",
      "messages": [/* … */],
      "else": [{ "label": "tidak valid", "messages": [/* … */] }],
    },
  ],
}
```

`kind`: `call` (bawaan, panah penuh), `async` (ujung terbuka), `return` (putus-putus), `create`. Fragmen: `alt`, `opt`, `loop`, `par`. `code` dicari di modul penerima, lalu pengirim.

### Diagram kelas dan status

```jsonc
{
  "id": "model-data",
  "type": "class",
  "name": "Model data",
  "nodes": [
    { "id": "proyek", "name": "Project", "col": 1, "row": 1, "attributes": ["id: string"] },
    {
      "id": "tugas",
      "name": "Task",
      "col": 2,
      "row": 1,
      "stereotype": "dihitung",
      "attributes": ["start: IsoDate"],
    },
    { "id": "catatan", "kind": "note", "col": 2, "row": 2, "text": ["Catatan UML"] },
  ],
  "edges": [
    { "from": "proyek", "to": "tugas", "kind": "composition", "toLabel": "0..*", "label": "tasks" },
  ],
}
```

Simpul diletakkan di grid (`col`, `row`). Jenis relasi: `association`, `navigable`, `composition`, `aggregation`, `generalization`, `dependency`, `realization`, `anchor` (ke catatan), dan `transition` untuk diagram status (`kind` simpul: `state`, `initial`, `final`, `choice`, `note`).

### Gejala, istilah, dan halaman Mulai

```jsonc
"symptoms": [{ "id": "tanggal-salah", "category": "jadwal", "title": "Tanggal selesai salah",
  "checks": [{ "module": "jadwal", "code": "endOf", "why": "…" }], "verify": "pnpm vitest run …", "tip": "…" }],
"glossary": [{ "term": "Float", "definition": "…", "modules": ["jadwal"] }],
"categories": [{ "id": "jadwal", "name": "Tugas & jadwal" }],
"overview": { "intro": "…", "principles": [{ "title": "…", "text": "…" }],
  "pipeline": [{ "module": "model", "caption": "…" }], "readingOrder": ["dates", "calendar"] }
```

## Yang diperiksa `check`

- Bentuk setiap berkas peta (dengan nama berkas dan path di setiap pesan) dan id yang unik.
- Rujukan: grup, lapisan, modul, diagram, kategori, peserta alur, simpul diagram.
- Berkas modul dan test ada; setiap berkas di `coverage` masuk ke sebuah modul atau ke `ignore` beserta alasannya.
- Setiap simbol (`symbols`, `code`) ditemukan di berkas modulnya; deklarasi didahulukan, kata biasa hanya untuk komponen.
- Impor tidak melanggar `mayUse` lapisan (`rules.layers`).
- Fungsi yang diekspor dijelaskan oleh sebuah algoritma, alur, atau gejala (`rules.exports`; `--strict` menjadikannya galat).

## Batasan

- Simbol, impor, dan ekspor dibaca dengan pola teks, bukan parser. Pola ini mencakup gaya TypeScript, JavaScript, Svelte, dan Vue yang umum; kasus aneh (deklarasi di dalam string, impor dibangun dinamis) tidak terbaca.
- Isi penjelasan ditulis tangan. Pemeriksaan menjamin rujukannya benar, bukan kebenaran penjelasannya.
- Tata letak diagram kelas dan status mengikuti grid yang ditulis penulis peta.

## Pengembangan

```bash
node --test "tools/peta-algoritma/test/*.test.js"
node tools/peta-algoritma/bin/peta.js schema > tools/peta-algoritma/schema.json
```

Penampil adalah JavaScript tanpa kerangka di `viewer/js/` (digabung menurut urutan nama berkas) dan CSS di `viewer/css/`.
