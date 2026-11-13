// The frame around every page: top bar, docs-style sidebar, global search, theme, and the
// "open code in" choice. Pages render into <main>.

import {
  CAN_EDITOR,
  CAN_GITHUB,
  codeTarget,
  DATA,
  h,
  href,
  icon,
  moduleById,
  moduleHref,
  prefs,
  SYMBOLS,
  T,
} from './00-core.js'
import { render } from './90-main.js'

export const afterRender = []
export const cleanups = []
export const onNextPaint = (callback) => afterRender.push(callback)
export const onLeave = (callback) => cleanups.push(callback)

export const NAV = [
  ['home', 'home', 'home'],
  ['peta', 'map', 'map'],
  ['alur', 'flows', 'flow'],
  ['masalah', 'problems', 'alert'],
  ['diagram', 'diagrams', 'diagram'],
  ['istilah', 'glossary', 'book'],
  ['berkas', 'files', 'file'],
  ['uml', 'uml', 'help'],
]

function effectiveTheme() {
  const set = document.documentElement.dataset.theme
  if (set === 'dark' || set === 'light') return set
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function renderShell() {
  const app = document.getElementById('app')
  const menuButton = h(
    'button',
    {
      class: 'icon-btn menu-btn',
      type: 'button',
      'aria-label': T('menu'),
      'aria-controls': 'sidebar',
      'aria-expanded': 'false',
    },
    icon('menu', 20),
  )
  const themeButton = h('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': T('theme'),
    title: T('theme'),
  })
  const paintTheme = () =>
    themeButton.replaceChildren(icon(effectiveTheme() === 'dark' ? 'sun' : 'moon', 19))
  paintTheme()
  themeButton.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    prefs.set('theme', next)
    paintTheme()
  })

  const targets = [
    ...(CAN_EDITOR ? ['vscode', 'cursor', 'idea'] : []),
    ...(CAN_GITHUB ? ['github'] : []),
  ]
  const targetSelect =
    targets.length > 1
      ? h(
          'label',
          { class: 'target' },
          h('span', { class: 'target-label' }, T('openIn')),
          h(
            'select',
            {
              onchange: (event) => {
                prefs.set('target', event.target.value)
                render()
              },
            },
            targets.map((target) =>
              h(
                'option',
                { value: target, selected: target === codeTarget() },
                T('editorNames')[target],
              ),
            ),
          ),
        )
      : null

  const searchButton = h(
    'button',
    { class: 'search-btn', type: 'button', 'aria-haspopup': 'dialog', onclick: () => openSearch() },
    icon('search', 17),
    h('span', {}, T('searchHint')),
    h('kbd', {}, '/'),
  )

  const repo = DATA.meta.repository
  app.replaceChildren(
    h(
      'a',
      {
        class: 'skip',
        href: '#main',
        onclick: (event) => {
          event.preventDefault()
          document.getElementById('main').focus()
        },
      },
      T('skip'),
    ),
    h(
      'header',
      { class: 'topbar' },
      menuButton,
      h(
        'a',
        { class: 'brand', href: href() },
        h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, icon('component', 18)),
        h('span', { class: 'brand-name' }, DATA.meta.title),
      ),
      searchButton,
      h(
        'div',
        { class: 'top-actions' },
        targetSelect,
        themeButton,
        repo
          ? h(
              'a',
              {
                class: 'icon-btn',
                href: repo.url,
                target: '_blank',
                rel: 'noreferrer',
                title: repo.url,
                'aria-label': 'GitHub',
              },
              icon('external', 18),
            )
          : null,
      ),
    ),
    h(
      'div',
      { class: 'frame' },
      h('nav', { class: 'sidebar', id: 'sidebar', 'aria-label': T('menu') }, sidebarContent()),
      h('div', { class: 'scrim', onclick: () => toggleSidebar(false) }),
      h('main', { id: 'main', tabindex: '-1' }),
    ),
  )

  menuButton.addEventListener('click', () => toggleSidebar())
}

