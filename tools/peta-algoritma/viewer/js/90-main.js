// Routing and start-up.

import { currentRoute, DATA, flowById, h, moduleById, T } from './00-core.js'
import { installMarkers } from './10-uml-common.js'
import {
  afterRender,
  cleanups,
  NAV,
  renderShell,
  toggleSidebar,
  updateSidebar,
} from './30-shell.js'
import { pageHome } from './40-page-home.js'
import { pageMap } from './41-page-map.js'
import { pageModule } from './42-page-module.js'
import { pageFlows } from './43-page-flows.js'
import { pageProblems } from './44-page-problems.js'
import {
  pageDiagrams,
  pageFiles,
  pageGlossary,
  pageLegend,
  pageNotFound,
} from './45-page-reference.js'

const PAGES = {
  home: pageHome,
  peta: pageMap,
  m: pageModule,
  alur: pageFlows,
  masalah: pageProblems,
  diagram: pageDiagrams,
  istilah: pageGlossary,
  berkas: pageFiles,
  uml: pageLegend,
}

function pageTitle(route) {
  if (route.page === 'm') return moduleById.get(route.id)?.name
  if (route.page === 'alur' && route.id) return flowById.get(route.id)?.name
  const nav = NAV.find(([page]) => page === route.page)
  return nav ? T(nav[1]) : null
}

function scrollTarget(route) {
  if (route.page === 'm' && route.sub) return document.getElementById(`alg-${route.sub}`)
  if (route.page === 'masalah' && route.id) return document.getElementById(`problem-${route.id}`)
  if (route.page === 'istilah' && route.id) return document.getElementById(`term-${route.id}`)
  if (route.page === 'diagram' && route.id) return document.getElementById(`diagram-${route.id}`)
  return null
}

let lastPage = null

export function render() {
  while (cleanups.length > 0) cleanups.pop()()
  const route = currentRoute()
  const page = PAGES[route.page] ?? pageNotFound
  const main = document.getElementById('main')
  let content
  try {
    content = page(route)
  } catch (error) {
    console.error(error)
    content = h(
      'div',
      { class: 'page' },
      h('h1', {}, 'Error'),
      h('pre', { class: 'code' }, String(error?.stack ?? error)),
    )
  }
  main.replaceChildren(content)
  updateSidebar(route)
  toggleSidebar(false)
  const title = pageTitle(route)
  document.title = title ? `${title} · ${DATA.meta.title}` : DATA.meta.title
  const samePage = lastPage === `${route.page}/${route.id}`
  lastPage = `${route.page}/${route.id}`
  requestAnimationFrame(() => {
    // Callbacks may queue more (a diagram drawn after layout queues its own check).
    while (afterRender.length > 0) afterRender.shift()()
    const target = scrollTarget(route)
    if (target) target.scrollIntoView({ block: 'start' })
    else if (!samePage) window.scrollTo(0, 0)
  })
}

installMarkers()
renderShell()
addEventListener('hashchange', render)
render()
