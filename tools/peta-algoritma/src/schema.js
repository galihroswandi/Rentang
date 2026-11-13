// The shape of a map file, written once and used twice: to validate files (with readable
// paths in every message) and to emit a JSON Schema that editors use for autocompletion.

/** @typedef {{ kind: string, [key: string]: any }} Schema */

const definitions = new Map()

export const s = {
  string: (description = '', extra = {}) => ({ kind: 'string', description, ...extra }),
  integer: (description = '', extra = {}) => ({ kind: 'integer', description, ...extra }),
  boolean: (description = '') => ({ kind: 'boolean', description }),
  enum: (values, description = '') => ({ kind: 'enum', values, description }),
  array: (items, description = '', extra = {}) => ({ kind: 'array', items, description, ...extra }),
  record: (values, description = '') => ({ kind: 'record', values, description }),
  /** Every key is optional unless listed in `required`; unknown keys are refused. */
  object: (properties, required = [], description = '') => ({
    kind: 'object',
    properties,
    required,
    description,
  }),
  /** The first alternative whose `when` matches is used to validate the value. */
  union: (alternatives, description = '') => ({ kind: 'union', alternatives, description }),
  ref: (name) => ({ kind: 'ref', name }),
}

/** Registers a named schema so it can refer to itself (steps contain steps). */
export function define(name, schema) {
  definitions.set(name, schema)
  return s.ref(name)
}

const resolve = (schema) => (schema.kind === 'ref' ? definitions.get(schema.name) : schema)

const typeOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value)

/**
 * Checks `value` against `schema`. Returns a list of { path, message } where path is like
 * `modules[3].algorithms[0].steps[2]`.
 */
export function validate(schema, value, path = '') {
  const issues = []
  check(resolve(schema), value, path, issues)
  return issues
}

function check(schema, value, path, issues) {
  const where = path || '(root)'
  switch (schema.kind) {
    case 'ref':
      return check(resolve(schema), value, path, issues)
    case 'string':
      if (typeof value !== 'string') return issues.push({ path: where, message: 'string' })
      if (schema.minLength && value.trim().length < schema.minLength)
        return issues.push({ path: where, message: 'empty' })
      if (schema.pattern && !new RegExp(schema.pattern).test(value))
        return issues.push({ path: where, message: `pattern:${schema.pattern}` })
      return
    case 'integer':
      if (!Number.isInteger(value)) return issues.push({ path: where, message: 'integer' })
      if (schema.minimum !== undefined && value < schema.minimum)
        return issues.push({ path: where, message: `minimum:${schema.minimum}` })
      return
    case 'boolean':
      if (typeof value !== 'boolean') issues.push({ path: where, message: 'boolean' })
      return
    case 'enum':
      if (!schema.values.includes(value))
        issues.push({ path: where, message: `enum:${schema.values.join('|')}` })
      return
    case 'array':
      if (!Array.isArray(value)) return issues.push({ path: where, message: 'array' })
      if (schema.minItems && value.length < schema.minItems)
        issues.push({ path: where, message: `minItems:${schema.minItems}` })
      value.forEach((item, index) =>
        check(resolve(schema.items), item, `${path}[${index}]`, issues),
      )
      return
    case 'record':
      if (typeOf(value) !== 'object') return issues.push({ path: where, message: 'object' })
      for (const [key, item] of Object.entries(value))
        check(resolve(schema.values), item, `${path}.${key}`, issues)
      return
    case 'object': {
      if (typeOf(value) !== 'object') return issues.push({ path: where, message: 'object' })
      for (const key of schema.required) {
        if (!(key in value)) issues.push({ path: join(path, key), message: 'required' })
      }
      for (const [key, item] of Object.entries(value)) {
        if (key === '$schema' || key === '$comment') continue
        const property = schema.properties[key]
        if (!property) issues.push({ path: join(path, key), message: 'unknown-key' })
        else check(resolve(property), item, join(path, key), issues)
      }
      return
    }
    case 'union': {
      const match = schema.alternatives.find((alternative) => alternative.when(value))
      if (!match) return issues.push({ path: where, message: 'union' })
      return check(resolve(match.schema), value, path, issues)
    }
    default:
      throw new Error(`Unknown schema kind ${schema.kind}`)
  }
}

const join = (path, key) => (path ? `${path}.${key}` : key)

/** JSON Schema (draft 2020-12) for editors. */
export function toJsonSchema(root, title) {
  const $defs = {}
  for (const [name, schema] of definitions) $defs[name] = emit(schema)
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title,
    ...emit(root),
    $defs,
  }
}

