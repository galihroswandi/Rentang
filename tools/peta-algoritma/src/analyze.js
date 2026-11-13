// Checks a loaded map against the source tree and builds the data the viewer shows.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from './load.js'
import { say } from './messages.js'
import {
  blockEnd,
  commentStart,
  docAbove,
  findSymbol,
  listExports,
  matchFiles,
  parseImports,
  resolveImport,
} from './source.js'

const SNIPPET_LINES = 60
const SCRIPT_FILES = /\.(m?[jt]sx?)$/

/**
 * @param {string} configPath
 * @param {{ strict?: boolean, public?: boolean }} options
 * @returns {{ errors: string[], warnings: string[], data: object | null, root: string,
 *   config: object | null, language: string }}
 */
export function analyze(configPath, options = {}) {
  const loaded = loadConfig(configPath)
  const language = loaded.config?.language ?? 'id'
  const t = (code, ...args) => say(language, code, ...args)
  const errors = []
  const warnings = []
  const where = (file, path) => [file, path].filter(Boolean).join(' › ')

  for (const issue of loaded.issues) {
    errors.push(`${where(issue.file, issue.path)}: ${t(issue.message)}`)
  }
  const { config, root, origin } = loaded
  if (!config || errors.length > 0) return { errors, warnings, data: null, root, config, language }

  const fileOf = (item) => origin.get(item) ?? ''
  const report = (level, item, path, message) => {
    const line = `${where(fileOf(item), path)}: ${message}`
    if (level === 'error') errors.push(line)
    else if (level === 'warn') warnings.push(line)
  }

  // --- Ids and references -------------------------------------------------------------
  const layers = config.layers ?? []
  const groups = config.groups ?? []
  const modules = config.modules ?? []
  const flows = config.flows ?? []
  const diagrams = config.diagrams ?? []
  const categories = config.categories ?? []
  const symptoms = config.symptoms ?? []
  const glossary = config.glossary ?? []
  const overview = config.overview ?? {}

  const uniqueIds = (kind, items, key = 'id') => {
    const seen = new Set()
    for (const item of items) {
      if (seen.has(item[key])) report('error', item, item[key], t('duplicate', kind, item[key]))
      seen.add(item[key])
    }
    return seen
  }
  const layerIds = uniqueIds('layer', layers)
  const groupIds = uniqueIds('group', groups)
  const moduleIds = uniqueIds('module', modules)
  uniqueIds('flow', flows)
  const diagramIds = uniqueIds('diagram', diagrams)
  const categoryIds = uniqueIds('category', categories)
  uniqueIds('symptom', symptoms)

  const need = (item, path, kind, value, known) => {
    if (!known.has(value)) report('error', item, path, t('unknown-ref', kind, value))
  }
  for (const layer of layers) {
    for (const used of layer.mayUse ?? [])
      need(layer, `layers.${layer.id}.mayUse`, 'layer', used, layerIds)
  }
  for (const group of groups) need(group, `groups.${group.id}`, 'layer', group.layer, layerIds)
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const layerOf = (module) => groupById.get(module.group)?.layer
  for (const module of modules) {
    need(module, `modules.${module.id}.group`, 'group', module.group, groupIds)
    for (const diagram of module.diagrams ?? []) {
      need(module, `modules.${module.id}.diagrams`, 'diagram', diagram, diagramIds)
    }
    const algorithmIds = new Set()
    for (const algorithm of module.algorithms ?? []) {
      if (algorithmIds.has(algorithm.id)) {
        report(
          'error',
          module,
          `modules.${module.id}.algorithms`,
          t('duplicate', 'algorithm', algorithm.id),
        )
      }
      algorithmIds.add(algorithm.id)
    }
  }
  for (const diagram of diagrams) {
    const nodeIds = new Set(diagram.nodes.map((node) => node.id))
    for (const edge of diagram.edges ?? []) {
      need(diagram, `diagrams.${diagram.id}.edges`, 'node', edge.from, nodeIds)
      need(diagram, `diagrams.${diagram.id}.edges`, 'node', edge.to, nodeIds)
    }
  }
  for (const symptom of symptoms) {
    if (symptom.category && categories.length > 0) {
      need(symptom, `symptoms.${symptom.id}.category`, 'category', symptom.category, categoryIds)
    }
    for (const check of symptom.checks)
      need(symptom, `symptoms.${symptom.id}`, 'module', check.module, moduleIds)
  }
  for (const entry of glossary) {
    for (const module of entry.modules ?? [])
      need(entry, `glossary.${entry.term}`, 'module', module, moduleIds)
  }
  for (const step of overview.pipeline ?? [])
    need(config, 'overview.pipeline', 'module', step.module, moduleIds)
  for (const module of overview.readingOrder ?? [])
    need(config, 'overview.readingOrder', 'module', module, moduleIds)

  // --- Files and coverage ---------------------------------------------------------------
  const sources = new Map()
  const read = (file) => {
    if (!sources.has(file)) {
      const path = join(root, file)
      sources.set(file, existsSync(path) ? readFileSync(path, 'utf8') : null)
    }
    return sources.get(file)
  }
  const owners = new Map()
  for (const module of modules) {
    for (const file of module.files) {
      if (read(file) === null)
        report('error', module, `modules.${module.id}.files`, t('missing-file', file))
      owners.set(file, [...(owners.get(file) ?? []), module.id])
    }
    for (const file of module.tests ?? []) {
      if (!existsSync(join(root, file)))
        report('error', module, `modules.${module.id}.tests`, t('missing-file', file))
    }
  }
  const covered = config.coverage
    ? matchFiles(root, config.coverage.include, config.coverage.exclude)
    : []
  const coveredSet = new Set(covered)
  const ignored = new Map((config.ignore ?? []).map((entry) => [entry.file, entry]))
  for (const entry of config.ignore ?? []) {
    if (!existsSync(join(root, entry.file)))
      report('error', entry, 'ignore', t('missing-file', entry.file))
    else if (config.coverage && !coveredSet.has(entry.file))
      report('warn', entry, 'ignore', t('ignore-unused', entry.file))
  }
  for (const file of covered) {
    if (!owners.has(file) && !ignored.has(file))
      report('error', config, 'coverage', t('unmapped-file', file))
  }

  // --- Symbols --------------------------------------------------------------------------
  const symbols = {}
  const moduleById = new Map(modules.map((module) => [module.id, module]))
  /** Resolves `name` in the files of the given modules, in order. Returns a key or null. */
  const resolveSymbol = (name, moduleList, item, path) => {
    // An exact declaration in any of the files wins over a plain word in an earlier one.
    const candidates = []
    for (const module of moduleList) {
      for (const file of module.files) {
        const source = read(file)
        if (source === null) continue
        const found = findSymbol(source, name)
        if (found) candidates.push({ file, source, found })
      }
    }
    const hit = candidates.find((candidate) => candidate.found.exact) ?? candidates[0]
    if (!hit) {
      const files = moduleList.flatMap((module) => module.files).join(', ')
      report('error', item, path, t('symbol-missing', name, files || '?'))
      return null
    }
    const { file, source, found } = hit
    if (!found.exact && SCRIPT_FILES.test(file))
      report('warn', item, path, t('symbol-inexact', name, file))
    const key = `${file}#${name}`
    if (!symbols[key]) {
      const start = found.exact ? commentStart(source, found.line) : found.line
      const end = found.exact ? blockEnd(source, found.line) : found.line
      const lines = source.split('\n').slice(start - 1, end)
      symbols[key] = {
        name,
        file,
        line: found.line,
        start,
        end,
        doc: found.exact ? docAbove(source, found.line) : '',
        code: lines.slice(0, SNIPPET_LINES).join('\n'),
        truncated: lines.length > SNIPPET_LINES,
      }
    }
    return key
  }

  const explained = new Map(modules.map((module) => [module.id, new Set()]))
  const mark = (moduleId, name) => explained.get(moduleId)?.add(name)

  const resolveSteps = (steps, module, item, path) =>
    (steps ?? []).map((step, index) => {
      const at = `${path}.steps[${index}]`
      if (typeof step === 'string') return step
      if ('do' in step || 'stop' in step) {
        if (!step.code) return step
        mark(module.id, step.code)
        return { ...step, ref: resolveSymbol(step.code, [module], item, at) }
      }
      if ('if' in step) {
        return {
          ...step,
          then: resolveSteps(step.then, module, item, `${at}.then`),
          ...(step.else ? { else: resolveSteps(step.else, module, item, `${at}.else`) } : {}),
        }
      }
      return { ...step, body: resolveSteps(step.body, module, item, `${at}.body`) }
    })

  const checkStops = (steps, item, path) => {
    ;(steps ?? []).forEach((step, index) => {
      if (typeof step !== 'object') return
      if ('stop' in step && index < steps.length - 1)
        report('warn', item, `${path}.steps[${index}]`, t('step-after-stop'))
      if ('if' in step) {
        checkStops(step.then, item, `${path}.steps[${index}].then`)
        checkStops(step.else, item, `${path}.steps[${index}].else`)
      }
      if ('loop' in step) checkStops(step.body, item, `${path}.steps[${index}].body`)
    })
  }

  const outModules = modules.map((module) => {
    const algorithms = (module.algorithms ?? []).map((algorithm) => {
      const path = `modules.${module.id}.algorithms.${algorithm.id}`
      checkStops(algorithm.steps, module, path)
      for (const name of algorithm.symbols ?? []) mark(module.id, name)
      return {
        ...algorithm,
        symbols: (algorithm.symbols ?? [])
          .map((name) => resolveSymbol(name, [module], module, `${path}.symbols`))
          .filter(Boolean),
        steps: resolveSteps(algorithm.steps, module, module, path),
      }
    })
    return { ...module, layer: layerOf(module), algorithms }
  })

  const outFlows = flows.map((flow) => {
    const actors = new Map((flow.actors ?? []).map((actor) => [actor.id, actor]))
    for (const actor of flow.actors ?? []) {
      if (moduleIds.has(actor.id))
        report('error', flow, `flows.${flow.id}.actors`, t('duplicate', 'participant', actor.id))
    }
    const participants = new Set()
    const known = (id) => actors.has(id) || moduleIds.has(id)
    const walk = (messages, path) =>
      messages.map((message, index) => {
        const at = `${path}[${index}]`
        if ('fragment' in message) {
          return {
            ...message,
            messages: walk(message.messages, `${at}.messages`),
            ...(message.else
              ? {
                  else: message.else.map((operand, i) => ({
                    ...operand,
                    messages: walk(operand.messages, `${at}.else[${i}].messages`),
                  })),
                }
              : {}),
          }
        }
        for (const end of [message.from, message.to]) {
          if (!known(end)) report('error', flow, at, t('unknown-ref', 'participant', end))
          else participants.add(end)
        }
        if (!message.code) return message
        const candidates = [message.to, message.from]
          .filter((id) => moduleIds.has(id))
          .map((id) => moduleById.get(id))
        if (candidates.length === 0) {
          report('error', flow, at, t('actor-needs-module', flow.id))
          return message
        }
        mark(candidates[0].id, message.code)
        return { ...message, ref: resolveSymbol(message.code, candidates, flow, at) }
      })
    const messages = walk(flow.messages, `flows.${flow.id}.messages`)
    for (const id of flow.participants ?? []) {
      if (!known(id))
        report('error', flow, `flows.${flow.id}.participants`, t('unknown-ref', 'participant', id))
    }
    if (flow.category && categories.length > 0) {
      need(flow, `flows.${flow.id}.category`, 'category', flow.category, categoryIds)
    }
    const order = [
      ...(flow.participants ?? []),
      ...[...participants].filter((id) => !(flow.participants ?? []).includes(id)),
    ]
    return { ...flow, messages, participants: order }
  })

  const outSymptoms = symptoms.map((symptom) => ({
    ...symptom,
    checks: symptom.checks.map((check, index) => {
      const module = moduleById.get(check.module)
      if (!check.code || !module) return check
      mark(module.id, check.code)
      return {
        ...check,
        ref: resolveSymbol(
          check.code,
          [module],
          symptom,
          `symptoms.${symptom.id}.checks[${index}]`,
        ),
      }
    }),
  }))

  // --- Dependencies from imports --------------------------------------------------------
  const aliases = config.resolve?.alias ?? {}
  const edges = new Map()
  const externals = new Map(modules.map((module) => [module.id, new Set()]))
  const layerRule = config.rules?.layers ?? 'error'
  const layerById = new Map(layers.map((layer) => [layer.id, layer]))
  for (const module of modules) {
    for (const file of module.files) {
      const source = read(file)
      if (source === null) continue
      for (const { specifier, typeOnly } of parseImports(source)) {
        const target = resolveImport(root, file, specifier, aliases)
        if (!target) continue
        if (target.external) {
          externals.get(module.id).add(target.external)
          continue
        }
        for (const to of owners.get(target.file) ?? []) {
          if (to === module.id) continue
          const key = `${module.id}>${to}`
          const edge = edges.get(key) ?? { from: module.id, to, typeOnly: true, via: [] }
          edge.typeOnly &&= typeOnly
          if (!edge.via.some(([a, b]) => a === file && b === target.file))
            edge.via.push([file, target.file])
          edges.set(key, edge)
          const fromLayer = layerOf(module)
          const toLayer = layerOf(moduleById.get(to))
          const allowed = layerById.get(fromLayer)?.mayUse
          if (allowed && toLayer && !allowed.includes(toLayer)) {
            report(
              layerRule,
              module,
              `modules.${module.id}`,
              t('layer-violation', module.id, fromLayer, to, toLayer, file),
            )
          }
        }
      }
    }
  }

  // --- Exported functions without an explanation ----------------------------------------
  const exportRule = config.rules?.exports ?? 'warn'
  let exportCount = 0
  let explainedCount = 0
  const exportsByModule = new Map()
  for (const module of modules) {
    const list = []
    for (const file of module.files) {
      const source = read(file)
      if (source === null) continue
      for (const entry of listExports(source, file)) {
        const isFunction = entry.kind === 'function'
        const ok = explained.get(module.id).has(entry.name)
        if (isFunction) {
          exportCount++
          if (ok) explainedCount++
          else
            report(
              exportRule,
              module,
              `modules.${module.id}`,
              t('export-unexplained', entry.name, file),
            )
        }
        list.push({ ...entry, file, explained: ok })
      }
    }
    exportsByModule.set(module.id, list)
  }

  if (options.strict) {
    errors.push(...warnings.splice(0))
  }
  if (errors.length > 0) return { errors, warnings, data: null, root, config, language }

  // --- Data for the viewer --------------------------------------------------------------
  const usedBy = new Map(modules.map((module) => [module.id, []]))
  for (const edge of edges.values()) usedBy.get(edge.to).push(edge.from)
  const git = (...args) => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      return null
    }
  }
  const remote = git('remote', 'get-url', 'origin')
  const github = remote ? /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote) : null
  const repository = config.repository
    ? { url: config.repository.url.replace(/\/$/, ''), branch: config.repository.branch ?? 'main' }
    : github
      ? {
          url: `https://github.com/${github[1]}`,
          branch: git('rev-parse', '--abbrev-ref', 'HEAD') ?? 'main',
        }
      : null

  const allFiles = [...new Set([...covered, ...owners.keys()])].sort()
  const lineCount = (file) => (read(file) ?? '').split('\n').length
  const algorithmCount = outModules.reduce((sum, module) => sum + module.algorithms.length, 0)

  const data = {
    version: 1,
    meta: {
      title: config.title,
      system: config.system ?? config.title,
      description: config.description ?? '',
      language,
      generatedAt: new Date().toISOString(),
      root: options.public ? null : root,
      editor: options.public ? 'none' : (config.editor ?? 'vscode'),
      repository,
      commit: git('rev-parse', '--short', 'HEAD'),
    },
    stats: {
      modules: modules.length,
      algorithms: algorithmCount,
      flows: flows.length,
      diagrams: diagrams.length,
      symptoms: symptoms.length,
      files: allFiles.length,
      filesMapped: allFiles.filter((file) => owners.has(file)).length,
      filesIgnored: allFiles.filter((file) => !owners.has(file) && ignored.has(file)).length,
      exports: exportCount,
      exportsExplained: explainedCount,
    },
    layers: layers.map((layer, index) => ({ ...layer, index })),
    groups,
    modules: outModules.map((module) => ({
      ...module,
      deps: [...edges.values()]
        .filter((edge) => edge.from === module.id)
        .map(({ to, typeOnly, via }) => ({ to, typeOnly, via })),
      usedBy: usedBy.get(module.id),
      externals: [...externals.get(module.id)].sort(),
      exports: exportsByModule.get(module.id),
      lines: module.files.reduce((sum, file) => sum + lineCount(file), 0),
    })),
    symbols,
    flows: outFlows,
    diagrams,
    categories,
    symptoms: outSymptoms,
    glossary,
    overview,
    files: allFiles.map((file) => ({
      path: file,
      lines: lineCount(file),
      modules: owners.get(file) ?? [],
      ignored: ignored.get(file)?.reason ?? null,
    })),
  }
  return { errors, warnings, data, root, config, language }
}
