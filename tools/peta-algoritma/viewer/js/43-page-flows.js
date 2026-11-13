// Flows: use case diagrams per category on the index, and for each flow a UML sequence
// diagram with a step list that highlights together with the diagram.

import {
  categoryById,
  DATA,
  flowById,
  h,
  href,
  icon,
  moduleById,
  moduleChip,
  symbolLink,
  T,
} from './00-core.js'
import { diagramFrame } from './10-uml-common.js'
import { sequenceDiagram } from './21-uml-sequence.js'
import { useCaseDiagram } from './23-uml-usecase.js'
import { footer } from './40-page-home.js'
import { pageNotFound } from './45-page-reference.js'

function flowCategories() {
  const groups = DATA.categories
    .map((category) => ({
      category,
      flows: DATA.flows.filter((flow) => flow.category === category.id),
    }))
    .filter((group) => group.flows.length > 0)
  const rest = DATA.flows.filter((flow) => !flow.category || !categoryById.has(flow.category))
  if (rest.length) groups.push({ category: { id: 'lain', name: T('otherFlows') }, flows: rest })
  return groups
}

function actorNameOf(flows) {
  for (const flow of flows)
    for (const actor of flow.actors ?? [])
      if ((actor.type ?? 'actor') === 'actor') return actor.name
  return T('actor')
}

export function pageFlows(route) {
  if (route.id) return pageFlow(route.id)
  return h(
    'div',
    { class: 'page' },
    h(
      'header',
      { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'UML · use case → sequence'),
      h('h1', {}, T('flows')),
      h('p', { class: 'lead' }, T('flowsLead')),
    ),
    flowCategories().map(({ category, flows }) =>
      h(
        'section',
        { class: 'card usecase-card' },
        h('h2', {}, category.name),
        category.summary ? h('p', { class: 'muted' }, category.summary) : null,
        h(
          'div',
          { class: 'usecase-layout' },
          diagramFrame(
            useCaseDiagram(`${DATA.meta.system} · ${category.name}`, flows, actorNameOf(flows)),
            { kind: 'UML · use case', title: category.name },
          ),
          h(
            'ul',
            { class: 'flow-list' },
            flows.map((flow) =>
              h(
                'li',
                {},
                h(
                  'a',
                  { href: href('alur', flow.id) },
                  h('strong', {}, flow.name),
                  h('span', { class: 'muted' }, flow.summary),
                ),
                h('span', { class: 'muted small' }, T('steps', countMessages(flow.messages))),
              ),
            ),
          ),
        ),
      ),
    ),
    footer(),
  )
}

function countMessages(messages) {
  return messages.reduce(
    (sum, message) =>
      sum +
      ('fragment' in message
        ? countMessages(message.messages) +
          (message.else ?? []).reduce((acc, operand) => acc + countMessages(operand.messages), 0)
        : 1),
    0,
  )
}

function participantName(flow, id) {
  return (
    moduleById.get(id)?.name ?? (flow.actors ?? []).find((actor) => actor.id === id)?.name ?? id
  )
}

function pageFlow(id) {
  const flow = flowById.get(id)
  if (!flow) return pageNotFound()
  const { svg, rows } = sequenceDiagram(flow)
  const items = []
  const highlightRow = (index, on) => {
    rows[index]?.group.classList.toggle('is-hot', on)
    items[index]?.classList.toggle('is-hot', on)
  }
  rows.forEach(({ group }, index) => {
    group.addEventListener('mouseenter', () => highlightRow(index, true))
    group.addEventListener('mouseleave', () => highlightRow(index, false))
  })

  const list = h(
    'ol',
    { class: 'step-list' },
    rows.map(({ row }, index) => {
      const { message } = row
      const item = h(
        'li',
        {
          class: ['step', row.kind === 'return' && 'is-return'],
          onmouseenter: () => highlightRow(index, true),
          onmouseleave: () => highlightRow(index, false),
        },
        h('span', { class: 'step-num' }, row.number ? String(row.number) : '↩'),
        h(
          'div',
          { class: 'step-body' },
          h(
            'div',
            { class: 'step-head' },
            h(
              'span',
              { class: 'step-who' },
              participantName(flow, message.from),
              message.from === message.to ? '' : ` → ${participantName(flow, message.to)}`,
            ),
            h('code', { class: 'step-text' }, message.text),
            row.kind === 'return'
              ? h('span', { class: 'tag' }, T('reply'))
              : row.kind === 'async'
                ? h('span', { class: 'tag' }, 'async')
                : null,
          ),
          message.note ? h('p', {}, message.note) : null,
          message.ref ? h('div', {}, symbolLink(message.ref)) : null,
        ),
      )
      items.push(item)
      return item
    }),
  )

  const involved = flow.participants.filter((participant) => moduleById.has(participant))
  const index = DATA.flows.indexOf(flow)
  const prev = DATA.flows[index - 1]
  const next = DATA.flows[index + 1]

  return h(
    'div',
    { class: 'page page-wide' },
    h(
      'header',
      { class: 'page-head' },
      h(
        'nav',
        { class: 'crumbs' },
        h('a', { href: href('alur') }, T('flows')),
        icon('chevron', 14),
        h('span', {}, categoryById.get(flow.category)?.name ?? T('otherFlows')),
      ),
      h('p', { class: 'eyebrow' }, 'UML · sequence'),
      h('h1', {}, flow.name),
      h('p', { class: 'lead' }, flow.summary),
    ),
    flow.trigger || flow.result
      ? h(
          'div',
          { class: 'pre-post' },
          flow.trigger
            ? h(
                'div',
                { class: 'callout is-info' },
                h('h3', {}, T('trigger')),
                h('p', {}, flow.trigger),
              )
            : null,
          flow.result
            ? h(
                'div',
                { class: 'callout is-rule' },
                h('h3', {}, T('flowResult')),
                h('p', {}, flow.result),
              )
            : null,
        )
      : null,
    diagramFrame(svg, { kind: 'UML · sequence', title: flow.name, wide: true }),
    h(
      'section',
      { class: 'card card-flat' },
      h('h2', { class: 'h-small' }, T('stepList')),
      h('p', { class: 'muted small' }, T('stepListLead')),
      list,
    ),
    h(
      'section',
      {},
      h('h2', { class: 'h-small' }, T('involved')),
      h(
        'div',
        { class: 'chips' },
        involved.map((module) => moduleChip(module)),
      ),
    ),
    h(
      'nav',
      { class: 'pager' },
      prev
        ? h(
            'a',
            { class: 'pager-link', href: href('alur', prev.id) },
            h('span', { class: 'muted small' }, `← ${T('prev')}`),
            h('strong', {}, prev.name),
          )
        : h('span'),
      next
        ? h(
            'a',
            { class: 'pager-link is-next', href: href('alur', next.id) },
            h('span', { class: 'muted small' }, `${T('next')} →`),
            h('strong', {}, next.name),
          )
        : h('span'),
    ),
    footer(),
  )
}
