// "Something wrong?": symptoms as a developer sees them, each with suspects in order of
// likelihood, the code to open, and how to confirm.

import {
  categoryById,
  DATA,
  h,
  href,
  icon,
  moduleById,
  moduleChip,
  symbolLink,
  T,
} from './00-core.js'
import { normalise } from './30-shell.js'
import { footer } from './40-page-home.js'
import { render } from './90-main.js'

const problemState = { query: '', category: null }

export function pageProblems(route) {
  const openId = route.id
  const input = h('input', {
    type: 'search',
    class: 'filter-input',
    placeholder: T('filterProblems'),
    value: problemState.query,
    'aria-label': T('filterProblems'),
  })
  const list = h('div', { class: 'problem-list' })
  const categories = DATA.categories.filter((category) =>
    DATA.symptoms.some((symptom) => symptom.category === category.id),
  )

  const card = (symptom) =>
    h(
      'details',
      { class: 'problem', id: `problem-${symptom.id}`, open: symptom.id === openId },
      h(
        'summary',
        {},
        icon('alert', 17),
        h('span', { class: 'problem-title' }, symptom.title),
        categoryById.get(symptom.category)
          ? h('span', { class: 'tag' }, categoryById.get(symptom.category).name)
          : null,
      ),
      h(
        'div',
        { class: 'problem-body' },
        h('h3', { class: 'h-small' }, T('suspects')),
        h(
          'ol',
          { class: 'suspects' },
          symptom.checks.map((check) =>
            h(
              'li',
              {},
              h(
                'div',
                { class: 'suspect-head' },
                moduleChip(check.module),
                check.ref ? symbolLink(check.ref) : null,
              ),
              h('p', {}, check.why),
            ),
          ),
        ),
        symptom.verify
          ? h(
              'div',
              { class: 'callout is-info' },
              h('h3', {}, T('verify')),
              h('p', {}, symptom.verify),
            )
          : null,
        symptom.tip
          ? h('div', { class: 'callout is-rule' }, h('h3', {}, T('tip')), h('p', {}, symptom.tip))
          : null,
        h('a', { class: 'small', href: href('masalah', symptom.id) }, '#'),
      ),
    )

  const paint = () => {
    const words = normalise(problemState.query).split(/\s+/).filter(Boolean)
    const shown = DATA.symptoms.filter((symptom) => {
      if (problemState.category && symptom.category !== problemState.category) return false
      const text = normalise(
        [
          symptom.title,
          symptom.tip ?? '',
          ...symptom.checks.map(
            (check) =>
              `${check.why} ${moduleById.get(check.module)?.name ?? ''} ${check.code ?? ''}`,
          ),
        ].join(' '),
      )
      return words.every((word) => text.includes(word))
    })
    list.replaceChildren(
      ...(shown.length ? shown.map(card) : [h('p', { class: 'muted' }, T('noProblems'))]),
    )
  }
  input.addEventListener('input', () => {
    problemState.query = input.value
    paint()
  })
  paint()

  const chips = categories.length
    ? h(
        'div',
        { class: 'toggle-row' },
        [{ id: null, name: T('all') }, ...categories].map((category) =>
          h(
            'button',
            {
              type: 'button',
              class: 'toggle',
              'aria-pressed': String(problemState.category === category.id),
              onclick: () => {
                problemState.category = category.id
                render()
              },
            },
            category.name,
          ),
        ),
      )
    : null

  return h(
    'div',
    { class: 'page' },
    h(
      'header',
      { class: 'page-head' },
      h('h1', {}, T('problemsTitle')),
      h('p', { class: 'lead' }, T('problemsLead')),
    ),
    h('div', { class: 'filter-bar' }, input, chips),
    list,
    footer(),
  )
}
