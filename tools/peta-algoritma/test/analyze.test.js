import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { analyze } from '../src/analyze.js'
import { renderHtml } from '../src/build.js'

/** A tiny project on disk: core math used by a UI view and a Svelte widget. */
function fixture(overrides = {}, extraFiles = {}) {
  const root = mkdtempSync(join(tmpdir(), 'peta-fixture-'))
  const files = {
    'src/core/math.ts':
      '/** Adds two numbers. */\nexport function add(a: number, b: number): number {\n  return a + b\n}\n\nexport const double = (x: number): number => add(x, x)\n',
    'src/ui/view.ts':
      "import { add } from '../core/math.ts'\nimport { z } from 'zod'\n\nexport function render(): number {\n  return add(1, 2)\n}\n",
    'src/ui/Widget.svelte':
      '<script lang="ts">\n  import { double } from \'../core/math.ts\'\n  let count = $state(0)\n</script>\n<button onclick={() => (count = double(count))}>{count}</button>\n',
    ...extraFiles,
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  const config = {
    title: 'Peta contoh',
    coverage: { include: ['src/**/*.ts', 'src/**/*.svelte'] },
    layers: [
      { id: 'ui', name: 'UI', summary: 'Tampilan.', mayUse: ['ui', 'core'] },
      { id: 'core', name: 'Core', summary: 'Logika.', mayUse: ['core'] },
    ],
    groups: [
      { id: 'g-ui', layer: 'ui', name: 'Tampilan' },
      { id: 'g-core', layer: 'core', name: 'Hitung' },
    ],
    modules: [
      {
        id: 'math',
        group: 'g-core',
        name: 'Matematika',
        summary: 'Menjumlah.',
        files: ['src/core/math.ts'],
        algorithms: [
          {
            id: 'tambah',
            name: 'Tambah',
            summary: 'a + b',
            symbols: ['add', 'double'],
            steps: [{ do: 'Jumlahkan', code: 'add' }],
          },
        ],
      },
      {
        id: 'view',
        group: 'g-ui',
        name: 'Tampilan',
        summary: 'Menggambar.',
        files: ['src/ui/view.ts', 'src/ui/Widget.svelte'],
        algorithms: [
          { id: 'gambar', name: 'Gambar', summary: 'Render', symbols: ['render', 'count'] },
        ],
      },
    ],
    flows: [
      {
        id: 'klik',
        name: 'Klik',
        summary: 'Pengguna mengklik.',
        actors: [{ id: 'user', name: 'Pengguna' }],
        messages: [
          { from: 'user', to: 'view', text: 'klik' },
          {
            fragment: 'opt',
            label: 'angka',
            messages: [{ from: 'view', to: 'math', text: 'add(1, 2)', code: 'add' }],
          },
          { from: 'math', to: 'view', text: '3', kind: 'return' },
        ],
      },
    ],
    symptoms: [
      {
        id: 'salah',
        title: 'Hasil salah',
        checks: [{ module: 'math', code: 'add', why: 'Penjumlahan.' }],
      },
    ],
    ...overrides,
  }
  writeFileSync(join(root, 'peta.config.json'), JSON.stringify(config))
  return join(root, 'peta.config.json')
}

test('a correct map produces data with relations from imports', () => {
  const { errors, warnings, data } = analyze(fixture())
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
  const view = data.modules.find((module) => module.id === 'view')
  const math = data.modules.find((module) => module.id === 'math')
  assert.deepEqual(
    view.deps.map((dep) => dep.to),
    ['math'],
  )
  assert.deepEqual(math.usedBy, ['view'])
  assert.deepEqual(view.externals, ['zod'])
  assert.equal(data.stats.files, 3)
  assert.equal(data.stats.exportsExplained, data.stats.exports)
  assert.deepEqual(data.flows[0].participants, ['user', 'view', 'math'])
  const add = data.symbols['src/core/math.ts#add']
  assert.equal(add.line, 2)
  assert.equal(add.doc, 'Adds two numbers.')
  assert.match(add.code, /return a \+ b/)
})

test('an unmapped file in coverage is an error', () => {
  const { errors } = analyze(fixture({}, { 'src/core/extra.ts': 'export const x = 1\n' }))
  assert.ok(errors.some((line) => line.includes('src/core/extra.ts')))
})

test('an import against the layer direction is an error', () => {
  const { errors } = analyze(
    fixture(
      {},
      {
        'src/core/math.ts':
          "import { render } from '../ui/view.ts'\nexport function add(a: number, b: number) { return a + b }\nexport const double = (x: number) => add(x, x)\n",
      },
    ),
  )
  assert.ok(errors.some((line) => line.includes('math (core)') && line.includes('view (ui)')))
})

test('a symbol that is not in the module files is an error', () => {
  const config = fixture({
    symptoms: [
      {
        id: 'salah',
        title: 'Hasil salah',
        checks: [{ module: 'math', code: 'multiply', why: 'x' }],
      },
    ],
  })
  const { errors } = analyze(config)
  assert.ok(errors.some((line) => line.includes('"multiply"')))
})

test('an unexplained exported function warns, and fails in strict mode', () => {
  const extra = {
    'src/core/math.ts':
      'export function add(a: number, b: number) { return a + b }\nexport const double = (x: number) => add(x, x)\nexport function triple(x: number) { return 3 * x }\n',
  }
  assert.ok(analyze(fixture({}, extra)).warnings.some((line) => line.includes('"triple"')))
  assert.ok(
    analyze(fixture({}, extra), { strict: true }).errors.some((line) => line.includes('"triple"')),
  )
})

test('references to unknown modules and participants are errors', () => {
  const { errors } = analyze(
    fixture({
      flows: [
        {
          id: 'klik',
          name: 'Klik',
          summary: 'S',
          messages: [{ from: 'ghost', to: 'view', text: 'x' }],
        },
      ],
      symptoms: [{ id: 'salah', title: 'T', checks: [{ module: 'nope', why: 'x' }] }],
    }),
  )
  assert.ok(errors.some((line) => line.includes('"ghost"')))
  assert.ok(errors.some((line) => line.includes('"nope"')))
})

test('public builds leave out the local root and editor links', () => {
  const { data } = analyze(fixture(), { public: true })
  assert.equal(data.meta.root, null)
  assert.equal(data.meta.editor, 'none')
})

test('the HTML page embeds the data safely', () => {
  const { data } = analyze(fixture())
  data.meta.description = 'tutup </script><script>alert(1)</script>'
  const html = renderHtml(data)
  assert.ok(html.includes('<title>Peta contoh</title>'))
  assert.ok(!html.includes('</script><script>alert(1)'))
  assert.ok(html.includes('\\u003c/script>'))
  assert.ok(!html.includes('{{data}}') && !html.includes('/*{{script}}*/'))
})
