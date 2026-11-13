// UML sequence diagram: lifelines for modules, actors and databases; synchronous, async and
// reply messages; activation bars from a simulated call stack; alt/opt/loop/par fragments.

import { basename, layerColor, moduleById, moduleHref, s, T } from './00-core.js'
import {
  font,
  haloLabel,
  line,
  path,
  svgCodeLink,
  svgRoot,
  textLines,
  textWidth,
  widest,
  wrapText,
} from './10-uml-common.js'

const SEQ = {
  side: 30,
  gapMin: 44,
  rowH: 40,
  selfH: 52,
  fragStart: 34,
  fragElse: 30,
  fragEnd: 16,
  bar: 10,
}

export function sequenceDiagram(flow) {
  const actors = new Map((flow.actors ?? []).map((actor) => [actor.id, actor]))
  const nameSpec = font(12.5, 600)
  const subSpec = font(11, 400, true)
  const parts = flow.participants.map((id) => {
    const module = moduleById.get(id)
    const actor = actors.get(id)
    const kind = module ? 'module' : (actor?.type ?? 'actor')
    const name = module ? module.name : (actor?.name ?? id)
    const nameLines = wrapText(name, nameSpec, 150)
    const sub = module ? basename(module.files[0]) : ''
    const w = Math.max(
      kind === 'module' ? 100 : 80,
      widest(nameLines, nameSpec) + 24,
      sub ? textWidth(sub, subSpec) + 24 : 0,
    )
    return {
      id,
      module,
      kind,
      name,
      nameLines,
      sub,
      w,
      color: module ? layerColor(module.layer) : null,
    }
  })
  const position = new Map(parts.map((part, index) => [part.id, index]))
  const headH = Math.max(
    ...parts.map((part) =>
      part.kind === 'actor'
        ? 46 + part.nameLines.length * 15
        : part.kind === 'database'
          ? 30 + part.nameLines.length * 15 + 16
          : part.nameLines.length * 15 + (part.sub ? 15 : 0) + 18,
    ),
  )

  // Flatten messages and fragments into rows.
  const rows = []
  let number = 0
  const walk = (messages, depth) => {
    for (const message of messages) {
      if ('fragment' in message) {
        const fragment = { kind: message.fragment, label: message.label, depth }
        rows.push({ type: 'start', fragment })
        walk(message.messages, depth + 1)
        for (const operand of message.else ?? []) {
          rows.push({ type: 'else', fragment, label: operand.label })
          walk(operand.messages, depth + 1)
        }
        rows.push({ type: 'end', fragment })
      } else {
        const kind = message.kind ?? 'call'
        rows.push({
          type: 'msg',
          message,
          kind,
          self: message.from === message.to,
          number: kind === 'return' ? null : ++number,
        })
      }
    }
  }
  walk(flow.messages, 0)

  const labelOf = (row) => {
    const prefix = row.number ? `${row.number}: ` : ''
    return `${prefix}${row.kind === 'create' ? '«create» ' : ''}${row.message.text}`
  }
  const labelSpec = font(12, 500)

  // Column gaps wide enough for every label between two lifelines.
  const gaps = parts
    .slice(1)
    .map((part, index) => Math.max(SEQ.gapMin, (parts[index].w + part.w) / 2 + 28))
  let rightRoom = parts.at(-1).w / 2 + SEQ.side
  for (const row of rows) {
    if (row.type !== 'msg') continue
    const need = textWidth(labelOf(row), labelSpec) + 30
    const a = position.get(row.message.from)
    const b = position.get(row.message.to)
    if (a === b) {
      if (a < gaps.length) gaps[a] = Math.max(gaps[a], need + 44)
      else rightRoom = Math.max(rightRoom, need + 52)
      continue
    }
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const span = gaps.slice(lo, hi).reduce((sum, gap) => sum + gap, 0)
    if (span < need) gaps[hi - 1] += need - span
  }

  // Fragments: participant span and nesting padding.
  const fragments = []
  rows.forEach((row, index) => {
    if (row.type !== 'start') return
    let depth = 0
    let lo = Infinity
    let hi = -Infinity
    for (let k = index + 1; k < rows.length; k++) {
      const other = rows[k]
      if (other.type === 'start') depth++
      if (other.type === 'end') {
        if (depth === 0 && other.fragment === row.fragment) break
        depth--
      }
      if (other.type === 'msg') {
        for (const id of [other.message.from, other.message.to]) {
          lo = Math.min(lo, position.get(id))
          hi = Math.max(hi, position.get(id))
        }
      }
    }
    fragments.push(
      Object.assign(row.fragment, {
        lo: lo === Infinity ? 0 : lo,
        hi: hi === -Infinity ? parts.length - 1 : hi,
      }),
    )
  })
  const maxDepth = Math.max(0, ...fragments.map((fragment) => fragment.depth + 1))
  const leftRoom = SEQ.side + maxDepth * 10 + 10

  const xs = []
  parts.forEach((part, index) => {
    xs.push(index === 0 ? leftRoom + part.w / 2 : xs[index - 1] + gaps[index - 1])
  })

  // Rows top to bottom.
  let cursor = headH + 22
  for (const row of rows) {
    row.top = cursor
    if (row.type === 'msg') cursor += row.self ? SEQ.selfH : SEQ.rowH
    else if (row.type === 'start') cursor += SEQ.fragStart
    else if (row.type === 'else') cursor += SEQ.fragElse
    else cursor += SEQ.fragEnd
  }
  const height = cursor + 22

  let width = xs.at(-1) + rightRoom
  for (const fragment of fragments) {
    const pad = 18 + (maxDepth - fragment.depth - 1) * 10
    fragment.x1 = xs[fragment.lo] - parts[fragment.lo].w / 2 - pad + 10
    const tagW = textWidth(fragment.kind, font(11.5, 700)) + 18
    const guardW = textWidth(`[${fragment.label}]`, font(12, 400, false, true)) + 16
    fragment.x2 = Math.max(
      xs[fragment.hi] + parts[fragment.hi].w / 2 + pad - 10,
      fragment.x1 + tagW + guardW + 12,
    )
    width = Math.max(width, fragment.x2 + 12)
  }

  // Activation bars from a simulated call stack.
  const isBox = (id) => parts[position.get(id)].kind !== 'actor'
  const bars = []
  const stack = []
  const msgRows = rows.filter((row) => row.type === 'msg')
  const yOf = (row) => row.top + (row.self ? 22 : 27)
  let lastY = headH + 22
  const close = (frame, y) =>
    bars.push({
      id: frame.id,
      from: frame.start,
      to: Math.max(y, frame.start + 14),
      depth: frame.depth,
    })
  const depthOf = (id) => stack.filter((frame) => frame.id === id).length
  const unwindTo = (id) => {
    while (stack.length > 0 && stack.at(-1).id !== id) close(stack.pop(), lastY + 8)
  }
  for (const row of msgRows) {
    const y = yOf(row)
    const { from, to } = row.message
    if (row.kind === 'return') {
      unwindTo(from)
      const frame = stack.at(-1)?.id === from ? stack.pop() : null
      if (frame) close(frame, y)
    } else {
      if (stack.some((frame) => frame.id === from)) unwindTo(from)
      else {
        while (stack.length > 0) close(stack.pop(), lastY + 8)
        if (isBox(from)) stack.push({ id: from, start: y - 10, depth: 0 })
      }
      if (row.self) bars.push({ id: from, from: y + 4, to: y + 20, depth: depthOf(from) })
      else if (row.kind === 'async')
        bars.push({ id: to, from: y - 4, to: y + 12, depth: depthOf(to) })
      else if (isBox(to)) stack.push({ id: to, start: y, depth: depthOf(to) })
    }
    lastY = y + (row.self ? 20 : 0)
  }
  while (stack.length > 0) close(stack.pop(), lastY + 12)

  const svg = svgRoot(width, height, `${T('flows')}: ${flow.name}`)
  svg.classList.add('uml-sequence')

  // Fragment boxes behind everything; their tags and guards above lifelines and bars.
  const fragmentLayer = s('g', { class: 'uml-fragments' })
  const fragmentLabels = s('g', { class: 'uml-fragment-labels' })
  for (const row of rows) {
    const fragment = row.fragment
    if (row.type === 'start') {
      fragment.top = row.top + 4
      const tagW = textWidth(fragment.kind, font(11.5, 700)) + 18
      fragment.group = s('g', { class: 'uml-fragment' })
      fragmentLabels.append(
        s('path', {
          d: `M${fragment.x1} ${fragment.top}h${tagW}v12l-6 7H${fragment.x1}z`,
          class: 'uml-fragment-tag',
        }),
        textLines(fragment.x1 + 7, fragment.top + 14, [fragment.kind], {
          size: 11.5,
          weight: 700,
          anchor: 'start',
        }),
        haloLabel(fragment.x1 + tagW + 8, fragment.top + 14, `[${fragment.label}]`, {
          anchor: 'start',
          size: 12,
          italic: true,
          cls: 'uml-guard',
        }),
      )
      fragmentLayer.append(fragment.group)
    } else if (row.type === 'else') {
      const y = row.top + 8
      fragment.group.append(line(fragment.x1, y, fragment.x2, y, 'uml-separator'))
      fragmentLabels.append(
        haloLabel(fragment.x1 + 8, y + 15, `[${row.label}]`, {
          anchor: 'start',
          size: 12,
          italic: true,
          cls: 'uml-guard',
        }),
      )
    } else if (row.type === 'end') {
      const bottom = row.top + 6
      fragment.group.prepend(
        s('rect', {
          x: fragment.x1,
          y: fragment.top,
          width: fragment.x2 - fragment.x1,
          height: bottom - fragment.top,
          rx: 3,
          class: 'uml-fragment-box',
        }),
      )
    }
  }
  svg.append(fragmentLayer)

  // Lifelines and heads.
  parts.forEach((part, index) => {
    const x = xs[index]
    svg.append(line(x, headH + 6, x, height - 8, 'uml-lifeline'))
    const head = s('g', {
      class: ['uml-head', `is-${part.kind}`],
      style: part.color ? { '--layer': part.color } : undefined,
    })
    if (part.kind === 'actor') {
      head.append(
        s('circle', { cx: x, cy: 10, r: 7, class: 'uml-actor' }),
        path(`M${x} 17V33M${x - 11} 23H${x + 11}M${x} 33l-9 11M${x} 33l9 11`, 'uml-actor'),
        textLines(x, 60, part.nameLines, { size: 12.5, weight: 600, lineHeight: 15 }),
      )
    } else if (part.kind === 'database') {
      const w = part.w - 16
      const top = 6
      head.append(
        s('path', {
          d: `M${x - w / 2} ${top + 7}v${headH - 26}a${w / 2} 7 0 0 0 ${w} 0v${-(headH - 26)}`,
          class: 'uml-box',
        }),
        s('ellipse', { cx: x, cy: top + 7, rx: w / 2, ry: 7, class: 'uml-box' }),
        textLines(x, top + 32, part.nameLines, { size: 12.5, weight: 600, lineHeight: 15 }),
      )
    } else {
      const top = 2
      const boxH = headH - 4
      head.append(
        s('rect', {
          x: x - part.w / 2,
          y: top,
          width: part.w,
          height: boxH,
          rx: 5,
          class: 'uml-box',
        }),
        s('rect', {
          x: x - part.w / 2,
          y: top,
          width: part.w,
          height: 4,
          rx: 2,
          class: 'uml-head-stripe',
        }),
        textLines(
          x,
          top + boxH / 2 - ((part.nameLines.length - 1) * 15 + (part.sub ? 15 : 0)) / 2 + 5,
          part.nameLines,
          { size: 12.5, weight: 600, lineHeight: 15 },
        ),
        part.sub
          ? textLines(x, top + boxH / 2 + ((part.nameLines.length - 1) * 15) / 2 + 16, [part.sub], {
              size: 11,
              mono: true,
              cls: 'uml-sub',
            })
          : null,
      )
    }
    if (part.module) {
      const link = s('a', { href: moduleHref(part.id), class: 'uml-head-link' }, head)
      link.append(s('title', {}, `${part.name} — ${part.module.files[0]}`))
      svg.append(link)
    } else svg.append(head)
  })

  // Activation bars.
  for (const bar of bars) {
    const x = xs[position.get(bar.id)] - SEQ.bar / 2 + bar.depth * 6
    svg.append(
      s('rect', {
        x,
        y: bar.from,
        width: SEQ.bar,
        height: bar.to - bar.from,
        class: 'uml-activation',
      }),
    )
  }

  svg.append(fragmentLabels)

  // Messages.
  const groups = []
  for (const row of msgRows) {
    const { from, to } = row.message
    const a = position.get(from)
    const b = position.get(to)
    const y = yOf(row)
    const group = s('g', { class: ['uml-msg', `is-${row.kind}`], 'data-row': groups.length })
    const label = labelOf(row)
    if (row.self) {
      const x = xs[a] + (isBox(from) ? SEQ.bar / 2 : 0)
      group.append(
        path(`M${x} ${y}H${x + 32}V${y + 16}H${x + SEQ.bar + 2}`, 'uml-message', 'm-filled'),
      )
      group.append(
        haloLabel(x + 40, y + 4, label, { anchor: 'start', size: 12, cls: 'uml-msg-label' }),
      )
    } else {
      const dir = b > a ? 1 : -1
      const x1 = xs[a] + (isBox(from) ? (dir * SEQ.bar) / 2 : 0)
      const x2 = xs[b] - (isBox(to) ? (dir * SEQ.bar) / 2 : 0)
      const marker = row.kind === 'call' ? 'm-filled' : 'm-open'
      group.append(
        line(
          x1,
          y,
          x2 - dir,
          y,
          ['uml-message', row.kind === 'return' || row.kind === 'create' ? 'is-dashed' : ''].join(
            ' ',
          ),
          marker,
        ),
      )
      group.append(
        haloLabel((x1 + x2) / 2, y - 7, label, {
          size: 12,
          italic: row.kind === 'return',
          cls: 'uml-msg-label',
        }),
      )
    }
    // A wide invisible strip makes the whole row easy to point at.
    group.prepend(
      s('rect', {
        x: Math.min(xs[a], xs[b]) - 8,
        y: y - 22,
        width: Math.abs(xs[b] - xs[a]) + (row.self ? 200 : 16),
        height: 30,
        class: 'uml-hit',
      }),
    )
    if (row.message.ref) svgCodeLink(group, row.message.ref)
    svg.append(group)
    groups.push({ row, group })
  }

  return { svg, rows: groups }
}
