// UML class and state diagrams. Nodes sit on a grid given in the map file (col, row), so the
// author controls the layout; edges are straight or gently curved, clipped at the shapes.

import { s, T } from './00-core.js'
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

const GRAPH = { gapX: 84, gapY: 64, pad: 24 }

function graphNodeSize(node, type) {
  const kind = node.kind ?? (type === 'class' ? 'class' : 'state')
  if (kind === 'initial') return { kind, w: 18, h: 18 }
  if (kind === 'final') return { kind, w: 24, h: 24 }
  if (kind === 'choice') return { kind, w: 26, h: 26 }
  const nameSpec = font(13, 700)
  const name = node.name ?? node.id
  if (kind === 'note') {
    const lines = (node.text ?? [name]).flatMap((entry) => wrapText(entry, font(12), 220))
    return {
      kind,
      lines,
      w: Math.max(120, widest(lines, font(12)) + 28),
      h: lines.length * 16 + 18,
    }
  }
  if (kind === 'class') {
    const attrSpec = font(12, 400, true)
    const stereo = node.stereotype ? `«${node.stereotype}»` : null
    const attrs = node.attributes ?? []
    const ops = node.operations ?? []
    const w = Math.max(
      150,
      textWidth(name, nameSpec) + 28,
      stereo ? textWidth(stereo, font(11.5, 400, false, true)) + 28 : 0,
      widest(attrs, attrSpec) + 22,
      widest(ops, attrSpec) + 22,
    )
    const headH = (stereo ? 16 : 0) + 30
    const attrH = attrs.length > 0 ? attrs.length * 17 + 12 : 10
    const opH = ops.length > 0 ? ops.length * 17 + 12 : 0
    return { kind, name, stereo, attrs, ops, w, h: headH + attrH + opH, headH, attrH }
  }
  const lines = (node.text ?? []).flatMap((entry) => wrapText(entry, font(12), 200))
  const w = Math.max(104, textWidth(name, nameSpec) + 32, widest(lines, font(12)) + 28)
  return { kind, name, lines, w, h: 34 + (lines.length > 0 ? lines.length * 16 + 10 : 0) }
}

