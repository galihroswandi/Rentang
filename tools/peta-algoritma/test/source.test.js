import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  blockEnd,
  commentStart,
  docAbove,
  findSymbol,
  globBase,
  globToRegExp,
  listExports,
  matchFiles,
  parseImports,
  resolveImport,
} from '../src/source.js'

test('globToRegExp handles **, *, ? and {a,b}', () => {
  const ts = globToRegExp('src/**/*.ts')
  assert.ok(ts.test('src/a.ts'))
  assert.ok(ts.test('src/x/y/a.ts'))
  assert.ok(!ts.test('src/a.tsx'))
  assert.ok(!ts.test('lib/a.ts'))
  const tests = globToRegExp('**/*.test.ts')
  assert.ok(tests.test('a.test.ts'))
  assert.ok(tests.test('src/core/a.test.ts'))
  assert.ok(globToRegExp('src/*.{ts,svelte}').test('src/App.svelte'))
  assert.ok(!globToRegExp('src/*.{ts,svelte}').test('src/ui/App.svelte'))
  assert.ok(globToRegExp('src/?.ts').test('src/a.ts'))
})

test('globBase is the fixed folder in front of the first wildcard', () => {
  assert.equal(globBase('src/ui/**/*.ts'), 'src/ui')
  assert.equal(globBase('**/*.ts'), '.')
  assert.equal(globBase('src/main.ts'), 'src')
})

const SOURCE = `import { a } from './a.ts'

/** Adds two numbers. */
export function add(x: number, y: number): number {
  return x + y
}

// The double of a number.
export const double = (x: number): number =>
  add(x, x)

export type Shape =
  | { kind: 'circle' }
  | { kind: 'square' }

const store = {
  async open(name: string) {
    return name
  },
  close: () => undefined,
}
`

test('findSymbol finds declarations and prefers them over plain words', () => {
  assert.deepEqual(findSymbol(SOURCE, 'add'), { line: 4, exact: true })
  assert.deepEqual(findSymbol(SOURCE, 'double'), { line: 9, exact: true })
  assert.deepEqual(findSymbol(SOURCE, 'Shape'), { line: 12, exact: true })
  assert.deepEqual(findSymbol(SOURCE, 'open'), { line: 17, exact: true })
  assert.deepEqual(findSymbol(SOURCE, 'close'), { line: 20, exact: true })
  assert.equal(findSymbol(SOURCE, 'missing'), null)
})

test('findSymbol falls back to a plain word, and skips comments', () => {
  const svelte =
    '<script>\n  // onPick is not declared here\n</script>\n<Button onclick={onPick} />'
  assert.deepEqual(findSymbol(svelte, 'onPick'), { line: 4, exact: false })
})

test('blockEnd follows brackets, continuations and unions', () => {
  assert.equal(blockEnd(SOURCE, 4), 6)
  assert.equal(blockEnd(SOURCE, 9), 10)
  assert.equal(blockEnd(SOURCE, 12), 14)
  assert.equal(blockEnd(SOURCE, 17), 19)
  assert.equal(blockEnd('const a = "{"\nconst b = 1', 1), 1)
})

test('docAbove and commentStart read the comment right above a line', () => {
  assert.equal(docAbove(SOURCE, 4), 'Adds two numbers.')
  assert.equal(docAbove(SOURCE, 9), 'The double of a number.')
  assert.equal(docAbove(SOURCE, 12), '')
  assert.equal(commentStart(SOURCE, 4), 3)
})

test('parseImports finds named, type-only, side-effect and dynamic imports', () => {
  const source = `import {\n  a,\n  type B,\n} from './a.ts'\nimport type { C } from '../c.ts'\nimport './style.css'\nexport { d } from 'pkg'\nconst lazy = () => import('./lazy.ts')`
  assert.deepEqual(
    parseImports(source)
      .map(({ specifier, typeOnly }) => `${specifier}:${typeOnly}`)
      .sort(),
    ['../c.ts:true', './a.ts:false', './lazy.ts:false', './style.css:false', 'pkg:false'],
  )
})

test('resolveImport resolves files, .js to .ts, index files, aliases and packages', () => {
  const root = mkdtempSync(join(tmpdir(), 'peta-resolve-'))
  mkdirSync(join(root, 'src/lib'), { recursive: true })
  writeFileSync(join(root, 'src/a.ts'), '')
  writeFileSync(join(root, 'src/lib/index.ts'), '')
  assert.deepEqual(resolveImport(root, 'src/b.ts', './a.ts'), { file: 'src/a.ts' })
  assert.deepEqual(resolveImport(root, 'src/b.ts', './a.js'), { file: 'src/a.ts' })
  assert.deepEqual(resolveImport(root, 'src/b.ts', './a'), { file: 'src/a.ts' })
  assert.deepEqual(resolveImport(root, 'src/b.ts', './lib'), { file: 'src/lib/index.ts' })
  assert.deepEqual(resolveImport(root, 'src/b.ts', '@/a.ts', { '@/': 'src/' }), {
    file: 'src/a.ts',
  })
  assert.deepEqual(resolveImport(root, 'src/b.ts', 'zod'), { external: 'zod' })
  assert.deepEqual(resolveImport(root, 'src/b.ts', '@lucide/svelte/icons/x'), {
    external: '@lucide/svelte',
  })
  assert.equal(resolveImport(root, 'src/b.ts', './missing.ts'), null)
})

test('listExports tells functions from constants and types', () => {
  const exports = listExports(SOURCE, 'src/a.ts')
  assert.deepEqual(
    exports.map(({ name, kind }) => `${name}:${kind}`),
    ['add:function', 'double:function', 'Shape:type'],
  )
  assert.equal(exports[0].doc, 'Adds two numbers.')
  const svelte = '<script lang="ts">\n  export async function focusRow(i: number) {}\n</script>'
  assert.deepEqual(
    listExports(svelte, 'src/T.svelte').map(({ name, kind }) => `${name}:${kind}`),
    ['focusRow:function'],
  )
})

test('matchFiles applies include and exclude globs below their base folders', () => {
  const root = mkdtempSync(join(tmpdir(), 'peta-match-'))
  mkdirSync(join(root, 'src/ui'), { recursive: true })
  mkdirSync(join(root, 'node_modules/x'), { recursive: true })
  for (const file of [
    'src/a.ts',
    'src/a.test.ts',
    'src/ui/B.svelte',
    'src/ui/c.css',
    'node_modules/x/y.ts',
  ]) {
    writeFileSync(join(root, file), '')
  }
  assert.deepEqual(matchFiles(root, ['src/**/*.ts', 'src/**/*.svelte'], ['**/*.test.ts']), [
    'src/a.ts',
    'src/ui/B.svelte',
  ])
})
