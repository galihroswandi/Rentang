// Start page: what this is, the architecture in one package diagram, the golden rules,
// the main data path, a learning route, the kinds of UML diagrams, and common problems.

import {
  DATA,
  formatDate,
  h,
  href,
  icon,
  layerChip,
  layerColor,
  moduleById,
  moduleHref,
  s,
  T,
} from './00-core.js'
import { diagramFrame } from './10-uml-common.js'
import { packageDiagram } from './23-uml-usecase.js'
import { onNextPaint } from './30-shell.js'

export function percent(part, whole) {
  return whole === 0 ? 100 : Math.round((part / whole) * 100)
}

export function statChip(value, label, tone = '') {
  return h('div', { class: ['stat', tone] }, h('strong', {}, value), h('span', {}, label))
}

export function pageHome() {
  const stats = DATA.stats
  const overview = DATA.overview ?? {}
  const coverage = percent(stats.filesMapped + stats.filesIgnored, stats.files)
  const explained = percent(stats.exportsExplained, stats.exports)
  const route = overview.readingOrder ?? []
  const firstModule = route[0] ?? DATA.modules[0]?.id

  const kinds = [
    'kindUseCase',
    'kindSequence',
    'kindComponent',
    'kindActivity',
    'kindClass',
    'kindState',
  ]
  const kindPage = { flows: href('alur'), map: href('peta'), diagrams: href('diagram') }

  return h(
    'div',
    { class: 'page page-home' },
    h(
      'section',
      { class: 'hero' },
      h('p', { class: 'eyebrow' }, T('welcome')),
      h('h1', {}, DATA.meta.title),
      DATA.meta.description ? h('p', { class: 'lead' }, DATA.meta.description) : null,
      overview.intro ? h('p', { class: 'hero-intro' }, overview.intro) : null,
      h(
        'div',
        { class: 'stat-row' },
        statChip(stats.modules, T('modules')),
        statChip(stats.algorithms, T('algorithms')),
        statChip(stats.flows, T('flows')),
        statChip(stats.diagrams + stats.flows + stats.algorithms, T('umlDiagrams')),
        statChip(`${coverage}%`, T('coverage'), coverage === 100 ? 'is-good' : 'is-warn'),
        statChip(`${explained}%`, T('explainedExports'), explained === 100 ? 'is-good' : 'is-warn'),
      ),
      h(
        'div',
        { class: 'hero-actions' },
        firstModule
          ? h(
              'a',
              { class: 'btn btn-primary', href: moduleHref(firstModule) },
              T('startReading'),
              icon('arrow', 16),
            )
          : null,
        h('a', { class: 'btn', href: href('peta') }, icon('map', 16), T('map')),
        h('a', { class: 'btn', href: href('masalah') }, icon('alert', 16), T('problems')),
      ),
    ),

    h(
      'section',
      { class: 'home-grid' },
      architectureCard(),
      overview.principles?.length
        ? h(
            'div',
            { class: 'card' },
            h('h2', {}, T('principles')),
            h(
              'ol',
              { class: 'principles' },
              overview.principles.map((principle) =>
                h('li', {}, h('strong', {}, principle.title), h('span', {}, principle.text)),
              ),
            ),
          )
        : null,
    ),

    overview.pipeline?.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', {}, T('pipeline')),
          h('p', { class: 'muted' }, T('pipelineLead')),
          h(
            'ol',
            { class: 'pipeline' },
            overview.pipeline.map((step, index) => {
              const module = moduleById.get(step.module)
              return h(
                'li',
                {},
                h(
                  'a',
                  {
                    class: 'pipe-step',
                    href: moduleHref(step.module),
                    style: { '--layer': layerColor(module.layer) },
                  },
                  h('span', { class: 'pipe-num' }, String(index + 1)),
                  h(
                    'span',
                    { class: 'pipe-body' },
                    h('strong', {}, module.name),
                    h('span', {}, step.caption),
                  ),
                  layerChip(module.layer),
                ),
              )
            }),
          ),
        )
      : null,

    route.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', {}, T('readingOrder')),
          h('p', { class: 'muted' }, T('readingLead')),
          h(
            'ol',
            { class: 'route' },
            route.map((id) => {
              const module = moduleById.get(id)
              return h(
                'li',
                { style: { '--layer': layerColor(module.layer) } },
                h(
                  'a',
                  { href: moduleHref(id) },
                  h('strong', {}, module.name),
                  h('span', { class: 'muted' }, module.summary),
                ),
                h(
                  'span',
                  { class: 'route-meta' },
                  layerChip(module.layer),
                  h(
                    'span',
                    { class: 'muted small' },
                    T('algorithmCount', module.algorithms.length),
                  ),
                ),
              )
            }),
          ),
        )
      : null,

    h(
      'section',
      { class: 'card' },
      h('h2', {}, T('umlKinds')),
      h('p', { class: 'muted' }, T('umlKindsLead')),
      h(
        'div',
        { class: 'kind-grid' },
        kinds.map((key) => {
          const [title, text, page] = T(key)
          return h(
            'a',
            { class: 'kind-card', href: kindPage[page] },
            h('span', { class: 'kind-mark' }, umlGlyph(key)),
            h('strong', {}, title),
            h('span', { class: 'muted' }, text),
          )
        }),
      ),
    ),

    DATA.symptoms.length
      ? h(
          'section',
          { class: 'card' },
          h(
            'div',
            { class: 'card-head' },
            h('h2', {}, T('problems')),
            h('a', { href: href('masalah') }, T('seeAll'), ' →'),
          ),
          h('p', { class: 'muted' }, T('problemsLead')),
          h(
            'ul',
            { class: 'link-list' },
            DATA.symptoms
              .slice(0, 6)
              .map((symptom) =>
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
      'section',
      { class: 'card' },
      h('h2', {}, T('howTo')),
      h(
        'dl',
        { class: 'shortcuts' },
        T('howToItems').map(([key, text]) => [h('dt', {}, h('kbd', {}, key)), h('dd', {}, text)]),
      ),
    ),
    footer(),
  )
}