export function graphDiagram(diagram) {
  const nodes = diagram.nodes.map((node) => ({ ...node, ...graphNodeSize(node, diagram.type) }))
  const byNode = new Map(nodes.map((node) => [node.id, node]))
  const cols = Math.max(...nodes.map((node) => node.col))
  const rows = Math.max(...nodes.map((node) => node.row))
  const colW = Array.from({ length: cols }, (_, index) =>
    Math.max(0, ...nodes.filter((node) => node.col === index + 1).map((node) => node.w)),
  )
  const rowH = Array.from({ length: rows }, (_, index) =>
    Math.max(0, ...nodes.filter((node) => node.row === index + 1).map((node) => node.h)),
  )
  // Gaps between columns grow to fit the labels of edges that cross them in one row.
  const labelSpec = font(11.5)
  const gapAfter = Array.from({ length: cols }, () => GRAPH.gapX)
  for (const edge of diagram.edges ?? []) {
    const a = nodes.find((node) => node.id === edge.from)
    const b = nodes.find((node) => node.id === edge.to)
    if (!a || !b || a.row !== b.row || a.col === b.col || !edge.label) continue
    const lo = Math.min(a.col, b.col)
    const hi = Math.max(a.col, b.col)
    const need = textWidth(edge.label, labelSpec) + 44
    const have =
      gapAfter.slice(lo - 1, hi - 1).reduce((sum, gap) => sum + gap, 0) +
      colW.slice(lo, hi - 1).reduce((sum, width) => sum + width, 0)
    if (have < need) gapAfter[hi - 2] += need - have
  }
  const colX = []
  const rowY = []
  colW.forEach((width, index) =>
    colX.push(index === 0 ? GRAPH.pad : colX[index - 1] + colW[index - 1] + gapAfter[index - 1]),
  )
  rowH.forEach((height, index) =>
    rowY.push(index === 0 ? GRAPH.pad : rowY[index - 1] + rowH[index - 1] + GRAPH.gapY),
  )
  for (const node of nodes) {
    node.cx = colX[node.col - 1] + colW[node.col - 1] / 2
    node.cy = rowY[node.row - 1] + rowH[node.row - 1] / 2
  }
  const width = colX.at(-1) + colW.at(-1) + GRAPH.pad
  const height = rowY.at(-1) + rowH.at(-1) + GRAPH.pad
  const svg = svgRoot(
    width,
    height,
    `${diagram.type === 'class' ? T('kindClass')[0] : T('kindState')[0]}: ${diagram.name}`,
  )
  svg.classList.add('uml-graph', `is-${diagram.type}`)

  // Where a ray from the node centre towards (tx, ty) leaves the node's outline.
  const clip = (node, tx, ty) => {
    const dx = tx - node.cx
    const dy = ty - node.cy
    if (dx === 0 && dy === 0) return [node.cx, node.cy]
    if (node.kind === 'initial' || node.kind === 'final') {
      const r = node.w / 2 + 1
      const length = Math.hypot(dx, dy)
      return [node.cx + (dx / length) * r, node.cy + (dy / length) * r]
    }
    if (node.kind === 'choice') {
      const r = node.w / 2
      const scale = r / (Math.abs(dx) + Math.abs(dy))
      return [node.cx + dx * scale, node.cy + dy * scale]
    }
    const scale = Math.min(node.w / 2 / Math.abs(dx || 1e-9), node.h / 2 / Math.abs(dy || 1e-9))
    return [node.cx + dx * scale, node.cy + dy * scale]
  }

  const edges = diagram.edges ?? []
  const pairCount = new Map()
  const pairKey = (edge) => [edge.from, edge.to].sort().join('|')
  for (const edge of edges) pairCount.set(pairKey(edge), (pairCount.get(pairKey(edge)) ?? 0) + 1)
  const pairSeen = new Map()

  const edgeLayer = s('g', { class: 'uml-edges' })
  for (const edge of edges) {
    const a = byNode.get(edge.from)
    const b = byNode.get(edge.to)
    if (!a || !b) continue
    const kind = edge.kind ?? (diagram.type === 'state' ? 'transition' : 'association')
    const dashed = kind === 'dependency' || kind === 'realization' || kind === 'anchor'
    const end =
      {
        navigable: 'm-open',
        transition: 'm-open',
        dependency: 'm-open',
        generalization: 'm-hollow',
        realization: 'm-hollow',
      }[kind] ?? null
    const start = { composition: 'm-diamond', aggregation: 'm-diamond-hollow' }[kind] ?? null
    const cls = ['uml-edge', dashed && 'is-dashed'].filter(Boolean).join(' ')

    if (a === b) {
      // Self transition: a loop over the node's top right corner.
      const x = a.cx + a.w / 2 - 18
      const y = a.cy - a.h / 2
      edgeLayer.append(
        path(
          `M${x - 16} ${y}C${x - 16} ${y - 38} ${x + 34} ${y - 38} ${x + 18} ${y + 1}`,
          cls,
          end,
        ),
      )
      if (edge.label) edgeLayer.append(haloLabel(x + 6, y - 32, edge.label, { size: 11.5 }))
      continue
    }

    const key = pairKey(edge)
    const index = pairSeen.get(key) ?? 0
    pairSeen.set(key, index + 1)
    const count = pairCount.get(key)
    const sign = edge.from < edge.to ? 1 : -1
    const bend = count > 1 ? (index - (count - 1) / 2) * 46 * sign : 0
    const mx = (a.cx + b.cx) / 2
    const my = (a.cy + b.cy) / 2
    const length = Math.hypot(b.cx - a.cx, b.cy - a.cy)
    const nx = -(b.cy - a.cy) / length
    const ny = (b.cx - a.cx) / length
    const qx = mx + nx * bend
    const qy = my + ny * bend
    const [x1, y1] = clip(a, bend ? qx : b.cx, bend ? qy : b.cy)
    const [x2, y2] = clip(b, bend ? qx : a.cx, bend ? qy : a.cy)
    const d = bend ? `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}` : `M${x1} ${y1}L${x2} ${y2}`
    edgeLayer.append(path(d, cls, end, start))

    const at = (t) =>
      bend
        ? [
            (1 - t) ** 2 * x1 + 2 * (1 - t) * t * qx + t ** 2 * x2,
            (1 - t) ** 2 * y1 + 2 * (1 - t) * t * qy + t ** 2 * y2,
          ]
        : [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
    if (edge.label) {
      // On the curve's midpoint, pushed a little further outward so stacked labels separate.
      const [lx, ly] = at(0.5)
      const side = Math.sign(bend)
      const out = bend === 0 ? 0 : side * 9
      // Beside a slanted curve, grow the text away from its partner instead of across it.
      const lean = nx * side
      const anchor = bend === 0 || Math.abs(lean) < 0.3 ? 'middle' : lean > 0 ? 'start' : 'end'
      edgeLayer.append(
        haloLabel(lx + nx * out, ly + ny * out + 4, edge.label, {
          anchor,
          size: 11.5,
          italic: kind !== 'transition',
        }),
      )
    }
    const segment = Math.hypot(x2 - x1, y2 - y1) || 1
    const endLabel = (text, t) => {
      const [px, py] = at(t)
      const ox = nx * 11
      const oy = ny * 11
      edgeLayer.append(
        haloLabel(px + ox, py + oy + 4, text, { size: 11.5, mono: true, cls: 'uml-multiplicity' }),
      )
    }
    if (edge.fromLabel) endLabel(edge.fromLabel, Math.min(0.3, 26 / segment))
    if (edge.toLabel) endLabel(edge.toLabel, Math.max(0.7, 1 - 26 / segment))
  }

  const nodeLayer = s('g', { class: 'uml-nodes' })
  for (const node of nodes) {
    const x = node.cx - node.w / 2
    const y = node.cy - node.h / 2
    const group = s('g', { class: ['uml-node', `is-${node.kind}`] })
    if (node.kind === 'initial')
      group.append(s('circle', { cx: node.cx, cy: node.cy, r: 8, class: 'uml-initial' }))
    else if (node.kind === 'final') {
      group.append(
        s('circle', { cx: node.cx, cy: node.cy, r: 11, class: 'uml-final-ring' }),
        s('circle', { cx: node.cx, cy: node.cy, r: 6.5, class: 'uml-final-dot' }),
      )
    } else if (node.kind === 'choice') {
      const r = node.w / 2
      group.append(
        s('path', {
          d: `M${node.cx} ${node.cy - r}L${node.cx + r} ${node.cy}L${node.cx} ${node.cy + r}L${node.cx - r} ${node.cy}Z`,
          class: 'uml-decision',
        }),
      )
    } else if (node.kind === 'note') {
      group.append(
        s('path', {
          d: `M${x} ${y}H${x + node.w - 12}L${x + node.w} ${y + 12}V${y + node.h}H${x}Z`,
          class: 'uml-note',
        }),
        path(`M${x + node.w - 12} ${y}V${y + 12}H${x + node.w}`, 'uml-note-fold'),
        textLines(x + 12, y + 20, node.lines, { size: 12, anchor: 'start', lineHeight: 16 }),
      )
    } else if (node.kind === 'class') {
      group.append(s('rect', { x, y, width: node.w, height: node.h, class: 'uml-box' }))
      let top = y + 19
      if (node.stereo) {
        group.append(
          textLines(node.cx, top, [node.stereo], { size: 11.5, italic: true, cls: 'uml-sub' }),
        )
        top += 16
      }
      group.append(textLines(node.cx, top, [node.name], { size: 13, weight: 700 }))
      const sep1 = y + node.headH
      group.append(line(x, sep1, x + node.w, sep1, 'uml-compartment'))
      group.append(
        textLines(x + 11, sep1 + 18, node.attrs, {
          size: 12,
          mono: true,
          anchor: 'start',
          lineHeight: 17,
        }),
      )
      if (node.ops.length > 0) {
        const sep2 = sep1 + node.attrH
        group.append(line(x, sep2, x + node.w, sep2, 'uml-compartment'))
        group.append(
          textLines(x + 11, sep2 + 18, node.ops, {
            size: 12,
            mono: true,
            anchor: 'start',
            lineHeight: 17,
          }),
        )
      }
    } else {
      group.append(s('rect', { x, y, width: node.w, height: node.h, rx: 14, class: 'uml-box' }))
      group.append(textLines(node.cx, y + 22, [node.name], { size: 13, weight: 700 }))
      if (node.lines.length > 0) {
        group.append(line(x, y + 32, x + node.w, y + 32, 'uml-compartment'))
        group.append(
          textLines(x + 12, y + 49, node.lines, { size: 12, anchor: 'start', lineHeight: 16 }),
        )
      }
    }
    nodeLayer.append(group)
  }
  svg.append(edgeLayer, nodeLayer)
  return svg
}