function emit(schema) {
  const base = schema.description ? { description: schema.description } : {}
  switch (schema.kind) {
    case 'ref':
      return { $ref: `#/$defs/${schema.name}` }
    case 'string':
      return {
        ...base,
        type: 'string',
        ...(schema.minLength ? { minLength: schema.minLength } : {}),
        ...(schema.pattern ? { pattern: schema.pattern } : {}),
      }
    case 'integer':
      return {
        ...base,
        type: 'integer',
        ...(schema.minimum !== undefined ? { minimum: schema.minimum } : {}),
      }
    case 'boolean':
      return { ...base, type: 'boolean' }
    case 'enum':
      return { ...base, enum: schema.values }
    case 'array':
      return {
        ...base,
        type: 'array',
        items: emit(schema.items),
        ...(schema.minItems ? { minItems: schema.minItems } : {}),
      }
    case 'record':
      return { ...base, type: 'object', additionalProperties: emit(schema.values) }
    case 'object':
      return {
        ...base,
        type: 'object',
        properties: {
          $schema: { type: 'string' },
          $comment: { type: 'string' },
          ...Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [key, emit(value)]),
          ),
        },
        ...(schema.required.length > 0 ? { required: schema.required } : {}),
        additionalProperties: false,
      }
    case 'union':
      return { ...base, anyOf: schema.alternatives.map((alternative) => emit(alternative.schema)) }
    default:
      throw new Error(`Unknown schema kind ${schema.kind}`)
  }
}

// ---------------------------------------------------------------------------------------
// The map file format. Every file (the entry config and the files it includes) uses the
// same shape; required fields are checked again after the files are merged.

