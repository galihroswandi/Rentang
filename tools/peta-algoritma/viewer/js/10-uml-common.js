// Shared pieces of every UML diagram: text measuring and wrapping (SVG text does not wrap),
// arrowhead markers, and the frame that makes a diagram scrollable and labelled.

import { codeUrl, h, href, icon, openCode, s, SYMBOLS, T } from './00-core.js'
import { onNextPaint } from './30-shell.js'

const FONT_SANS =
  getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() ||
  'system-ui, sans-serif'
const FONT_MONO =
  getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() ||
  'ui-monospace, monospace'

const measureContext = document.createElement('canvas').getContext('2d')
const measureCache = new Map()

export function font(size, weight = 400, mono = false, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${mono ? FONT_MONO : FONT_SANS}`
}

export function textWidth(text, fontSpec) {
  const key = `${fontSpec}|${text}`
  let width = measureCache.get(key)
  if (width === undefined) {
    measureContext.font = fontSpec
    width = measureContext.measureText(text).width
    measureCache.set(key, width)
  }
  return width
}

/** Breaks `text` into lines no wider than `max` px, splitting long words if needed. */
export function wrapText(text, fontSpec, max) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (textWidth(candidate, fontSpec) <= max) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (textWidth(word, fontSpec) <= max) {
      line = word
      continue
    }
    // A single word wider than the line: cut it.
    let piece = ''
    for (const char of word) {
      if (textWidth(piece + char, fontSpec) > max && piece) {
        lines.push(piece)
        piece = char
      } else piece += char
    }
    line = piece
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

export const widest = (lines, fontSpec) =>
  Math.max(0, ...lines.map((line) => textWidth(line, fontSpec)))

/** One <text> with a <tspan> per line. `anchor` is start, middle or end. */
export function textLines(
  x,
  y,
  lines,
  {
    size = 13,
    weight = 400,
    mono = false,
    italic = false,
    anchor = 'middle',
    lineHeight = size + 4,
    cls = '',
  } = {},
) {
  return s(
    'text',
    {
      x,
      y,
      'text-anchor': anchor,
      class: ['uml-text', mono && 'uml-mono', italic && 'uml-italic', cls],
      'font-size': size,
      'font-weight': weight,
    },
    lines.map((line, index) => s('tspan', { x, dy: index === 0 ? 0 : lineHeight }, line)),
  )
}

// Markers live in one SVG that is rendered but empty, because markers defined inside a
// hidden (display: none) SVG are not drawn in Chrome.
export function installMarkers() {
  const marker = (
    id,
    path,
    { fill = 'none', width = 10, height = 10, refX = 9, refY = 5, size = 8, sizeY = size } = {},
  ) =>
    s(
      'marker',
      {
        id,
        viewBox: `0 0 ${width} ${height}`,
        refX,
        refY,
        markerWidth: size,
        markerHeight: sizeY,
        markerUnits: 'userSpaceOnUse',
        orient: 'auto-start-reverse',
      },
      s('path', { d: path, class: `marker-shape fill-${fill}` }),
    )
  const holder = s(
    'svg',
    { class: 'uml-markers', width: 0, height: 0, 'aria-hidden': 'true' },
    s(
      'defs',
      {},
      marker('m-open', 'M1 1 9 5 1 9', { fill: 'none', size: 10 }),
      marker('m-open-accent', 'M1 1 9 5 1 9', { fill: 'none', size: 10 }),
      marker('m-filled', 'M0 0 10 5 0 10z', { fill: 'solid', size: 9 }),
      marker('m-filled-accent', 'M0 0 10 5 0 10z', { fill: 'solid', size: 9 }),
      marker('m-hollow', 'M1 1 9 5 1 9z', { fill: 'paper', size: 14 }),
      marker('m-diamond', 'M1 5 6 1.5 11 5 6 8.5z', {
        fill: 'solid',
        width: 12,
        refX: 11,
        size: 16,
        sizeY: 13,
      }),
      marker('m-diamond-hollow', 'M1 5 6 1.5 11 5 6 8.5z', {
        fill: 'paper',
        width: 12,
        refX: 11,
        size: 16,
        sizeY: 13,
      }),
    ),
  )
  document.body.append(holder)
}

/** A titled, horizontally scrollable frame around an SVG diagram. */
export function diagramFrame(svgElement, { kind, title, legend = true, wide = false } = {}) {
  const scroll = h('div', { class: 'uml-scroll' }, svgElement)
  const fit = h(
    'button',
    { type: 'button', class: 'uml-fit', hidden: true, 'aria-pressed': 'false' },
    icon('map', 14),
    h('span', {}, T('fitWidth')),
  )
  const frame = h(
    'figure',
    { class: ['uml-frame', wide && 'is-wide'] },
    h(
      'figcaption',
      {},
      h('span', { class: 'uml-kind' }, kind),
      title ? h('span', { class: 'uml-title' }, title) : null,
      h(
        'span',
        { class: 'uml-tools' },
        fit,
        legend
          ? h(
              'a',
              { class: 'uml-help', href: href('uml'), title: T('legendLink') },
              icon('help', 15),
              h('span', {}, T('legendLink')),
            )
          : null,
      ),
    ),
    scroll,
  )
  // Diagrams wider than their frame scroll sideways; a toggle shrinks them to fit instead.
  fit.addEventListener('click', () => {
    const on = !frame.classList.contains('is-fit')
    frame.classList.toggle('is-fit', on)
    fit.setAttribute('aria-pressed', String(on))
    fit.lastChild.textContent = on ? T('actualSize') : T('fitWidth')
  })
  onNextPaint(() => {
    if (
      svgElement.getAttribute &&
      Number(svgElement.getAttribute('width')) > scroll.clientWidth + 4
    )
      fit.hidden = false
  })
  return frame
}

export function svgRoot(width, height, label) {
  const w = Math.ceil(width)
  const hgt = Math.ceil(height)
  return s('svg', {
    class: 'uml',
    width: w,
    height: hgt,
    viewBox: `0 0 ${w} ${hgt}`,
    role: 'img',
    'aria-label': label,
  })
}

/** A clickable code reference inside an SVG: opens the code on click or Enter. */
export function svgCodeLink(element, ref) {
  const symbol = SYMBOLS[ref]
  if (!symbol) return element
  const url = codeUrl(symbol.file, symbol.line)
  if (!url) return element
  element.setAttribute('class', `${element.getAttribute('class') ?? ''} is-link`)
  element.setAttribute('tabindex', '0')
  element.setAttribute('role', 'link')
  element.setAttribute('aria-label', `${symbol.name}, ${symbol.file}:${symbol.line}`)
  element.append(s('title', {}, `${symbol.file}:${symbol.line}`))
  const open = (event) => {
    event.stopPropagation()
    openCode(symbol.file, symbol.line)
  }
  element.addEventListener('click', open)
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') open(event)
  })
  return element
}

export function line(x1, y1, x2, y2, cls = '', end = null, start = null) {
  return s('path', {
    d: `M${x1} ${y1}L${x2} ${y2}`,
    class: ['uml-line', cls],
    ...(end ? { 'marker-end': `url(#${end})` } : {}),
    ...(start ? { 'marker-start': `url(#${start})` } : {}),
  })
}

export function path(d, cls = '', end = null, start = null) {
  return s('path', {
    d,
    class: ['uml-line', cls],
    ...(end ? { 'marker-end': `url(#${end})` } : {}),
    ...(start ? { 'marker-start': `url(#${start})` } : {}),
  })
}

/** A small label with a paper-coloured backdrop so it stays readable over lines. */
export function haloLabel(
  x,
  y,
  text,
  { anchor = 'middle', size = 12, mono = false, italic = false, cls = '' } = {},
) {
  const spec = font(size, 400, mono, italic)
  const width = textWidth(text, spec)
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  return s(
    'g',
    { class: ['uml-label', cls] },
    s('rect', {
      x: left - 3,
      y: y - size + 1,
      width: width + 6,
      height: size + 5,
      rx: 3,
      class: 'uml-halo',
    }),
    textLines(x, y, [text], { size, mono, italic, anchor }),
  )
}
