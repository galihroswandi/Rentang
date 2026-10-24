<script lang="ts">
  import { HEADER_ROW_HEIGHT, ROW_HEIGHT, type GanttLayout } from './layout.ts'

  type Props = {
    layout: GanttLayout
    selectedIndex: number
    criticalOn: boolean
    onSelect: (id: string) => void
    onOpen: (id: string) => void
  }
  let { layout, selectedIndex, criticalOn, onSelect, onOpen }: Props = $props()

  const rowLines = $derived(
    Array.from({ length: layout.height / ROW_HEIGHT }, (_, index) => (index + 1) * ROW_HEIGHT),
  )

  /** Bars are a mouse shortcut; the table is the keyboard and screen-reader route. */
  function idAt(event: MouseEvent): string | null {
    const target = event.target instanceof Element ? event.target.closest('[data-id]') : null
    return target?.getAttribute('data-id') ?? null
  }
</script>

<!-- The table carries the same information in text, so the chart is decorative for screen readers. -->
<div class="sticky top-0 z-10 bg-surface-2" aria-hidden="true">
  <svg
    width={layout.width}
    height={HEADER_ROW_HEIGHT * 2}
    class="block border-b border-line-strong"
  >
    <line
      x1="0"
      x2={layout.width}
      y1={HEADER_ROW_HEIGHT - 0.5}
      y2={HEADER_ROW_HEIGHT - 0.5}
      class="stroke-line"
    />
    {#each layout.top as cell, index (cell.key)}
      {#if index > 0}
        <line
          x1={cell.x + 0.5}
          x2={cell.x + 0.5}
          y1="0"
          y2={HEADER_ROW_HEIGHT}
          class="stroke-line"
        />
      {/if}
      <text x={cell.x + 8} y="17" class="fill-text-2 text-[11.5px] font-semibold">{cell.label}</text
      >
    {/each}
    {#each layout.bottom as cell (cell.key)}
      {#if cell.isOff}
        <rect
          x={cell.x}
          y={HEADER_ROW_HEIGHT}
          width={cell.width}
          height={HEADER_ROW_HEIGHT}
          class="fill-weekend"
        />
      {/if}
      {#if cell.isToday && layout.zoom !== 'month'}
        <circle
          cx={cell.x + cell.width / 2}
          cy={HEADER_ROW_HEIGHT + 13}
          r="9.5"
          class="today-dot fill-accent"
        />
      {/if}
      {#if cell.width >= 12}
        <text
          x={cell.x + cell.width / 2}
          y={HEADER_ROW_HEIGHT + 17}
          text-anchor="middle"
          class={[
            'mono text-[11px]',
            cell.isToday && layout.zoom !== 'month'
              ? 'fill-on-accent font-semibold'
              : cell.isToday
                ? 'fill-accent-text font-semibold'
                : cell.isOff
                  ? 'fill-text-3'
                  : 'fill-text-2',
          ]}
        >
          {cell.label}
        </text>
      {/if}
    {/each}
  </svg>
</div>

<svg
  width={layout.width}
  height={layout.height}
  class="block"
  aria-hidden="true"
  onclick={(event) => {
    const id = idAt(event)
    if (id) onSelect(id)
  }}
  ondblclick={(event) => {
    const id = idAt(event)
    if (id) onOpen(id)
  }}
>
  <defs>
    <marker
      id="arrow"
      viewBox="0 0 6 8"
      refX="6"
      refY="4"
      markerWidth="6"
      markerHeight="8"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0 0L6 4L0 8z" class="fill-text-3" />
    </marker>
    <marker
      id="arrow-critical"
      viewBox="0 0 6 8"
      refX="6"
      refY="4"
      markerWidth="6"
      markerHeight="8"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0 0L6 4L0 8z" class="fill-critical" />
    </marker>
  </defs>

  {#each layout.offDays as day (day.x)}
    <rect x={day.x} y="0" width={day.width} height={layout.height} class="fill-weekend" />
  {/each}
  {#each layout.weekLines as x (x)}
    <line x1={x + 0.5} x2={x + 0.5} y1="0" y2={layout.height} class="stroke-line" />
  {/each}
  {#if selectedIndex >= 0}
    <rect
      x="0"
      y={selectedIndex * ROW_HEIGHT}
      width={layout.width}
      height={ROW_HEIGHT}
      class="selection fill-selected-row"
    />
  {/if}
  {#each rowLines as y (y)}
    <line x1="0" x2={layout.width} y1={y - 0.5} y2={y - 0.5} class="stroke-line" />
  {/each}

  {#each layout.links as link (link.id)}
    {@const critical = criticalOn && link.critical}
    <path
      d={link.d}
      fill="none"
      stroke-width={critical ? 1.75 : 1}
      marker-end={critical ? 'url(#arrow-critical)' : 'url(#arrow)'}
      class={['link', critical ? 'stroke-critical' : 'stroke-text-3']}
    />
  {/each}

  {#each layout.bars as bar, index (bar.id)}
    {#if bar.kind === 'task'}
      {@const critical = criticalOn && bar.critical}
      <g data-id={bar.id} class="bar cursor-pointer" style:--i={index}>
        {#if critical}
          <rect
            x={bar.x + 1}
            y={bar.y - 2}
            width={Math.max(0, bar.width - 2)}
            height={bar.height + 4}
            rx="7"
            class="geometry ring fill-none stroke-critical"
            stroke-width="2"
          />
        {/if}
        <rect
          x={bar.x + 2}
          y={bar.y}
          width={Math.max(2, bar.width - 4)}
          height={bar.height}
          rx="5"
          class="geometry fill-bar-track stroke-bar-border"
          stroke-width="1"
        />
        {#if bar.progressWidth > 0}
          <rect
            x={bar.x + 2.5}
            y={bar.y + 0.5}
            width={Math.max(0, Math.min(bar.progressWidth, bar.width - 4) - 1)}
            height={bar.height - 1}
            rx="4.5"
            class="geometry fill-bar-fill"
          />
        {/if}
      </g>
    {:else if bar.kind === 'summary'}
      <polygon
        data-id={bar.id}
        points={bar.points}
        class="bar summary cursor-pointer fill-summary-bar"
        style:--i={index}
      />
    {:else}
      {@const critical = criticalOn && bar.critical}
      <g data-id={bar.id} class="cursor-pointer">
        <text
          x={bar.labelX}
          y={bar.cy + 4}
          text-anchor={bar.labelSide === 'left' ? 'end' : 'start'}
          class="label text-xs"
        >
          <tspan class="fill-text font-semibold">{bar.name}</tspan>
          <tspan dx="6" class="mono fill-text-3 text-[11.5px]">{bar.date}</tspan>
        </text>
        <g class="milestone" style:transform-origin={`${String(bar.cx)}px ${String(bar.cy)}px`}>
          <rect
            x={bar.cx - 7}
            y={bar.cy - 7}
            width="14"
            height="14"
            rx="2"
            transform={`rotate(45 ${String(bar.cx)} ${String(bar.cy)})`}
            stroke-width="2"
            class="fill-accent stroke-surface"
          />
          <rect
            x={bar.cx - 8.5}
            y={bar.cy - 8.5}
            width="17"
            height="17"
            rx="3"
            transform={`rotate(45 ${String(bar.cx)} ${String(bar.cy)})`}
            stroke-width={critical ? 2 : 1}
            class={['fill-none', critical ? 'stroke-critical' : 'stroke-bar-border']}
          />
        </g>
      </g>
    {/if}
  {/each}

  <line
    x1={layout.todayX}
    x2={layout.todayX}
    y1="0"
    y2={layout.height}
    stroke-width="2"
    class="today stroke-today"
  />
</svg>

<style>
  /* Bars sweep in from their start date, one after another. */
  .bar {
    transform-box: fill-box;
    transform-origin: left center;
    animation: grow-x 680ms var(--ease-out) backwards;
    animation-delay: calc(80ms + min(var(--i), 30) * 18ms);
  }
  .bar:hover {
    filter: brightness(1.04) drop-shadow(0 1px 2px rgb(0 0 0 / 15%));
  }
  /* Zooming slides bars to their new place instead of jumping. */
  .geometry,
  .summary,
  .link {
    transition:
      x 320ms var(--ease-out),
      width 320ms var(--ease-out),
      d 320ms var(--ease-out),
      points 320ms var(--ease-out);
  }
  .ring {
    animation: fade-in 260ms var(--ease-out) backwards;
  }
  .link {
    animation: fade-in 500ms var(--ease-out) 420ms backwards;
  }
  .milestone {
    animation: pop 480ms var(--ease-out) 360ms backwards;
  }
  .label {
    animation: fade-in 400ms var(--ease-out) 520ms backwards;
  }
  .selection {
    transition: y 200ms var(--ease-out);
  }
  .today {
    animation: fade-in 500ms var(--ease-out) 300ms backwards;
  }
  .today-dot {
    transform-box: fill-box;
    transform-origin: center;
    animation: pop 420ms var(--ease-out) 200ms backwards;
  }
</style>
