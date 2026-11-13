// UML activity diagram from structured steps: actions, decisions with guards, loops and
// early ends. Each block reports its size and the x of its spine (the vertical flow line),
// so blocks stack with their spines aligned.

import { h, s, symbolLink, SYMBOLS, T } from './00-core.js'
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

const ACT = {
  gap: 24,
  textMax: 250,
  padX: 14,
  padY: 9,
  lineH: 17,
  codeH: 17,
  diamond: 22,
  margin: 22,
}

export function activityDiagram(steps, label) {
  const body = seqBlock([startBlock(), ...steps.map(stepBlock)])
  const root = body.terminal ? body : seqBlock([body, finalBlock()])
  const pad = 16
  const svg = svgRoot(root.w + pad * 2, root.h + pad * 2, label)
  svg.classList.add('uml-activity')
  const group = s('g')
  root.draw(group, pad, pad)
  svg.append(group)
  return svg
}

function stepBlock(step) {
  if (typeof step === 'string') return actionBlock(step)
  if ('do' in step) return actionBlock(step.do, step.ref)
  if ('stop' in step) {
    const block = seqBlock([actionBlock(step.stop, step.ref), finalBlock()])
    return block
  }
  if ('if' in step) return decisionBlock(step)
  if ('loop' in step) return loopBlock(step)
  return actionBlock(JSON.stringify(step))
}

const downArrow = (g, x, y1, y2) => g.append(line(x, y1, x, y2 - 1, 'flow', 'm-open'))

function seqBlock(blocks) {
  const list = []
  for (const block of blocks) {
    if (block.empty) continue
    list.push(block)
    if (block.terminal) break
  }
  if (list.length === 0) return { empty: true, w: 0, h: 0, cx: 0, terminal: false, draw() {} }
  const cx = Math.max(...list.map((block) => block.cx))
  const right = Math.max(...list.map((block) => block.w - block.cx))
  const h = list.reduce((sum, block) => sum + block.h, 0) + ACT.gap * (list.length - 1)
  return {
    w: cx + right,
    h,
    cx,
    terminal: list.at(-1).terminal,
    draw(g, x, y) {
      let top = y
      list.forEach((block, index) => {
        block.draw(g, x + cx - block.cx, top)
        top += block.h
        if (index < list.length - 1) {
          downArrow(g, x + cx, top, top + ACT.gap)
          top += ACT.gap
        }
      })
    },
  }
}

function startBlock() {
  return {
    w: 18,
    h: 18,
    cx: 9,
    draw(g, x, y) {
      g.append(s('circle', { cx: x + 9, cy: y + 9, r: 8, class: 'uml-initial' }))
    },
  }
}

function finalBlock() {
  return {
    w: 24,
    h: 24,
    cx: 12,
    terminal: true,
    draw(g, x, y) {
      g.append(
        s('circle', { cx: x + 12, cy: y + 12, r: 11, class: 'uml-final-ring' }),
        s('circle', { cx: x + 12, cy: y + 12, r: 6.5, class: 'uml-final-dot' }),
      )
    },
  }
}

function actionBlock(text, ref) {
  const spec = font(13)
  const lines = wrapText(text, spec, ACT.textMax)
  const symbol = ref ? SYMBOLS[ref] : null
  const codeSpec = font(11.5, 500, true)
  const codeWidth = symbol ? textWidth(symbol.name, codeSpec) + 22 : 0
  const w = Math.max(96, widest(lines, spec), codeWidth) + ACT.padX * 2
  const h = lines.length * ACT.lineH + (symbol ? ACT.codeH + 2 : 0) + ACT.padY * 2
  return {
    w,
    h,
    cx: w / 2,
    draw(g, x, y) {
      const node = s('g', { class: ['uml-action', symbol && 'has-code'] })
      node.append(s('rect', { x, y, width: w, height: h, rx: 12, class: 'uml-box' }))
      node.append(
        textLines(x + w / 2, y + ACT.padY + 13, lines, { size: 13, lineHeight: ACT.lineH }),
      )
      if (symbol) {
        const codeY = y + ACT.padY + lines.length * ACT.lineH + 13
        const link = s(
          'g',
          { class: 'uml-code' },
          textLines(x + w / 2 + 8, codeY, [symbol.name], { size: 11.5, mono: true }),
          s('path', {
            d: (() => {
              const ix = x + w / 2 + 8 - textWidth(symbol.name, codeSpec) / 2 - 16
              return `M${ix + 3} ${codeY - 8}l-3.5 3.8 3.5 3.8M${ix + 8} ${codeY - 8}l3.5 3.8-3.5 3.8`
            })(),
            class: 'uml-code-icon',
          }),
        )
        node.append(svgCodeLink(link, ref))
      }
      g.append(node)
    },
  }
}

