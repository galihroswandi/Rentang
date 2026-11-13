import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { fileSchema, toJsonSchema, validate } from '../src/schema.js'

const here = dirname(fileURLToPath(import.meta.url))

test('a small valid map file has no issues', () => {
  const file = {
    title: 'Peta',
    layers: [{ id: 'core', name: 'Core', summary: 'Logika murni.' }],
    groups: [{ id: 'g', layer: 'core', name: 'Grup' }],
    modules: [
      {
        id: 'math',
        group: 'g',
        name: 'Matematika',
        summary: 'Menjumlah.',
        files: ['src/math.ts'],
        algorithms: [
          {
            id: 'tambah',
            name: 'Tambah',
            summary: 'a + b',
            steps: [
              'Ambil a',
              { if: 'b negatif?', then: [{ stop: 'Kurangi' }] },
              { loop: 'Masih ada?', body: [{ do: 'Jumlah', code: 'add' }] },
            ],
          },
        ],
      },
    ],
  }
  assert.deepEqual(validate(fileSchema, file), [])
})

test('issues carry a path and a code', () => {
  const issues = validate(fileSchema, {
    modules: [{ id: 'Bad Id', group: 'g', name: 'X', summary: 'Y', files: [], extra: 1 }],
    flows: [{ id: 'f', name: 'F', summary: 'S', messages: [{ from: 'a', to: 'b' }] }],
  })
  const lines = issues.map(({ path, message }) => `${path} ${message.split(':')[0]}`)
  assert.ok(lines.includes('modules[0].id pattern'))
  assert.ok(lines.includes('modules[0].files minItems'))
  assert.ok(lines.includes('modules[0].extra unknown-key'))
  assert.ok(lines.includes('flows[0].messages[0].text required'))
})

test('steps must have a known shape', () => {
  const issues = validate(fileSchema, {
    modules: [
      {
        id: 'm',
        group: 'g',
        name: 'M',
        summary: 'S',
        files: ['a.ts'],
        algorithms: [{ id: 'a', name: 'A', summary: 'S', steps: [{ maybe: 'x' }] }],
      },
    ],
  })
  assert.equal(issues[0].message, 'union')
})

test('the committed schema.json matches the schema in code', () => {
  const committed = JSON.parse(readFileSync(join(here, '..', 'schema.json'), 'utf8'))
  assert.deepEqual(
    committed,
    toJsonSchema(fileSchema, 'Peta algoritma'),
    'Run: node bin/peta.js schema > schema.json',
  )
})
