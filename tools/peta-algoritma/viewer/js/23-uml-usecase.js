// UML use case diagram (an actor, a system boundary, one ellipse per flow) and the UML
// package diagram of the layers on the start page.

import { DATA, href, s, T } from './00-core.js'
import {
  font,
  haloLabel,
  line,
  path,
  svgRoot,
  textLines,
  textWidth,
  widest,
  wrapText,
} from './10-uml-common.js'

export function useCaseDiagram(title, flows, actorName) {
  const spec = font(13, 500)
  const items = flows.map((flow) => {
    const lines = wrapText(flow.name, spec, 210)
    const w = Math.max(190, widest(lines, spec) + 54)
    return { flow, lines, w, h: Math.max(42, lines.length * 16 + 22) }
  })
  const gap = 14
  const actorX = 46
  const boxX = 128
  const boxW = Math.max(...items.map((item) => item.w)) + 56
  const titleH = 34
  let y = titleH + 10
  for (const item of items) {
    item.cy = y + item.h / 2
    y += item.h + gap
  }
  const boxH = y - gap + 16
  const height = boxH + 20
  const width = boxX + boxW + 16
  const svg = svgRoot(width, height, `${T('kindUseCase')[0]}: ${title}`)
  svg.classList.add('uml-usecase')
  const actorY = Math.max(40, Math.min(boxH / 2, height - 70))

  svg.append(
    s('rect', { x: boxX, y: 8, width: boxW, height: boxH, rx: 4, class: 'uml-boundary' }),
    textLines(boxX + 12, 30, [title], { size: 12.5, weight: 700, anchor: 'start' }),
  )
  const cx = boxX + boxW / 2
  for (const item of items) {
    const left = cx - item.w / 2
    svg.append(line(actorX + 14, actorY - 4, left, item.cy, 'uml-association'))
    const link = s(
      'a',
      { href: href('alur', item.flow.id), class: 'uml-usecase-link' },
      s('ellipse', { cx, cy: item.cy, rx: item.w / 2, ry: item.h / 2, class: 'uml-box' }),
      textLines(cx, item.cy + 5 - ((item.lines.length - 1) * 16) / 2, item.lines, {
        size: 13,
        weight: 500,
        lineHeight: 16,
      }),
    )
    link.append(s('title', {}, item.flow.summary))
    svg.append(link)
  }
  const top = actorY - 34
  svg.append(
    s(
      'g',
      { class: 'uml-head is-actor' },
      s('circle', { cx: actorX, cy: top + 8, r: 8, class: 'uml-actor' }),
      path(
        `M${actorX} ${top + 16}V${top + 36}M${actorX - 13} ${top + 23}H${actorX + 13}M${actorX} ${top + 36}l-10 13M${actorX} ${top + 36}l10 13`,
        'uml-actor',
      ),
      textLines(actorX, top + 68, [actorName], { size: 12.5, weight: 600 }),
    ),
  )
  return svg
}

/** Layers as UML packages, top to bottom, with «use» dependencies taken from mayUse. */
export function packageDiagram(available = 560) {
  const layers = DATA.layers
  const nameSpec = font(14, 700)
  const groupSpec = font(12.5)
  const width = Math.max(320, Math.min(640, available))
  const innerW = width - 140
  const packs = layers.map((layer) => {
    const groups = DATA.groups.filter((group) => group.layer === layer.id)
    const count = DATA.modules.filter((module) => module.layer === layer.id).length
    const groupText = groups.map((group) => group.name).join(' · ')
    const lines = wrapText(groupText, groupSpec, innerW - 24)
    const summary = wrapText(layer.summary, font(12), innerW - 24)
    return { layer, count, lines, summary, h: 46 + summary.length * 16 + lines.length * 17 }
  })
  const gap = 46
  let y = 10
  for (const pack of packs) {
    pack.y = y + 18
    y = pack.y + pack.h + gap
  }
  const height = y - gap + 14
  const svg = svgRoot(width, height, T('architecture'))
  svg.classList.add('uml-package')
  const x = 70
  packs.forEach((pack, index) => {
    const tabW = textWidth(pack.layer.name, nameSpec) + 30
    const group = s('a', {
      href: href('peta', pack.layer.id),
      class: 'uml-package-link',
      style: { '--layer': pack.layer.color ?? 'var(--accent)' },
    })
    group.append(
      s('path', {
        d: `M${x} ${pack.y}V${pack.y - 18}H${x + tabW}V${pack.y}`,
        class: 'uml-box uml-package-tab',
      }),
      s('rect', { x, y: pack.y, width: innerW, height: pack.h, class: 'uml-box' }),
      s('rect', { x, y: pack.y, width: 5, height: pack.h, class: 'uml-head-stripe' }),
      textLines(x + 14, pack.y - 4, [pack.layer.name], { size: 13, weight: 700, anchor: 'start' }),
      textLines(x + 18, pack.y + 22, [`«layer» · ${T('moduleCount', pack.count)}`], {
        size: 11.5,
        italic: true,
        anchor: 'start',
        cls: 'uml-sub',
      }),
      textLines(x + 18, pack.y + 42, pack.summary, { size: 12, anchor: 'start', lineHeight: 16 }),
      textLines(x + 18, pack.y + 46 + pack.summary.length * 16, pack.lines, {
        size: 12.5,
        anchor: 'start',
        lineHeight: 17,
        cls: 'uml-groups',
      }),
    )
    group.append(s('title', {}, pack.layer.summary))
    svg.append(group)
    // «use» to the next layer down.
    const next = packs[index + 1]
    if (next && (pack.layer.mayUse ?? [next.layer.id]).includes(next.layer.id)) {
      const ax = x + innerW / 2
      svg.append(line(ax, pack.y + pack.h, ax, next.y - 20, 'uml-dependency is-dashed', 'm-open'))
      svg.append(
        haloLabel(ax + 8, pack.y + pack.h + gap / 2 + 2, '«use»', {
          anchor: 'start',
          size: 11.5,
          italic: true,
        }),
      )
    }
  })
  // Skipping a layer (UI straight to Core) is drawn along the left side.
  packs.forEach((pack, index) => {
    for (const target of packs.slice(index + 2)) {
      if (!(pack.layer.mayUse ?? []).includes(target.layer.id)) continue
      const lx = x - 26 - index * 10
      svg.append(
        path(
          `M${x} ${pack.y + pack.h / 2}H${lx}V${target.y + target.h / 2}H${x - 2}`,
          'uml-dependency is-dashed',
          'm-open',
        ),
      )
      svg.append(
        haloLabel(lx - 4, (pack.y + target.y + target.h) / 2, '«use»', {
          anchor: 'end',
          size: 11.5,
          italic: true,
        }),
      )
    }
  })
  return svg
}
