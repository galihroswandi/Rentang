// Loads the entry config and every file it includes, validates each one on its own (so a
// message names the file it came from) and merges them into one map.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileSchema, REQUIRED_AFTER_MERGE, validate } from './schema.js'
import { toPosix } from './source.js'

/** Keys whose arrays are concatenated across files; any other key may appear in one file only. */
const LIST_KEYS = [
  'layers',
  'groups',
  'modules',
  'flows',
  'diagrams',
  'categories',
  'symptoms',
  'glossary',
  'ignore',
]

/**
 * @returns {{ config: object | null, root: string, configDir: string, issues: object[],
 *   origin: WeakMap<object, string> }}
 * `origin` maps every list item to the file it was declared in, for later messages.
 */
export function loadConfig(configPath) {
  const entry = resolve(configPath)
  const configDir = dirname(entry)
  const issues = []
  const origin = new WeakMap()
  const label = (file) => toPosix(relative(process.cwd(), file)) || file

  const read = (file) => {
    if (!existsSync(file)) {
      issues.push({ file: label(file), path: '', message: 'file-missing' })
      return null
    }
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      issues.push({ file: label(file), path: '', message: `json:${error.message}` })
      return null
    }
  }

  const main = read(entry)
  if (main === null) return { config: null, root: configDir, configDir, issues, origin }
  const parts = [[entry, main]]
  for (const include of main.include ?? []) {
    const file = resolve(configDir, include)
    const part = read(file)
    if (part !== null) parts.push([file, part])
  }

  const merged = {}
  for (const [file, part] of parts) {
    for (const issue of validate(fileSchema, part)) issues.push({ file: label(file), ...issue })
    if (typeof part !== 'object' || part === null || Array.isArray(part)) continue
    for (const [key, value] of Object.entries(part)) {
      if (key === '$schema' || key === '$comment') continue
      if (LIST_KEYS.includes(key) && Array.isArray(value)) {
        for (const item of value)
          if (item && typeof item === 'object') origin.set(item, label(file))
        merged[key] = [...(merged[key] ?? []), ...value]
      } else if (key in merged && file !== entry) {
        issues.push({ file: label(file), path: key, message: 'duplicate-key' })
      } else if (!(key in merged)) {
        merged[key] = value
      }
    }
  }
  for (const key of REQUIRED_AFTER_MERGE) {
    if (!(key in merged)) issues.push({ file: label(entry), path: key, message: 'required' })
  }

  const root = resolve(configDir, merged.root ?? '.')
  return { config: merged, root, configDir, issues, origin }
}
