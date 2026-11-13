// A small dev server: serves the map, rebuilds it when the map files or the code change,
// and tells open pages to reload. Problems are shown in the page instead of a stale map.
import { watch } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { analyze } from './analyze.js'
import { renderHtml } from './build.js'
import { say } from './messages.js'
import { globBase } from './source.js'

const EVENTS = '/__peta/events'

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function problemsPage(title, lines) {
  return `<!doctype html><html lang="id"><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;margin:40px;max-width:960px;color:#1c1b19;background:#faf9f6}
h1{font-size:20px;color:#b42318}li{margin:6px 0;font-family:ui-monospace,monospace;font-size:13px}</style>
<h1>${escapeHtml(title)}</h1><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
<script>new EventSource(${JSON.stringify(EVENTS)}).onmessage = () => location.reload()</script></html>`
}

export function serve(configPath, { port = 4319, strict = false } = {}) {
  const clients = new Set()
  let page = ''
  let language = 'id'

  const build = () => {
    const result = analyze(configPath, { strict })
    language = result.language
    if (result.data) {
      page = renderHtml(result.data, { liveReload: EVENTS })
      for (const line of result.warnings) console.warn(`  ! ${line}`)
    } else {
      page = problemsPage(say(language, 'failed', result.errors.length), result.errors)
      for (const line of result.errors) console.error(`  ✗ ${line}`)
    }
    return result
  }

  const first = build()
  const server = createServer((request, response) => {
    if (request.url === EVENTS) {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      response.write(': connected\n\n')
      clients.add(response)
      request.on('close', () => clients.delete(response))
      return
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    })
    response.end(page)
  })

  let timer = null
  const changed = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      build()
      console.log(say(language, 'rebuilt'))
      for (const client of clients) client.write('data: reload\n\n')
    }, 150)
  }

  // Watch the map files, the viewer itself and every folder the coverage globs look in.
  const folders = new Set([
    dirname(resolve(configPath)),
    join(dirname(new URL(import.meta.url).pathname), '..', 'viewer'),
  ])
  for (const glob of first.config?.coverage?.include ?? [])
    folders.add(join(first.root, globBase(glob)))
  for (const module of first.config?.modules ?? [])
    for (const file of module.files) folders.add(dirname(join(first.root, file)))
  for (const folder of folders) {
    try {
      watch(folder, { recursive: true }, changed)
    } catch {
      // A folder that does not exist yet is simply not watched.
    }
  }

  server.listen(port, '127.0.0.1', () => {
    console.log(say(language, 'serving', `http://localhost:${port}`))
  })
  return server
}
