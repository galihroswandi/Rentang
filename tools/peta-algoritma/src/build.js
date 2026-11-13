// Turns analysed map data into one self-contained HTML page: styles, scripts and data inline,
// so the page opens straight from disk and can be hosted anywhere.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VIEWER = join(dirname(fileURLToPath(import.meta.url)), '..', 'viewer')

/** Files of one kind in name order; the numeric prefixes set the order they are joined in. */
const collect = (folder, extension) =>
  readdirSync(join(VIEWER, folder))
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => readFileSync(join(VIEWER, folder, name), 'utf8'))
    .join('\n')

/**
 * The viewer is written as ES modules (so editors and linters see every name), then joined
 * into one script: every top-level name is unique, so imports and `export` can go.
 */
const bundle = (source) =>
  source
    .replace(/^import \{[^}]*\} from '\.\/[^']+'\n/gm, '')
    .replace(/^export (?=(async |function|const|let|class))/gm, '')

const escapeHtml = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** @param {object} data @param {{ liveReload?: string }} options */
export function renderHtml(data, options = {}) {
  const template = readFileSync(join(VIEWER, 'index.html'), 'utf8')
  // JSON inside <script> must not contain "</script>" or "<!--"; escaping "<" covers both.
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  const script = `(() => {\n'use strict'\n${bundle(collect('js', '.js'))}\n})()`
  const reload = options.liveReload
    ? `<script>new EventSource(${JSON.stringify(options.liveReload)}).onmessage = () => location.reload()</script>`
    : ''
  return template
    .replace('{{lang}}', data.meta.language)
    .replace('{{title}}', escapeHtml(data.meta.title))
    .replace('/*{{style}}*/', () => collect('css', '.css'))
    .replace('"{{data}}"', () => json)
    .replace('/*{{script}}*/', () => script)
    .replace('<!--{{reload}}-->', () => reload)
}

export function writeHtml(path, html) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, html)
}