function diamond(g, cx, cy, size = ACT.diamond) {
  const r = size / 2
  g.append(
    s('path', {
      d: `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`,
      class: 'uml-decision',
    }),
  )
}

const guard = (text) => `[${text}]`

function decisionBlock(step) {
  const D = ACT.diamond
  const yes = seqBlock(step.then.map(stepBlock))
  const no = seqBlock((step.else ?? []).map(stepBlock))
  const qSpec = font(12.5, 400, false, true)
  const question = wrapText(step.if, qSpec, 200)
  const qWidth = widest(question, qSpec)
  const qHeight = question.length * 16

  const left = Math.max(D / 2 + 10 + qWidth, no.cx, D / 2)
  const yesOffset = Math.max(D / 2 + 34, no.w - no.cx + 34) + yes.cx
  const right = Math.max(D / 2, no.w - no.cx, yesOffset + yes.w - yes.cx)
  const top = Math.max(0, qHeight / 2 - D / 2)
  const branchTop = top + D + ACT.gap
  const yesContinues = !yes.terminal
  const noContinues = !no.terminal
  const branchesH = Math.max(no.h, yes.h)
  const merge = yesContinues && noContinues && !yes.empty
  const terminal = !yesContinues && !noContinues
  const h = branchTop + branchesH + (merge ? ACT.gap + D : terminal ? 0 : 14)

  return {
    w: left + right,
    h,
    cx: left,
    terminal,
    draw(g, x, y) {
      const sx = x + left
      const cy = y + top + D / 2
      diamond(g, sx, cy)
      g.append(
        textLines(sx - D / 2 - 8, cy - (question.length - 1) * 8 + 4, question, {
          size: 12.5,
          italic: true,
          anchor: 'end',
          lineHeight: 16,
          cls: 'uml-question',
        }),
      )

      const bottom = y + h
      const mergeTop = y + branchTop + branchesH + ACT.gap
      // The "no" branch continues straight down the spine.
      const noLabelY = cy + D / 2 + 14
      if (no.empty) {
        const end = merge ? mergeTop : bottom
        if (merge) downArrow(g, sx, cy + D / 2, end)
        else g.append(line(sx, cy + D / 2, sx, end, 'flow'))
      } else {
        downArrow(g, sx, cy + D / 2, y + branchTop)
        no.draw(g, sx - no.cx, y + branchTop)
        const noEnd = y + branchTop + no.h
        if (noContinues) {
          if (merge) downArrow(g, sx, noEnd, mergeTop)
          else g.append(line(sx, noEnd, sx, bottom, 'flow'))
        }
      }
      g.append(
        haloLabel(sx + 6, noLabelY, guard(step.no ?? T('no')), {
          anchor: 'start',
          size: 11.5,
          cls: 'uml-guard',
        }),
      )

      // The "yes" branch leaves to the right and comes back to the merge.
      const yx = sx + yesOffset
      if (!yes.empty) {
        g.append(path(`M${sx + D / 2} ${cy}H${yx}V${y + branchTop - 1}`, 'flow', 'm-open'))
        g.append(
          haloLabel(sx + D / 2 + 6, cy - 6, guard(step.yes ?? T('yes')), {
            anchor: 'start',
            size: 11.5,
            cls: 'uml-guard',
          }),
        )
        yes.draw(g, yx - yes.cx, y + branchTop)
        const yesEnd = y + branchTop + yes.h
        if (yesContinues) {
          if (merge)
            g.append(
              path(`M${yx} ${yesEnd}V${mergeTop + D / 2}H${sx + D / 2 + 1}`, 'flow', 'm-open'),
            )
          else g.append(path(`M${yx} ${yesEnd}V${bottom}H${sx}`, 'flow'))
        }
      }
      if (merge) diamond(g, sx, mergeTop + D / 2)
    },
  }
}