export function toggleSidebar(open) {
  const body = document.body
  const next = open ?? !body.classList.contains('nav-open')
  body.classList.toggle('nav-open', next)
  document.querySelector('.menu-btn')?.setAttribute('aria-expanded', String(next))
}

function sidebarContent() {
  const primary = h(
    'ul',
    { class: 'nav-list' },
    NAV.map(([page, key, iconName]) =>
      h(
        'li',
        {},
        h(
          'a',
          { class: 'nav-link', href: page === 'home' ? href() : href(page), 'data-page': page },
          icon(iconName, 17),
          h('span', {}, T(key)),
        ),
      ),
    ),
  )
  const tree = DATA.layers.map((layer) =>
    h(
      'details',
      {
        class: 'nav-layer',
        open: true,
        'data-layer': layer.id,
        style: { '--layer': layer.color ?? 'var(--accent)' },
      },
      h(
        'summary',
        {},
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        layer.name,
        h(
          'span',
          { class: 'count' },
          String(DATA.modules.filter((module) => module.layer === layer.id).length),
        ),
      ),
      DATA.groups
        .filter((group) => group.layer === layer.id)
        .map((group) =>
          h(
            'div',
            { class: 'nav-group' },
            h('div', { class: 'nav-group-name' }, group.name),
            h(
              'ul',
              { class: 'nav-list' },
              DATA.modules
                .filter((module) => module.group === group.id)
                .map((module) =>
                  h(
                    'li',
                    {},
                    h(
                      'a',
                      {
                        class: 'nav-link nav-module',
                        href: moduleHref(module.id),
                        'data-module': module.id,
                      },
                      module.name,
                    ),
                  ),
                ),
            ),
          ),
        ),
    ),
  )
  return [primary, h('div', { class: 'nav-heading' }, T('modules')), tree]
}

