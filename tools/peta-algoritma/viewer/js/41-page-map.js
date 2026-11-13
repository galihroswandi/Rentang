// Architecture page: a UML component diagram. Layers are packages, groups are nested
// packages, modules are components. Dependencies (from the code's imports) are drawn as
// dashed «use» arrows for the module under the pointer or keyboard focus.

import {
  basename,
  DATA,
  flowById,
  h,
  href,
  icon,
  layerById,
  layerColor,
  moduleById,
  moduleHref,
  s,
  T,
} from './00-core.js'
import { path } from './10-uml-common.js'
import { onLeave, onNextPaint } from './30-shell.js'
import { render } from './90-main.js'

const mapState = { hidden: new Set(), flow: null }

export function pageMap(route) {
  if (route.id && layerById.has(route.id)) {
    mapState.hidden = new Set(
      DATA.layers.filter((layer) => layer.id !== route.id).map((layer) => layer.id),
    )
  }
  const cards = new Map()
  const flow = mapState.flow ? flowById.get(mapState.flow) : null
  const order = new Map()
  if (flow) {
    let n = 0
    for (const id of flow.participants) if (moduleById.has(id)) order.set(id, ++n)
  }

  const component = (module) => {
    const card = h(
      'a',
      {
        class: [
          'comp',
          flow && !order.has(module.id) && 'is-dim',
          order.has(module.id) && 'is-flow',
        ],
        href: moduleHref(module.id),
        'data-id': module.id,
        style: { '--layer': layerColor(module.layer) },
      },
      h('span', { class: 'comp-icon', 'aria-hidden': 'true' }, icon('component', 15)),
      h('span', { class: 'comp-name' }, module.name),
      h('span', { class: 'comp-sum' }, module.summary),
      h(
        'span',
        { class: 'comp-meta' },
        basename(module.files[0]),
        module.files.length > 1 ? ` +${module.files.length - 1}` : '',
        ` · ${T('algorithmCount', module.algorithms.length)}`,
      ),
      order.has(module.id)
        ? h('span', { class: 'comp-badge' }, String(order.get(module.id)))
        : null,
    )
    card.addEventListener('mouseenter', () => focusModule(module.id))
    card.addEventListener('focus', () => focusModule(module.id))
    card.addEventListener('mouseleave', () => focusModule(null))
    card.addEventListener('blur', () => focusModule(null))
    cards.set(module.id, card)
    return card
  }

  const visibleLayers = DATA.layers.filter((layer) => !mapState.hidden.has(layer.id))
  const packages = []
  visibleLayers.forEach((layer, index) => {
    packages.push(
      h(
        'section',
        {
          class: 'pkg',
          style: { '--layer': layer.color ?? 'var(--accent)' },
          'aria-label': layer.name,
        },
        h('div', { class: 'pkg-tab' }, h('span', { class: 'stereo' }, '«layer»'), layer.name),
        h('p', { class: 'pkg-sum' }, layer.summary),
        h(
          'div',
          { class: 'pkg-groups' },
          DATA.groups
            .filter((group) => group.layer === layer.id)
            .map((group) =>
              h(
                'section',
                { class: 'subpkg' },
                h('h3', { class: 'subpkg-tab' }, group.name),
                h(
                  'div',
                  { class: 'comps' },
                  DATA.modules.filter((module) => module.group === group.id).map(component),
                ),
              ),
            ),
        ),
      ),
    )
    const next = visibleLayers[index + 1]
    if (next && (layer.mayUse ?? [next.id]).includes(next.id)) {
      packages.push(
        h(
          'div',
          { class: 'pkg-dep', 'aria-hidden': 'true' },
          h('span', {}, T('mayUse', next.name)),
        ),
      )
    }
  })

  const edgeLayer = s('svg', { class: 'cmap-edges', 'aria-hidden': 'true' })
  const diagram = h('div', { class: 'cmap' }, packages, edgeLayer)

  function focusModule(id) {
    edgeLayer.replaceChildren()
    for (const card of cards.values())
      card.classList.remove('is-focus', 'is-dep', 'is-user', 'is-faded')
    if (!id) {
      if (flow) drawFlow()
      return
    }
    const module = moduleById.get(id)
    const deps = new Set(module.deps.map((dep) => dep.to))
    const users = new Set(module.usedBy)
    for (const [other, card] of cards) {
      if (other === id) card.classList.add('is-focus')
      else if (deps.has(other)) card.classList.add('is-dep')
      else if (users.has(other)) card.classList.add('is-user')
      else card.classList.add('is-faded')
    }
    for (const dep of module.deps) drawEdge(id, dep.to, 'is-dep')
    for (const user of module.usedBy) drawEdge(user, id, 'is-user')
  }

  function rectOf(id) {
    const card = cards.get(id)
    if (!card) return null
    const box = diagram.getBoundingClientRect()
    const r = card.getBoundingClientRect()
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }
  }

  function drawEdge(from, to, cls) {
    const a = rectOf(from)
    const b = rectOf(to)
    if (!a || !b) return
    const ax = a.x + a.w / 2
    const ay = a.y + a.h / 2
    const bx = b.x + b.w / 2
    const by = b.y + b.h / 2
    let d
    if (Math.abs(by - ay) < Math.max(a.h, b.h) / 2) {
      const right = bx > ax
      const x1 = right ? a.x + a.w : a.x
      const x2 = right ? b.x : b.x + b.w
      const lift = Math.min(40, Math.abs(x2 - x1) / 3 + 12)
      d = `M${x1} ${ay - 6}C${x1 + (right ? 1 : -1) * 30} ${ay - lift} ${x2 - (right ? 1 : -1) * 30} ${by - lift} ${x2} ${by - 6}`
    } else {
      const down = by > ay
      const y1 = down ? a.y + a.h : a.y
      const y2 = down ? b.y : b.y + b.h
      const bend = Math.max(28, Math.abs(y2 - y1) / 2)
      d = `M${ax} ${y1}C${ax} ${y1 + (down ? bend : -bend)} ${bx} ${y2 - (down ? bend : -bend)} ${bx} ${y2}`
    }
    edgeLayer.append(path(d, `cmap-edge ${cls}`, cls === 'is-flow' ? 'm-open-accent' : 'm-open'))
  }

  function drawFlow() {
    const seen = new Set()
    const walk = (messages) => {
      for (const message of messages) {
        if ('fragment' in message) {
          walk(message.messages)
          for (const operand of message.else ?? []) walk(operand.messages)
          continue
        }
        if ((message.kind ?? 'call') === 'return' || message.from === message.to) continue
        if (!moduleById.has(message.from) || !moduleById.has(message.to)) continue
        const key = `${message.from}>${message.to}`
        if (seen.has(key)) continue
        seen.add(key)
        drawEdge(message.from, message.to, 'is-flow')
      }
    }
    walk(flow.messages)
  }

  const redraw = () => {
    edgeLayer.setAttribute('width', diagram.offsetWidth)
    edgeLayer.setAttribute('height', diagram.offsetHeight)
    focusModule(null)
  }
  onNextPaint(redraw)
  const onResize = () => redraw()
  addEventListener('resize', onResize)
  onLeave(() => removeEventListener('resize', onResize))

  const layerToggles = h(
    'div',
    { class: 'toggle-row', role: 'group', 'aria-label': T('filterLayers') },
    DATA.layers.map((layer) =>
      h(
        'button',
        {
          type: 'button',
          class: 'toggle',
          'aria-pressed': String(!mapState.hidden.has(layer.id)),
          style: { '--layer': layer.color ?? 'var(--accent)' },
          onclick: () => {
            if (mapState.hidden.has(layer.id)) mapState.hidden.delete(layer.id)
            else if (mapState.hidden.size < DATA.layers.length - 1) mapState.hidden.add(layer.id)
            if (route.id) location.hash = href('peta')
            else render()
          },
        },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        layer.name,
      ),
    ),
  )

  const flowSelect = h(
    'label',
    { class: 'select-label' },
    h('span', {}, T('highlightFlow')),
    h(
      'select',
      {
        onchange: (event) => {
          mapState.flow = event.target.value || null
          render()
        },
      },
      h('option', { value: '' }, T('noFlow')),
      DATA.flows.map((item) =>
        h('option', { value: item.id, selected: item.id === mapState.flow }, item.name),
      ),
    ),
  )

  return h(
    'div',
    { class: 'page page-wide' },
    h(
      'header',
      { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'UML · component'),
      h('h1', {}, T('map')),
      h('p', { class: 'lead' }, T('mapLead')),
    ),
    h(
      'div',
      { class: 'map-toolbar' },
      layerToggles,
      flowSelect,
      flow ? h('a', { class: 'small', href: href('alur', flow.id) }, `${T('openFlow')} →`) : null,
      h(
        'div',
        { class: 'legend' },
        h('span', {}, h('i', { class: 'lg-dep' }), T('uses')),
        h('span', {}, h('i', { class: 'lg-user' }), T('usedBy')),
        h('span', {}, h('i', { class: 'lg-flow' }), T('flowOrder')),
      ),
    ),
    flow ? h('p', { class: 'flow-note' }, h('strong', {}, flow.name), ' — ', flow.summary) : null,
    diagram,
  )
}