function architectureCard() {
  const holder = h('div', { class: 'package-holder' })
  // Drawn after layout, at the width the card actually has.
  onNextPaint(() =>
    holder.replaceChildren(
      diagramFrame(packageDiagram(holder.clientWidth - 16), {
        kind: 'UML · package',
        legend: true,
      }),
    ),
  )
  return h(
    'div',
    { class: 'card' },
    h('h2', {}, T('architecture')),
    h('p', { class: 'muted' }, T('architectureLead')),
    holder,
  )
}

export function footer() {
  return h(
    'footer',
    { class: 'page-footer' },
    T('generated', formatDate(DATA.meta.generatedAt), DATA.meta.commit),
  )
}

/** A tiny drawing of each diagram kind's most typical notation. */
function umlGlyph(kind) {
  const g = s('svg', {
    viewBox: '0 0 48 32',
    width: 48,
    height: 32,
    'aria-hidden': 'true',
    class: 'glyph',
  })
  const add = (...children) => g.append(...children)
  switch (kind) {
    case 'kindUseCase':
      add(
        s('circle', { cx: 7, cy: 7, r: 3 }),
        s('path', { d: 'M7 10v8M3 13h8M7 18l-3 5M7 18l3 5M12 16h8' }),
        s('ellipse', { cx: 34, cy: 16, rx: 12, ry: 6 }),
      )
      break
    case 'kindSequence':
      add(
        s('rect', { x: 2, y: 2, width: 14, height: 7, rx: 1 }),
        s('rect', { x: 32, y: 2, width: 14, height: 7, rx: 1 }),
        s('path', { d: 'M9 9v21M39 9v21', class: 'dash' }),
        s('path', { d: 'M10 16h27M33 13l4 3-4 3', class: 'solid' }),
        s('path', { d: 'M38 24H12M15 21l-4 3 4 3', class: 'dash' }),
      )
      break
    case 'kindComponent':
      add(
        s('rect', { x: 6, y: 5, width: 26, height: 22, rx: 1 }),
        s('rect', { x: 3, y: 10, width: 7, height: 4 }),
        s('rect', { x: 3, y: 18, width: 7, height: 4 }),
        s('path', { d: 'M33 16h12M41 12l4 4-4 4', class: 'dash' }),
      )
      break
    case 'kindActivity':
      add(
        s('circle', { cx: 24, cy: 4, r: 3, class: 'fill' }),
        s('path', { d: 'M24 7v4' }),
        s('rect', { x: 12, y: 11, width: 24, height: 8, rx: 4 }),
        s('path', { d: 'M24 19v3M24 22l4 4-4 4-4-4z' }),
      )
      break
    case 'kindClass':
      add(
        s('rect', { x: 3, y: 4, width: 18, height: 24 }),
        s('path', { d: 'M3 11h18M3 20h18M21 16h8M29 16l4-3 4 3-4 3z' }),
        s('rect', { x: 37, y: 9, width: 9, height: 14 }),
      )
      break
    default:
      add(
        s('circle', { cx: 5, cy: 16, r: 3, class: 'fill' }),
        s('path', { d: 'M8 16h5M11 14l2 2-2 2' }),
        s('rect', { x: 14, y: 9, width: 14, height: 14, rx: 5 }),
        s('path', { d: 'M28 16h6M32 14l2 2-2 2' }),
        s('circle', { cx: 40, cy: 16, r: 5 }),
        s('circle', { cx: 40, cy: 16, r: 2.5, class: 'fill' }),
      )
  }
  return g
}