export function updateSidebar(route) {
  for (const link of document.querySelectorAll('.sidebar .nav-link')) {
    const active = link.dataset.module
      ? route.page === 'm' && route.id === link.dataset.module
      : link.dataset.page === route.page
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
  const current = document.querySelector('.sidebar [aria-current="page"]')
  if (current) {
    const layer = current.closest('details')
    if (layer) layer.open = true
    const box = current.getBoundingClientRect()
    const nav = document.getElementById('sidebar').getBoundingClientRect()
    if (box.top < nav.top || box.bottom > nav.bottom) current.scrollIntoView({ block: 'center' })
  }
}

// ---- Search ----------------------------------------------------------------------------
export const normalise = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

let searchIndex = null
function buildSearchIndex() {
  const entries = []
  const add = (kind, title, subtitle, link, extra = '') =>
    entries.push({
      kind,
      title,
      subtitle,
      href: link,
      text: normalise(`${title} ${subtitle} ${extra}`),
      name: normalise(title),
    })
  for (const [page, key] of NAV) add('page', T(key), '', page === 'home' ? href() : href(page))
  for (const module of DATA.modules) {
    add(
      'module',
      module.name,
      module.summary,
      moduleHref(module.id),
      `${module.id} ${module.files.join(' ')}`,
    )
    for (const algorithm of module.algorithms) {
      add(
        'algorithm',
        algorithm.name,
        `${module.name} · ${algorithm.summary}`,
        moduleHref(module.id, algorithm.id),
      )
      for (const key of algorithm.symbols) {
        const symbol = SYMBOLS[key]
        if (symbol)
          add(
            'symbol',
            symbol.name,
            `${symbol.file}:${symbol.line} · ${algorithm.name}`,
            moduleHref(module.id, algorithm.id),
          )
      }
    }
    for (const entry of module.exports) {
      if (entry.kind === 'function' && !entry.explained)
        add(
          'symbol',
          entry.name,
          `${entry.file}:${entry.line} · ${module.name}`,
          moduleHref(module.id, 'isi'),
        )
    }
  }
  for (const file of DATA.files) {
    const owner = file.modules[0]
    add(
      'file',
      file.path,
      owner ? moduleById.get(owner).name : T('ignored'),
      owner ? moduleHref(owner) : href('berkas'),
    )
  }
  for (const flow of DATA.flows) add('flow', flow.name, flow.summary, href('alur', flow.id))
  for (const symptom of DATA.symptoms)
    add(
      'symptom',
      symptom.title,
      [...new Set(symptom.checks.map((check) => moduleById.get(check.module)?.name))].join(' · '),
      href('masalah', symptom.id),
      symptom.tip ?? '',
    )
  for (const term of DATA.glossary)
    add('term', term.term, term.definition, href('istilah', slug(term.term)))
  for (const diagram of DATA.diagrams)
    add('diagram', diagram.name, diagram.summary ?? '', href('diagram', diagram.id))
  return entries
}

export const slug = (text) =>
  normalise(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const KIND_ORDER = [
  'page',
  'module',
  'algorithm',
  'symptom',
  'flow',
  'symbol',
  'diagram',
  'term',
  'file',
]

function searchFor(query) {
  searchIndex ??= buildSearchIndex()
  const words = normalise(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const scored = []
  for (const entry of searchIndex) {
    if (!words.every((word) => entry.text.includes(word))) continue
    const joined = words.join(' ')
    const score =
      (entry.name === joined
        ? 6
        : entry.name.startsWith(joined)
          ? 4
          : entry.name.includes(joined)
            ? 3
            : 1) -
      KIND_ORDER.indexOf(entry.kind) * 0.05
    scored.push({ entry, score })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map(({ entry }) => entry)
}

let searchDialog = null
function openSearch(initial = '') {
  if (searchDialog) return
  const input = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: T('searchHint'),
    'aria-label': T('search'),
    autocomplete: 'off',
    spellcheck: 'false',
  })
  const list = h('ul', { class: 'search-results', role: 'listbox', id: 'search-results' })
  let results = []
  let active = 0
  const go = (entry) => {
    closeSearch()
    location.hash = entry.href
  }
  const paint = () => {
    list.replaceChildren()
    if (input.value.trim() === '') return
    if (results.length === 0) {
      list.append(h('li', { class: 'search-empty' }, T('searchEmpty')))
      return
    }
    let lastKind = null
    results.forEach((entry, index) => {
      if (entry.kind !== lastKind) {
        list.append(
          h('li', { class: 'search-kind', role: 'presentation' }, T('searchKinds')[entry.kind]),
        )
        lastKind = entry.kind
      }
      list.append(
        h(
          'li',
          {
            role: 'option',
            id: `sr-${index}`,
            class: ['search-item', index === active && 'is-active'],
            'aria-selected': String(index === active),
            onmousemove: () => {
              if (active !== index) {
                active = index
                paint()
              }
            },
            onclick: () => go(entry),
          },
          h('span', { class: 'search-title' }, entry.title),
          entry.subtitle ? h('span', { class: 'search-sub' }, entry.subtitle) : null,
        ),
      )
    })
    input.setAttribute('aria-activedescendant', `sr-${active}`)
    document.getElementById(`sr-${active}`)?.scrollIntoView({ block: 'nearest' })
  }
  input.addEventListener('input', () => {
    results = searchFor(input.value)
    active = 0
    paint()
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length
      paint()
    } else if (event.key === 'Enter' && results[active]) go(results[active])
  })
  input.setAttribute('aria-controls', 'search-results')
  searchDialog = h(
    'div',
    {
      class: 'search-layer',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': T('search'),
      onclick: (event) => {
        if (event.target === searchDialog) closeSearch()
      },
    },
    h(
      'div',
      { class: 'search-panel' },
      h('div', { class: 'search-field' }, icon('search', 18), input, h('kbd', {}, 'Esc')),
      list,
    ),
  )
  document.body.append(searchDialog)
  input.value = initial
  input.dispatchEvent(new Event('input'))
  input.focus()
}

function closeSearch() {
  searchDialog?.remove()
  searchDialog = null
}

function isTyping(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (searchDialog) closeSearch()
    else toggleSidebar(false)
    return
  }
  if ((event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    openSearch()
  } else if (event.key === '/' && !isTyping(event.target) && !searchDialog) {
    event.preventDefault()
    openSearch()
  }
})
