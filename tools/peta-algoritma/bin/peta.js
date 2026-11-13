#!/usr/bin/env node
// peta: check the algorithm map against the code, build its HTML page, or serve it.
import { resolve } from 'node:path'
import { analyze } from '../src/analyze.js'
import { renderHtml, writeHtml } from '../src/build.js'
import { say } from '../src/messages.js'
import { fileSchema, toJsonSchema } from '../src/schema.js'
import { serve } from '../src/serve.js'

const [command, ...rest] = process.argv.slice(2)
const flags = {}
for (let index = 0; index < rest.length; index++) {
  const arg = rest[index]
  if (!arg.startsWith('--')) continue
  const key = arg.slice(2)
  const next = rest[index + 1]
  if (next !== undefined && !next.startsWith('--')) {
    flags[key] = next
    index++
  } else flags[key] = true
}

const color = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code, text) => (color ? `\u001b[${code}m${text}\u001b[0m` : text)
const configPath = resolve(typeof flags.config === 'string' ? flags.config : 'peta.config.json')

function runAnalysis() {
  const result = analyze(configPath, {
    strict: Boolean(flags.strict),
    public: Boolean(flags.public),
  })
  const t = (code, ...args) => say(result.language, code, ...args)
  if (result.warnings.length > 0) {
    console.warn(paint('33', t('warnings', result.warnings.length)))
    for (const line of result.warnings) console.warn(paint('33', `  ! ${line}`))
  }
  if (result.errors.length > 0) {
    console.error(paint('31', t('failed', result.errors.length)))
    for (const line of result.errors) console.error(paint('31', `  ✗ ${line}`))
    process.exit(1)
  }
  return { ...result, t }
}

switch (command) {
  case 'check': {
    const { data, t } = runAnalysis()
    const { modules, algorithms, flows, diagrams, filesMapped, filesIgnored } = data.stats
    console.log(
      paint('32', t('ok', modules, algorithms, flows, diagrams, filesMapped + filesIgnored)),
    )
    break
  }
  case 'build': {
    const { data, root, config, t } = runAnalysis()
    const out = resolve(
      root,
      typeof flags.out === 'string' ? flags.out : (config.output ?? 'dist-peta/index.html'),
    )
    writeHtml(out, renderHtml(data))
    console.log(paint('32', t('built', out)))
    break
  }
  case 'dev':
    serve(configPath, { port: Number(flags.port ?? 4319), strict: Boolean(flags.strict) })
    break
  case 'schema':
    process.stdout.write(`${JSON.stringify(toJsonSchema(fileSchema, 'Peta algoritma'), null, 2)}\n`)
    break
  default:
    console.log(say('id', 'usage'))
    process.exit(command === undefined || command === 'help' || flags.help ? 0 : 1)
}
