// Reading source files without a parser: globs, symbol lines, code blocks, doc comments,
// imports and exports. Works for TypeScript, JavaScript, Svelte and Vue; the patterns are
// deliberately simple and covered by tests.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, normalize, posix, relative, resolve, sep } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.svelte-kit'])

/** "src/**\/*.ts" style glob to a RegExp over forward-slash paths. Supports **, *, ?, {a,b}. */
export function globToRegExp(glob) {
  let pattern = ''
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index]
    if (char === '*') {
      if (glob[index + 1] === '*') {
        const slash = glob[index + 2] === '/'
        pattern += slash ? '(?:.*/)?' : '.*'
        index += slash ? 2 : 1
      } else pattern += '[^/]*'
    } else if (char === '?') pattern += '[^/]'
    else if (char === '{') {
      const end = glob.indexOf('}', index)
      const options = glob.slice(index + 1, end).split(',')
      pattern += `(?:${options.map((option) => option.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`
      index = end
    } else pattern += char.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${pattern}$`)
}

/** The folder a glob can only match below: "src/ui/**\/*.ts" -> "src/ui". */
export function globBase(glob) {
  const parts = glob.split('/')
  const fixed = []
  for (const part of parts) {
    if (/[*?{]/.test(part)) break
    fixed.push(part)
  }
  return fixed.length === parts.length ? posix.dirname(glob) : fixed.join('/') || '.'
}

export const toPosix = (path) => path.split(sep).join('/')

function walk(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return []
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** Project-relative paths matching any include glob and no exclude glob, sorted. */
export function matchFiles(root, include, exclude = []) {
  const wanted = include.map(globToRegExp)
  const unwanted = exclude.map(globToRegExp)
  const found = new Set()
  for (const base of new Set(include.map(globBase))) {
    for (const absolute of walk(join(root, base))) {
      const file = toPosix(relative(root, absolute))
      if (wanted.some((re) => re.test(file)) && !unwanted.some((re) => re.test(file))) {
        found.add(file)
      }
    }
  }
  return [...found].sort()
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isComment = (line) => /^\s*(\/\/|\/\*|\*|<!--)/.test(line)

/**
 * Where `name` is defined in `source`: { line, exact }. `exact` is false when only a plain
 * word matched (fine for component templates, suspicious in .ts). Null when absent.
 */
export function findSymbol(source, name) {
  const n = escapeRegExp(name)
  const lines = source.split('\n')
  const declarations = [
    new RegExp(`\\bfunction\\*?\\s+${n}\\s*[<(]`),
    new RegExp(`\\b(?:const|let|var)\\s+${n}\\b`),
    new RegExp(`\\b(?:type|interface|class|enum)\\s+${n}\\b`),
    // Method in a class or object literal: `name(args) {` or `async name(args): T {`.
    new RegExp(
      `^\\s*(?:(?:public|private|protected|static|readonly|async|get|set)\\s+)*${n}\\s*(?:<[^>]*>)?\\(.*\\)\\s*(?::[^=]+)?\\{\\s*$`,
    ),
    // Object property holding a function: `name: (args) =>` or `name: function`.
    new RegExp(`^\\s*${n}\\s*:\\s*(?:async\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*(?::[^=]+)?=>`),
    new RegExp(`^\\s*${n}\\s*:\\s*(?:async\\s+)?function\\b`),
    // A property or entry declared on its own line, e.g. `1: (file) => ({` in a registry.
    new RegExp(`^\\s*(?:readonly\\s+)?['"]?${n}['"]?\\s*:`),
  ]
  for (const pattern of declarations) {
    const index = lines.findIndex((line) => !isComment(line) && pattern.test(line))
    if (index !== -1) return { line: index + 1, exact: true }
  }
  const word = new RegExp(`(?<![\\w$.])${n}(?![\\w$])`)
  const index = lines.findIndex((line) => !isComment(line) && word.test(line))
  return index === -1 ? null : { line: index + 1, exact: false }
}

/** Removes strings and comments from one line so brackets can be counted. */
function codeOnly(line, state) {
  let out = ''
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    const next = line[index + 1]
    if (state.block) {
      if (char === '*' && next === '/') {
        state.block = false
        index++
      }
      continue
    }
    if (state.quote) {
      if (char === '\\') index++
      else if (char === state.quote) state.quote = null
      continue
    }
    if (char === '/' && next === '/') break
    if (char === '/' && next === '*') {
      state.block = true
      index++
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      // Keep a stand-in, so `const a = '{'` still ends in a value, not in `=`.
      state.quote = char
      out += '_'
      continue
    }
    out += char
  }
  // A plain quote never spans lines; a template literal may.
  if (state.quote === '"' || state.quote === "'") state.quote = null
  return out
}

// A line ending like this goes on to the next one: `=>`, `=`, an operator or a dot.
const CONTINUES = /(=>|=|\?|:|&&|\|\||\+|-|\*|\.)\s*$/
// A next line starting like this belongs to the same statement: a union, a chained call.
const CONTINUED = /^\s*(\||&|\.|\?|:|=>)/

/**
 * The code block that starts at `line` (1-based): through the matching closing bracket,
 * or the end of the statement. Returns the last line number, at most `max` lines on.
 */
export function blockEnd(source, line, max = 80) {
  const lines = source.split('\n')
  const state = { block: false, quote: null }
  let depth = 0
  const last = Math.min(lines.length, line - 1 + max)
  for (let index = line - 1; index < last; index++) {
    const code = codeOnly(lines[index], state)
    for (const char of code) {
      if (char === '{' || char === '(' || char === '[') depth++
      else if (char === '}' || char === ')' || char === ']') depth--
    }
    if (depth > 0 || state.block || state.quote !== null || CONTINUES.test(code)) continue
    const next = lines.slice(index + 1).find((candidate) => candidate.trim() !== '')
    if (next === undefined || !CONTINUED.test(next)) return index + 1
  }
  return last
}

/** The comment block right above `line` (1-based), as plain text; '' when there is none. */
export function docAbove(source, line) {
  const lines = source.split('\n')
  const collected = []
  for (let index = line - 2; index >= 0; index--) {
    const current = lines[index].trim()
    if (current === '' || !/^(\/\/|\/\*|\*)/.test(current)) break
    collected.unshift(current)
  }
  return collected
    .map((entry) =>
      entry
        .replace(/^\/\*\*?/, '')
        .replace(/\*\/$/, '')
        .replace(/^\*\s?/, '')
        .replace(/^\/\/\s?/, '')
        .trim(),
    )
    .filter((entry) => !entry.startsWith('eslint-') && !entry.startsWith('svelte-ignore'))
    .join(' ')
    .replace(/\{@link\s+([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First line of the leading comment block above `line`, so snippets include their docs. */
export function commentStart(source, line) {
  const lines = source.split('\n')
  let start = line
  for (let index = line - 2; index >= 0; index--) {
    const current = lines[index].trim()
    if (current === '' || !/^(\/\/|\/\*|\*)/.test(current)) break
    start = index + 1
  }
  return start
}

/** Every import specifier in a file, with whether it is type-only. */
export function parseImports(source) {
  const found = []
  const patterns = [
    /\b(import|export)\s+(type\s+)?[\w$*{}\s,]*?\s*from\s*['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const [index, pattern] of patterns.entries()) {
    for (const match of source.matchAll(pattern)) {
      if (index === 0) found.push({ specifier: match[3], typeOnly: Boolean(match[2]) })
      else found.push({ specifier: match[1], typeOnly: false })
    }
  }
  return found
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.svelte', '.vue', '.json']

/**
 * A project-relative file for a relative or aliased specifier, `{ external }` for a package,
 * or null when nothing on disk matches (CSS, assets, missing files).
 */
export function resolveImport(root, fromFile, specifier, aliases = {}) {
  let target = null
  for (const [prefix, replacement] of Object.entries(aliases)) {
    if (specifier.startsWith(prefix)) {
      target = join(root, replacement, specifier.slice(prefix.length))
      break
    }
  }
  if (target === null) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      const parts = specifier.split('/')
      const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
      return { external: name }
    }
    target = resolve(dirname(join(root, fromFile)), specifier)
  }
  const candidates = [
    target,
    ...EXTENSIONS.map((extension) => target + extension),
    ...(target.endsWith('.js') ? [target.replace(/\.js$/, '.ts')] : []),
    ...EXTENSIONS.map((extension) => join(target, `index${extension}`)),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return { file: toPosix(relative(root, normalize(candidate))) }
    }
  }
  return null
}

/**
 * Exported declarations: { name, kind, line, doc }. kind is 'function' for functions and
 * for consts that hold an arrow function; otherwise const, type, interface, class or enum.
 * In components, exports inside the instance script count too.
 */
export function listExports(source, file) {
  const component = /\.(svelte|vue)$/.test(file)
  const indent = component ? '\\s*' : ''
  const patterns = [
    [
      new RegExp(`^${indent}export\\s+(?:default\\s+)?(?:async\\s+)?function\\*?\\s+([\\w$]+)`),
      'function',
    ],
    [new RegExp(`^${indent}export\\s+const\\s+([\\w$]+)`), 'const'],
    [new RegExp(`^${indent}export\\s+(type|interface|class|enum)\\s+([\\w$]+)`), null],
  ]
  const out = []
  source.split('\n').forEach((line, index) => {
    for (const [pattern, kind] of patterns) {
      const match = pattern.exec(line)
      if (!match) continue
      const name = kind === null ? match[2] : match[1]
      let resolved = kind ?? match[1]
      if (kind === 'const') {
        const rest = source
          .split('\n')
          .slice(index, index + 3)
          .join(' ')
        if (
          new RegExp(
            `const\\s+${escapeRegExp(name)}\\s*(?::[^=]+)?=\\s*(?:async\\s*)?(?:<[^>]*>\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*(?::\\s*[^=]+)?=>`,
          ).test(rest)
        ) {
          resolved = 'function'
        }
      }
      out.push({ name, kind: resolved, line: index + 1, doc: docAbove(source, index + 1) })
      break
    }
  })
  return out
}