function loopBlock(step) {
  const D = ACT.diamond
  const body = seqBlock(step.body.map(stepBlock))
  const qSpec = font(12.5, 400, false, true)
  const question = wrapText(step.loop, qSpec, 220)
  const qWidth = widest(question, qSpec)
  const qHeight = question.length * 16
  const left = Math.max(body.cx, D / 2) + ACT.margin
  const right = Math.max(body.w - body.cx, D / 2 + 10 + qWidth) + ACT.margin
  const top = Math.max(0, qHeight - D / 2 + 6)
  const cyOffset = top + D / 2
  const bodyTop = top + D + ACT.gap
  const bodyBottom = bodyTop + body.h
  const h = bodyBottom + 30

  return {
    w: left + right,
    h,
    cx: left,
    draw(g, x, y) {
      const sx = x + left
      const cy = y + cyOffset
      diamond(g, sx, cy)
      g.append(
        textLines(sx + D / 2 + 8, cy - 7 - (question.length - 1) * 16, question, {
          size: 12.5,
          italic: true,
          anchor: 'start',
          lineHeight: 16,
          cls: 'uml-question',
        }),
      )
      downArrow(g, sx, cy + D / 2, y + bodyTop)
      g.append(
        haloLabel(sx + 6, cy + D / 2 + 14, guard(step.next ?? T('next_')), {
          anchor: 'start',
          size: 11.5,
          cls: 'uml-guard',
        }),
      )
      body.draw(g, sx - body.cx, y + bodyTop)
      const leftX = x + ACT.margin / 2
      const rightX = x + left + right - ACT.margin / 2
      if (!body.terminal) {
        g.append(
          path(
            `M${sx} ${y + bodyBottom}V${y + bodyBottom + 12}H${leftX}V${cy}H${sx - D / 2 - 1}`,
            'flow',
            'm-open',
          ),
        )
      }
      g.append(path(`M${sx + D / 2} ${cy}H${rightX}V${y + h}H${sx}`, 'flow'))
      g.append(
        haloLabel(rightX - 4, y + h - 8, guard(step.done ?? T('done')), {
          anchor: 'end',
          size: 11.5,
          cls: 'uml-guard',
        }),
      )
    },
  }
}

/** The same steps as nested ordered lists, for reading, copying and screen readers. */
export function stepsAsText(steps) {
  const item = (step) => {
    if (typeof step === 'string') return h('li', {}, step)
    if ('do' in step || 'stop' in step) {
      return h(
        'li',
        { class: 'stop' in step ? 'is-stop' : '' },
        step.do ?? step.stop,
        step.ref ? [' ', symbolLink(step.ref)] : null,
      )
    }
    if ('if' in step) {
      return h(
        'li',
        {},
        h('em', {}, step.if),
        h(
          'ul',
          {},
          h(
            'li',
            {},
            h('strong', {}, guard(step.yes ?? T('yes'))),
            h('ol', {}, step.then.map(item)),
          ),
          step.else?.length
            ? h(
                'li',
                {},
                h('strong', {}, guard(step.no ?? T('no'))),
                h('ol', {}, step.else.map(item)),
              )
            : null,
        ),
      )
    }
    return h('li', {}, h('em', {}, step.loop), h('ol', {}, step.body.map(item)))
  }
  return h('ol', { class: 'steps-text' }, steps.map(item))
}
