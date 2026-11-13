// Human sentences for every issue code, in Indonesian and English.

const id = {
  'file-missing': () => 'berkas tidak ditemukan',
  json: (detail) => `JSON tidak valid: ${detail}`,
  'duplicate-key': () =>
    'kunci ini sudah ada di berkas lain; kunci tunggal hanya boleh di satu berkas',
  string: () => 'harus berupa teks',
  empty: () => 'tidak boleh kosong',
  pattern: () => 'harus kebab-case, mis. "jalur-kritis"',
  integer: () => 'harus bilangan bulat',
  minimum: (value) => `minimal ${value}`,
  boolean: () => 'harus true atau false',
  enum: (values) => `harus salah satu dari: ${values.split('|').join(', ')}`,
  array: () => 'harus berupa daftar',
  minItems: (value) => `minimal ${value} isi`,
  object: () => 'harus berupa objek',
  required: () => 'wajib diisi',
  'unknown-key': () => 'kunci tidak dikenal (salah ketik?)',
  union: () => 'bentuknya tidak dikenali',
  duplicate: (kind, value) => `${kind} "${value}" ganda`,
  'unknown-ref': (kind, value) => `${kind} "${value}" tidak ada`,
  'missing-file': (file) => `berkas tidak ada: ${file}`,
  'unmapped-file': (file) =>
    `berkas belum ada di peta: ${file} (masukkan ke files sebuah modul, atau ke ignore beserta alasannya)`,
  'ignore-unused': (file) => `ignore menyebut ${file}, tetapi berkas itu tidak termasuk cakupan`,
  'symbol-missing': (name, where) => `simbol "${name}" tidak ditemukan di ${where}`,
  'symbol-inexact': (name, file) =>
    `simbol "${name}" di ${file} hanya cocok sebagai kata biasa, bukan deklarasi`,
  'layer-violation': (from, fromLayer, to, toLayer, file) =>
    `${from} (${fromLayer}) memakai ${to} (${toLayer}) lewat impor di ${file}: melanggar arah lapisan`,
  'export-unexplained': (name, file) =>
    `fungsi ekspor "${name}" di ${file} belum dijelaskan di algoritma mana pun`,
  'actor-needs-module': (flow) => `alur ${flow}: pesan antar-aktor tidak bisa punya "code"`,
  'step-after-stop': () => 'ada langkah setelah "stop"; langkah itu tidak akan pernah dijalankan',
  ok: (modules, algorithms, flows, diagrams, files) =>
    `OK: peta cocok dengan kode (${modules} modul, ${algorithms} algoritma, ${flows} alur, ${diagrams} diagram, ${files} berkas terpetakan).`,
  failed: (count) => `Peta tidak cocok dengan kode (${count} masalah):`,
  warnings: (count) => `${count} peringatan:`,
  built: (path) => `Peta dibuat: ${path}`,
  serving: (url) => `Peta berjalan di ${url} (diperbarui otomatis saat berkas berubah).`,
  rebuilt: () => 'Peta diperbarui.',
  usage: () => `Pemakaian: peta <perintah> [opsi]

Perintah:
  check    Memeriksa peta terhadap kode (untuk CI)
  build    Membuat halaman HTML peta
  dev      Menjalankan peta di browser dan memperbaruinya saat berkas berubah
  schema   Menulis JSON Schema berkas peta ke stdout

Opsi:
  --config <berkas>  Berkas peta (bawaan: peta.config.json)
  --strict           Peringatan dianggap galat
  --out <berkas>     Lokasi HTML (menimpa "output" di konfigurasi)
  --public           Tanpa path lokal; tautan kode hanya ke GitHub
  --port <nomor>     Port untuk dev (bawaan: 4319)`,
}

const en = {
  'file-missing': () => 'file not found',
  json: (detail) => `invalid JSON: ${detail}`,
  'duplicate-key': () =>
    'this key is already set in another file; single keys may appear in one file only',
  string: () => 'must be text',
  empty: () => 'must not be empty',
  pattern: () => 'must be kebab-case, e.g. "critical-path"',
  integer: () => 'must be an integer',
  minimum: (value) => `at least ${value}`,
  boolean: () => 'must be true or false',
  enum: (values) => `must be one of: ${values.split('|').join(', ')}`,
  array: () => 'must be a list',
  minItems: (value) => `needs at least ${value} items`,
  object: () => 'must be an object',
  required: () => 'is required',
  'unknown-key': () => 'unknown key (typo?)',
  union: () => 'shape not recognised',
  duplicate: (kind, value) => `duplicate ${kind} "${value}"`,
  'unknown-ref': (kind, value) => `${kind} "${value}" does not exist`,
  'missing-file': (file) => `missing file: ${file}`,
  'unmapped-file': (file) =>
    `file not on the map: ${file} (add it to a module's files, or to ignore with a reason)`,
  'ignore-unused': (file) => `ignore lists ${file}, which is not in coverage`,
  'symbol-missing': (name, where) => `symbol "${name}" not found in ${where}`,
  'symbol-inexact': (name, file) => `symbol "${name}" in ${file} only matched as a plain word`,
  'layer-violation': (from, fromLayer, to, toLayer, file) =>
    `${from} (${fromLayer}) uses ${to} (${toLayer}) through an import in ${file}: wrong layer direction`,
  'export-unexplained': (name, file) =>
    `exported function "${name}" in ${file} is not explained by any algorithm`,
  'actor-needs-module': (flow) => `flow ${flow}: a message between actors cannot have "code"`,
  'step-after-stop': () => 'steps after "stop" can never run',
  ok: (modules, algorithms, flows, diagrams, files) =>
    `OK: the map matches the code (${modules} modules, ${algorithms} algorithms, ${flows} flows, ${diagrams} diagrams, ${files} files mapped).`,
  failed: (count) => `The map does not match the code (${count} problems):`,
  warnings: (count) => `${count} warnings:`,
  built: (path) => `Map written: ${path}`,
  serving: (url) => `Map running at ${url} (rebuilds when files change).`,
  rebuilt: () => 'Map rebuilt.',
  usage: () => `Usage: peta <command> [options]

Commands:
  check    Check the map against the code (for CI)
  build    Write the map as one HTML page
  dev      Serve the map and rebuild it when files change
  schema   Print the JSON Schema of map files

Options:
  --config <file>  Map file (default: peta.config.json)
  --strict         Treat warnings as errors
  --out <file>     HTML location (overrides "output")
  --public         No local paths; code links go to GitHub only
  --port <number>  Port for dev (default: 4319)`,
}

const tables = { id, en }

/** `code` may carry arguments after a colon, as schema issues do ("minimum:1"). */
export function say(language, code, ...args) {
  const table = tables[language] ?? id
  const [name, detail] = code.includes(':')
    ? [code.slice(0, code.indexOf(':')), code.slice(code.indexOf(':') + 1)]
    : [code, undefined]
  const make = table[name]
  if (!make) return code
  return detail === undefined ? make(...args) : make(detail, ...args)
}