const id = (description) => s.string(description, { pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' })
const text = (description) => s.string(description, { minLength: 1 })
const texts = (description) => s.array(text(''), description)
const isObjectWith = (key) => (value) => typeOf(value) === 'object' && key in value

const step = define(
  'step',
  s.union(
    [
      { when: (value) => typeof value === 'string', schema: text('Langkah (aksi) biasa.') },
      {
        when: isObjectWith('do'),
        schema: s.object(
          { do: text('Aksi.'), code: text('Simbol kode yang menjalankan aksi ini.') },
          ['do'],
        ),
      },
      {
        when: isObjectWith('stop'),
        schema: s.object(
          { stop: text('Aksi terakhir; alur berhenti di sini.'), code: text('Simbol kode.') },
          ['stop'],
        ),
      },
      {
        when: isObjectWith('if'),
        schema: s.object(
          {
            if: text('Pertanyaan atau kondisi keputusan.'),
            then: s.array(s.ref('step'), 'Langkah bila kondisi benar.'),
            else: s.array(s.ref('step'), 'Langkah bila kondisi salah (opsional).'),
            yes: text('Label penjaga untuk cabang benar, mis. "ada siklus".'),
            no: text('Label penjaga untuk cabang salah.'),
          },
          ['if', 'then'],
        ),
      },
      {
        when: isObjectWith('loop'),
        schema: s.object(
          {
            loop: text('Kondisi perulangan, mis. "masih ada tugas berikutnya?".'),
            body: s.array(s.ref('step'), 'Isi perulangan.', { minItems: 1 }),
            next: text('Label penjaga untuk lanjut.'),
            done: text('Label penjaga untuk selesai.'),
          },
          ['loop', 'body'],
        ),
      },
    ],
    'Satu langkah diagram aktivitas UML.',
  ),
)

const message = define(
  'message',
  s.union(
    [
      {
        when: isObjectWith('fragment'),
        schema: s.object(
          {
            fragment: s.enum(['alt', 'opt', 'loop', 'par'], 'Jenis combined fragment UML.'),
            label: text('Penjaga, mis. "berkas .gan".'),
            messages: s.array(s.ref('message'), '', { minItems: 1 }),
            else: s.array(
              s.object(
                {
                  label: text('Penjaga operan berikutnya.'),
                  messages: s.array(s.ref('message'), '', { minItems: 1 }),
                },
                ['label', 'messages'],
              ),
              'Operan lain (hanya untuk alt dan par).',
            ),
          },
          ['fragment', 'label', 'messages'],
        ),
      },
      {
        when: (value) => typeOf(value) === 'object',
        schema: s.object(
          {
            from: text('Pengirim: id modul atau id aktor.'),
            to: text('Penerima: id modul atau id aktor.'),
            text: text('Label pesan, mis. "resolveDrag(input)".'),
            kind: s.enum(['call', 'async', 'return', 'create'], 'Jenis pesan; bawaan "call".'),
            code: text('Simbol kode yang dipanggil (dicari di penerima, lalu pengirim).'),
            note: text('Penjelasan langkah untuk daftar di samping diagram.'),
          },
          ['from', 'to', 'text'],
        ),
      },
    ],
    'Pesan diagram urutan UML atau combined fragment.',
  ),
)

const algorithm = s.object(
  {
    id: id('Id unik di dalam modul (untuk tautan).'),
    name: text('Nama algoritma.'),
    summary: text('Satu kalimat: apa yang dilakukan.'),
    symbols: texts('Simbol kode utama (fungsi, metode, konstanta).'),
    input: text('Masukan.'),
    output: text('Keluaran.'),
    steps: s.array(step, 'Cara kerja, dirender sebagai diagram aktivitas UML.'),
    examples: s.array(
      s.object({ given: text('Masukan contoh.'), result: text('Hasil.'), note: text('Catatan.') }, [
        'given',
        'result',
      ]),
      'Contoh masukan dan hasil.',
    ),
    rules: texts('Aturan (invarian) yang dijaga.'),
    pitfalls: texts('Jebakan yang sering membuat bug.'),
    complexity: text('Kompleksitas waktu atau ruang.'),
  },
  ['id', 'name', 'summary'],
)

const module = s.object(
  {
    id: id('Id unik modul.'),
    group: id('Id grup tempat modul ini tampil.'),
    name: text('Nama modul.'),
    summary: text('Satu kalimat untuk kartu di peta.'),
    description: text('Penjelasan peran modul.'),
    files: s.array(text(''), 'Berkas modul; yang pertama adalah berkas utama.', { minItems: 1 }),
    tests: texts('Berkas test yang menguji modul ini.'),
    rules: texts('Aturan (invarian) modul.'),
    pitfalls: texts('Jebakan di modul ini.'),
    diagrams: s.array(id(''), 'Id diagram kelas atau status yang menjelaskan modul ini.'),
    algorithms: s.array(algorithm, 'Algoritma di dalam modul.'),
  },
  ['id', 'group', 'name', 'summary', 'files'],
)

const diagramNode = s.object(
  {
    id: text('Id simpul di dalam diagram.'),
    name: text('Nama yang ditampilkan.'),
    kind: s.enum(['class', 'state', 'initial', 'final', 'choice', 'note'], 'Bentuk simpul.'),
    col: s.integer('Kolom (mulai dari 1).', { minimum: 1 }),
    row: s.integer('Baris (mulai dari 1).', { minimum: 1 }),
    stereotype: text('Stereotip, mis. "dihitung".'),
    attributes: texts('Atribut kelas, mis. "start: IsoDate".'),
    operations: texts('Operasi kelas.'),
    text: texts('Baris teks tambahan (aktivitas status atau isi catatan).'),
  },
  ['id', 'col', 'row'],
)

const diagramEdge = s.object(
  {
    from: text('Id simpul asal.'),
    to: text('Id simpul tujuan.'),
    kind: s.enum(
      [
        'association',
        'navigable',
        'composition',
        'aggregation',
        'generalization',
        'dependency',
        'realization',
        'transition',
        'anchor',
      ],
      'Jenis relasi UML.',
    ),
    label: text('Label di tengah garis.'),
    fromLabel: text('Label di ujung asal (multiplisitas atau peran).'),
    toLabel: text('Label di ujung tujuan.'),
  },
  ['from', 'to'],
)

const diagram = s.object(
  {
    id: id('Id unik diagram.'),
    type: s.enum(['class', 'state'], 'Jenis diagram UML.'),
    name: text('Judul diagram.'),
    summary: text('Penjelasan singkat.'),
    nodes: s.array(diagramNode, '', { minItems: 1 }),
    edges: s.array(diagramEdge, ''),
  },
  ['id', 'type', 'name', 'nodes'],
)

const flow = s.object(
  {
    id: id('Id unik alur.'),
    name: text('Nama alur (use case), mis. "Menyeret bar di Gantt".'),
    category: id('Id kategori untuk mengelompokkan use case.'),
    summary: text('Ringkasan alur.'),
    trigger: text('Pemicu atau prasyarat.'),
    result: text('Hasil akhir yang terlihat.'),
    actors: s.array(
      s.object(
        {
          id: id('Id aktor.'),
          name: text('Nama aktor.'),
          type: s.enum(['actor', 'database', 'system'], 'Bentuk lifeline.'),
        },
        ['id', 'name'],
      ),
      'Peserta yang bukan modul: pengguna, basis data, sistem luar.',
    ),
    participants: s.array(text(''), 'Urutan lifeline (opsional).'),
    messages: s.array(message, 'Pesan berurutan.', { minItems: 1 }),
  },
  ['id', 'name', 'summary', 'messages'],
)

const symptom = s.object(
  {
    id: id('Id unik gejala.'),
    category: id('Id kategori.'),
    title: text('Gejala seperti yang dilihat developer.'),
    checks: s.array(
      s.object(
        {
          module: id('Modul yang diperiksa.'),
          code: text('Simbol kode yang dicurigai.'),
          why: text('Kenapa dicurigai.'),
        },
        ['module', 'why'],
      ),
      'Tersangka, urut dari yang paling mungkin.',
      { minItems: 1 },
    ),
    verify: text('Cara memastikan, mis. perintah test.'),
    tip: text('Saran tambahan.'),
  },
  ['id', 'title', 'checks'],
)

export const fileSchema = s.object(
  {
    title: text('Judul peta.'),
    system: text('Nama sistem, dipakai sebagai batas diagram use case.'),
    description: text('Paragraf pembuka di halaman Mulai.'),
    language: s.enum(['id', 'en'], 'Bahasa antarmuka peta.'),
    root: text('Akar proyek, relatif terhadap berkas ini.'),
    output: text('Berkas HTML hasil, relatif terhadap akar proyek.'),
    editor: s.enum(['vscode', 'cursor', 'idea', 'none'], 'Editor bawaan untuk membuka kode.'),
    repository: s.object(
      { url: text('URL repositori GitHub.'), branch: text('Cabang untuk tautan.') },
      ['url'],
      'Repositori untuk tautan "buka di GitHub". Terbaca dari git bila kosong.',
    ),
    include: texts('Berkas peta lain yang digabungkan, relatif terhadap berkas ini.'),
    coverage: s.object(
      {
        include: texts('Glob berkas yang wajib terpetakan, mis. "src/**/*.ts".'),
        exclude: texts('Glob yang dikecualikan, mis. "**/*.test.ts".'),
      },
      ['include'],
    ),
    resolve: s.object({ alias: s.record(s.string(), 'Alias impor, mis. { "@/": "src/" }.') }, []),
    rules: s.object(
      {
        layers: s.enum(['error', 'warn', 'off'], 'Impor yang melanggar arah lapisan.'),
        exports: s.enum(['error', 'warn', 'off'], 'Fungsi ekspor yang belum dijelaskan.'),
      },
      [],
    ),
    layers: s.array(
      s.object(
        {
          id: id('Id lapisan.'),
          name: text('Nama lapisan.'),
          summary: text('Tanggung jawab lapisan.'),
          color: s.string('Warna CSS lapisan.'),
          mayUse: s.array(id(''), 'Lapisan yang boleh dipakai (termasuk dirinya).'),
        },
        ['id', 'name', 'summary'],
      ),
      'Lapisan arsitektur, dari atas ke bawah.',
    ),
    groups: s.array(
      s.object({ id: id(''), layer: id(''), name: text(''), summary: text('') }, [
        'id',
        'layer',
        'name',
      ]),
      'Grup modul di dalam lapisan.',
    ),
    modules: s.array(module, 'Modul (komponen UML) beserta algoritmanya.'),
    flows: s.array(flow, 'Alur (use case) yang digambar sebagai diagram urutan.'),
    diagrams: s.array(diagram, 'Diagram kelas dan diagram status.'),
    categories: s.array(
      s.object({ id: id(''), name: text(''), summary: text('') }, ['id', 'name']),
      'Kategori untuk alur dan gejala.',
    ),
    symptoms: s.array(symptom, 'Gejala masalah dan tempat memeriksanya.'),
    glossary: s.array(
      s.object({ term: text(''), definition: text(''), modules: s.array(id(''), '') }, [
        'term',
        'definition',
      ]),
      'Istilah.',
    ),
    overview: s.object(
      {
        intro: text('Pengantar.'),
        principles: s.array(
          s.object({ title: text(''), text: text('') }, ['title', 'text']),
          'Aturan emas.',
        ),
        pipeline: s.array(
          s.object({ module: id(''), caption: text('') }, ['module', 'caption']),
          'Jalur data utama.',
        ),
        readingOrder: s.array(id(''), 'Urutan baca modul untuk developer baru.'),
      },
      [],
    ),
    ignore: s.array(
      s.object({ file: text(''), reason: text('') }, ['file', 'reason']),
      'Berkas dalam cakupan yang sengaja tidak dipetakan, beserta alasannya.',
    ),
  },
  [],
)

export const REQUIRED_AFTER_MERGE = ['title', 'layers', 'modules']
