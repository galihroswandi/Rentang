// Module page: what the module is for, its relations, and every algorithm in it with an
// activity diagram, examples, rules, pitfalls and the code itself.

import {
  basename,
  codeLink,
  copyText,
  DATA,
  diagramById,
  groupById,
  h,
  href,
  icon,
  layerChip,
  layerColor,
  layerOfModule,
  moduleById,
  moduleChip,
  moduleHref,
  symbolLink,
  SYMBOLS,
  T,
} from './00-core.js'
import { diagramFrame } from './10-uml-common.js'
import { activityDiagram, stepsAsText } from './20-uml-activity.js'
import { graphDiagram } from './22-uml-graph.js'
import { footer } from './40-page-home.js'
import { pageNotFound } from './45-page-reference.js'

const KEYWORDS = new Set(
  'const let var function return if else for while of in new import export from type interface async await true false null undefined typeof class extends throw try catch break continue switch case default as readonly void'.split(
    ' ',
  ),
)

/** A light highlighter: comments, strings, keywords and numbers. */
function highlight(lineText) {
  const out = []
  const pattern =
    /(\/\/.*$|\/\*.*?\*\/|^\s*\*.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|([A-Za-z_$][\w$]*)|(\b\d+(?:\.\d+)?\b)/g
  let last = 0
  for (const match of lineText.matchAll(pattern)) {
    if (match.index > last) out.push(lineText.slice(last, match.index))
    const [text, comment, string, word, number] = match
    if (comment) out.push(h('span', { class: 'tk-comment' }, text))
    else if (string) out.push(h('span', { class: 'tk-string' }, text))
    else if (word && KEYWORDS.has(word)) out.push(h('span', { class: 'tk-key' }, text))
    else if (number) out.push(h('span', { class: 'tk-number' }, text))
    else out.push(text)
    last = match.index + text.length
  }
  if (last < lineText.length) out.push(lineText.slice(last))
  return out
}

function codeBlock(symbol) {
  const lines = symbol.code.split('\n')
  return h(
    'pre',
    { class: 'code' },
    h(
      'code',
      {},
      lines.map((text, index) => {
        const number = symbol.start + index
        return h(
          'span',
          { class: ['code-line', number === symbol.line && 'is-target'] },
          h('span', { class: 'ln' }, String(number)),
          highlight(text),
          '\n',
        )
      }),
    ),
  )
}

function snippet(key) {
  const symbol = SYMBOLS[key]
  if (!symbol) return null
  return h(
    'details',
    { class: 'snippet' },
    h(
      'summary',
      {},
      icon('code', 15),
      h('span', {}, `${T('viewCode')}: `),
      h('code', {}, symbol.name),
      h('span', { class: 'muted small' }, ` — ${symbol.file}:${symbol.line}`),
    ),
    symbol.doc ? h('p', { class: 'doc' }, symbol.doc) : null,
    codeBlock(symbol),
    h(
      'div',
      { class: 'snippet-foot' },
      codeLink(symbol.file, symbol.line),
      symbol.truncated ? h('span', { class: 'muted small' }, T('truncated')) : null,
    ),
  )
}

function bulletList(items, cls) {
  return items?.length
    ? h(
        'ul',
        { class: ['bullets', cls] },
        items.map((item) => h('li', {}, item)),
      )
    : null
}

function paragraphs(text) {
  return text
    ? String(text)
        .split(/\n{2,}/)
        .map((part) => h('p', {}, part))
    : null
}

function relationDiagram(module) {
  const column = (title, ids, extra) =>
    h(
      'div',
      { class: 'rel-col' },
      h('div', { class: 'rel-title' }, title),
      ids.length
        ? h(
            'div',
            { class: 'rel-chips' },
            ids.map((id) => moduleChip(id)),
          )
        : h('span', { class: 'muted small' }, T('none')),
      extra,
    )
  const typeOnly = module.deps
    .filter((dep) => dep.typeOnly)
    .map((dep) => moduleById.get(dep.to)?.name)
  return h(
    'div',
    { class: 'relations' },
    column(T('usedBy'), module.usedBy),
    h('div', { class: 'rel-arrow', 'aria-hidden': 'true' }, '«use»', h('span', {}, '⇢')),
    h(
      'div',
      { class: 'rel-self', style: { '--layer': layerColor(module.layer) } },
      h('span', { class: 'comp-icon', 'aria-hidden': 'true' }, icon('component', 15)),
      h('strong', {}, module.name),
      h('span', { class: 'muted small mono' }, basename(module.files[0])),
    ),
    h('div', { class: 'rel-arrow', 'aria-hidden': 'true' }, '«use»', h('span', {}, '⇢')),
    column(
      T('uses'),
      module.deps.map((dep) => dep.to),
      typeOnly.length
        ? h('p', { class: 'muted small' }, `${T('typeOnly')}: ${typeOnly.join(', ')}`)
        : null,
    ),
  )
}

function algorithmSection(module, algorithm) {
  const label = T('diagramLabel', T('kindActivity')[0], algorithm.name)
  return h(
    'section',
    { class: 'algo', id: `alg-${algorithm.id}` },
    h(
      'h2',
      {},
      h(
        'a',
        {
          class: 'anchor',
          href: moduleHref(module.id, algorithm.id),
          'aria-label': algorithm.name,
        },
        '#',
      ),
      algorithm.name,
    ),
    h('p', { class: 'algo-sum' }, algorithm.summary),
    algorithm.symbols.length
      ? h(
          'div',
          { class: 'code-row' },
          h('span', { class: 'muted small' }, `${T('code')}:`),
          algorithm.symbols.map((key) => symbolLink(key)),
        )
      : null,
    algorithm.input || algorithm.output
      ? h(
          'dl',
          { class: 'io' },
          algorithm.input ? [h('dt', {}, T('input')), h('dd', {}, algorithm.input)] : null,
          algorithm.output ? [h('dt', {}, T('output')), h('dd', {}, algorithm.output)] : null,
        )
      : null,
    algorithm.steps?.length
      ? h(
          'div',
          { class: 'algo-steps' },
          h('h3', {}, T('howItWorks')),
          diagramFrame(activityDiagram(algorithm.steps, label), {
            kind: 'UML · activity',
            title: algorithm.name,
          }),
          h(
            'details',
            { class: 'text-version' },
            h('summary', {}, T('textVersion')),
            stepsAsText(algorithm.steps),
          ),
        )
      : null,
    algorithm.examples?.length
      ? h(
          'div',
          { class: 'examples' },
          h('h3', {}, T('examples')),
          h(
            'div',
            { class: 'table-wrap' },
            h(
              'table',
              {},
              h(
                'thead',
                {},
                h(
                  'tr',
                  {},
                  h('th', {}, T('given')),
                  h('th', {}, T('result')),
                  algorithm.examples.some((example) => example.note)
                    ? h('th', {}, T('note'))
                    : null,
                ),
              ),
              h(
                'tbody',
                {},
                algorithm.examples.map((example) =>
                  h(
                    'tr',
                    {},
                    h('td', {}, example.given),
                    h('td', {}, h('strong', {}, example.result)),
                    algorithm.examples.some((item) => item.note)
                      ? h('td', { class: 'muted' }, example.note ?? '')
                      : null,
                  ),
                ),
              ),
            ),
          ),
        )
      : null,
    algorithm.rules?.length
      ? h(
          'div',
          { class: 'callout is-rule' },
          h('h3', {}, icon('check', 16), T('rules')),
          bulletList(algorithm.rules),
        )
      : null,
    algorithm.pitfalls?.length
      ? h(
          'div',
          { class: 'callout is-pitfall' },
          h('h3', {}, icon('alert', 16), T('pitfalls')),
          bulletList(algorithm.pitfalls),
        )
      : null,
    algorithm.complexity
      ? h(
          'p',
          { class: 'complexity' },
          h('strong', {}, `${T('complexity')}: `),
          algorithm.complexity,
        )
      : null,
    algorithm.symbols.length
      ? h(
          'div',
          { class: 'snippets' },
          algorithm.symbols.map((key) => snippet(key)),
        )
      : null,
  )
}

export function pageModule(route) {
  const module = moduleById.get(route.id)
  if (!module) return pageNotFound()
  const group = groupById.get(module.group)
  const flows = DATA.flows.filter((flow) => flow.participants.includes(module.id))
  const symptoms = DATA.symptoms.filter((symptom) =>
    symptom.checks.some((check) => check.module === module.id),
  )
  const diagrams = (module.diagrams ?? []).map((id) => diagramById.get(id)).filter(Boolean)
  const order = DATA.overview?.readingOrder?.length
    ? DATA.overview.readingOrder
    : DATA.modules.map((item) => item.id)
  const position = order.indexOf(module.id)
  const sequence = position === -1 ? DATA.modules.map((item) => item.id) : order
  const index = sequence.indexOf(module.id)
  const prev = moduleById.get(sequence[index - 1])
  const next = moduleById.get(sequence[index + 1])

  const toc = [
    ...module.algorithms.map((algorithm) => [
      `alg-${algorithm.id}`,
      algorithm.name,
      moduleHref(module.id, algorithm.id),
    ]),
    ...(diagrams.length ? [['diagrams', T('diagrams'), null]] : []),
    ['isi', T('exportsTitle'), moduleHref(module.id, 'isi')],
  ]

  const article = h(
    'article',
    { class: 'doc' },
    h(
      'nav',
      { class: 'crumbs', 'aria-label': 'breadcrumb' },
      h('a', { href: href('peta', module.layer) }, layerOfModule(module)?.name),
      icon('chevron', 14),
      h('span', {}, group?.name),
    ),
    h('h1', {}, module.name),
    h('p', { class: 'lead' }, module.summary),
    h(
      'div',
      { class: 'meta-row' },
      layerChip(module.layer),
      module.files.map((file, fileIndex) =>
        codeLink(file, 1, fileIndex === 0 ? file : basename(file)),
      ),
      h(
        'span',
        { class: 'muted small' },
        `${T('lines', module.lines)} · ${T('algorithmCount', module.algorithms.length)}`,
      ),
      h(
        'button',
        {
          class: 'btn btn-small',
          type: 'button',
          onclick: (event) => copyText(module.files[0], event.currentTarget),
        },
        icon('copy', 14),
        T('copyPath'),
      ),
    ),
    module.description
      ? h(
          'section',
          { class: 'prose' },
          h('h2', { class: 'sr' }, T('why')),
          paragraphs(module.description),
        )
      : null,
    h(
      'section',
      { class: 'card card-flat' },
      h('h2', { class: 'h-small' }, T('relations')),
      h('p', { class: 'muted small' }, T('relationsLead')),
      relationDiagram(module),
      module.externals.length
        ? h(
            'div',
            { class: 'externals' },
            h('span', { class: 'muted small' }, `${T('externals')}:`),
            module.externals.map((name) => h('code', { class: 'chip' }, name)),
          )
        : null,
    ),
    module.rules?.length
      ? h(
          'div',
          { class: 'callout is-rule' },
          h('h3', {}, icon('check', 16), T('rules')),
          bulletList(module.rules),
        )
      : null,
    module.pitfalls?.length
      ? h(
          'div',
          { class: 'callout is-pitfall' },
          h('h3', {}, icon('alert', 16), T('pitfalls')),
          bulletList(module.pitfalls),
        )
      : null,
    module.algorithms.map((algorithm) => algorithmSection(module, algorithm)),
    diagrams.length
      ? h(
          'section',
          { id: 'diagrams' },
          h('h2', {}, T('diagrams')),
          diagrams.map((diagram) => diagramBlock(diagram)),
        )
      : null,
    h(
      'section',
      { id: 'alg-isi', class: 'exports' },
      h('h2', {}, T('exportsTitle')),
      h('p', { class: 'muted small' }, T('exportsLead')),
      module.exports.length
        ? h(
            'div',
            { class: 'table-wrap' },
            h(
              'table',
              { class: 'export-table' },
              h(
                'tbody',
                {},
                module.exports.map((entry) =>
                  h(
                    'tr',
                    {},
                    h('td', { class: 'nowrap' }, codeLink(entry.file, entry.line, entry.name)),
                    h('td', { class: 'muted small' }, entry.kind),
                    h('td', {}, entry.doc || h('span', { class: 'muted' }, '—')),
                    h(
                      'td',
                      { class: 'nowrap small' },
                      entry.kind === 'function'
                        ? entry.explained
                          ? h('span', { class: 'ok' }, `✓ ${T('explained')}`)
                          : h('span', { class: 'warn' }, T('notExplained'))
                        : '',
                    ),
                  ),
                ),
              ),
            ),
          )
        : h('p', { class: 'muted' }, T('none')),
    ),
    module.tests?.length
      ? h(
          'section',
          {},
          h('h2', { class: 'h-small' }, T('tests')),
          h(
            'ul',
            { class: 'link-list' },
            module.tests.map((file) => h('li', {}, codeLink(file, 1, file))),
          ),
        )
      : null,
    flows.length
      ? h(
          'section',
          {},
          h('h2', { class: 'h-small' }, T('inFlows')),
          h(
            'div',
            { class: 'chips' },
            flows.map((flow) =>
              h('a', { class: 'chip', href: href('alur', flow.id) }, icon('flow', 14), flow.name),
            ),
          ),
        )
      : null,
    symptoms.length
      ? h(
          'section',
          {},
          h('h2', { class: 'h-small' }, T('inSymptoms')),
          h(
            'ul',
            { class: 'link-list' },
            symptoms.map((symptom) =>
              h(
                'li',
                {},
                h('a', { href: href('masalah', symptom.id) }, icon('alert', 15), symptom.title),
              ),
            ),
          ),
        )
      : null,
    h(
      'nav',
      { class: 'pager' },
      prev
        ? h(
            'a',
            { class: 'pager-link', href: moduleHref(prev.id) },
            h('span', { class: 'muted small' }, `← ${T('prev')}`),
            h('strong', {}, prev.name),
          )
        : h('span'),
      next
        ? h(
            'a',
            { class: 'pager-link is-next', href: moduleHref(next.id) },
            h('span', { class: 'muted small' }, `${T('next')} →`),
            h('strong', {}, next.name),
          )
        : h('span'),
    ),
    footer(),
  )

  const aside = h(
    'aside',
    { class: 'toc' },
    h('div', { class: 'toc-title' }, T('onThisPage')),
    h(
      'ul',
      {},
      toc.map(([id, label, link]) =>
        h(
          'li',
          {},
          h(
            'a',
            {
              href: link ?? `#${id}`,
              'data-target': id,
              onclick: link
                ? null
                : (event) => {
                    event.preventDefault()
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                  },
            },
            label,
          ),
        ),
      ),
    ),
  )

  return h('div', { class: 'page page-doc' }, article, aside)
}

export function diagramBlock(diagram) {
  const kind = diagram.type === 'class' ? 'UML · class' : 'UML · state'
  return h(
    'div',
    { class: 'diagram-block', id: `diagram-${diagram.id}` },
    h('h3', {}, diagram.name),
    diagram.summary ? h('p', { class: 'muted' }, diagram.summary) : null,
    diagramFrame(graphDiagram(diagram), { kind, title: diagram.name }),
  )
}
