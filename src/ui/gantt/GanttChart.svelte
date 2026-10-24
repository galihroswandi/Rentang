<script lang="ts">
  import { HEADER_ROW_HEIGHT, ROW_HEIGHT, type GanttLayout } from './layout.ts'

  type Props = { layout: GanttLayout; selectedIndex: number }
  let { layout, selectedIndex }: Props = $props()

  const rowLines = $derived(
    Array.from({ length: layout.height / ROW_HEIGHT }, (_, index) => (index + 1) * ROW_HEIGHT),
  )
</script>

<!-- The table carries the same information in text, so the chart is decorative for screen readers. -->
<div class="sticky top-0 z-10 bg-surface" aria-hidden="true">
  <svg
    width={layout.width}
    height={HEADER_ROW_HEIGHT * 2}
    class="block border-b border-line font-mono text-xs"
  >
    {#each layout.top as cell (cell.key)}
      <line x1={cell.x + 0.5} x2={cell.x + 0.5} y1="0" y2={HEADER_ROW_HEIGHT} class="stroke-line" />
      <text x={cell.x + 6} y="19" class="fill-text-2 font-semibold">{cell.label}</text>
    {/each}
    {#each layout.bottom as cell (cell.key)}
      {#if cell.isToday}
        <rect
          x={cell.x + 1}
          y={HEADER_ROW_HEIGHT + 4}
          width={cell.width - 2}
          height="20"
          rx="4"
          class="fill-amber"
        />
      {/if}
      {#if cell.width >= 12}
        <text
          x={cell.x + cell.width / 2}
          y={HEADER_ROW_HEIGHT + 18}
          text-anchor="middle"
          class={cell.isToday
            ? 'fill-on-amber font-semibold'
            : cell.isOff
              ? 'fill-text-3'
              : 'fill-text-2'}
        >
          {cell.label}
        </text>
      {/if}
    {/each}
  </svg>
</div>

<svg width={layout.width} height={layout.height} class="block" aria-hidden="true">
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
  {#if selectedIndex >= 0}
    <rect
      x="0"
      y={selectedIndex * ROW_HEIGHT}
      width={layout.width}
      height={ROW_HEIGHT}
      class="fill-selected-row"
    />
  {/if}
  {#each rowLines as y (y)}
    <line x1="0" x2={layout.width} y1={y - 0.5} y2={y - 0.5} class="stroke-line" />
  {/each}

  {#each layout.links as link (link.id)}
    <path
      d={link.d}
      fill="none"
      stroke-width={link.critical ? 2 : 1}
      marker-end={link.critical ? 'url(#arrow-critical)' : 'url(#arrow)'}
      class={link.critical ? 'stroke-critical' : 'stroke-text-3'}
    />
  {/each}

  {#each layout.bars as bar (bar.id)}
    {#if bar.kind === 'task'}
      <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="3" class="fill-bar" />
      {#if bar.progressWidth > 0}
        <rect
          x={bar.x}
          y={bar.y}
          width={bar.progressWidth}
          height={bar.height}
          rx="3"
          class="fill-bar-fill"
        />
      {/if}
      <!-- Critical tasks are marked by a thicker edge, never by colour alone. -->
      <rect
        x={bar.x + (bar.critical ? 1 : 0.5)}
        y={bar.y + (bar.critical ? 1 : 0.5)}
        width={Math.max(0, bar.width - (bar.critical ? 2 : 1))}
        height={bar.height - (bar.critical ? 2 : 1)}
        rx="3"
        fill="none"
        stroke-width={bar.critical ? 2 : 1}
        class={bar.critical ? 'stroke-critical' : 'stroke-bar-border'}
      />
    {:else if bar.kind === 'summary'}
      <polygon points={bar.points} class="fill-summary-bar" />
    {:else}
      <rect
        x={bar.cx - 5}
        y={bar.cy - 5}
        width="10"
        height="10"
        transform={`rotate(45 ${String(bar.cx)} ${String(bar.cy)})`}
        stroke-width={bar.critical ? 2 : 0}
        class={['fill-text', bar.critical && 'stroke-critical']}
      />
      <text x={bar.labelX} y={bar.cy + 4} class="fill-text text-sm font-semibold">{bar.label}</text>
    {/if}
  {/each}

  <line
    x1={layout.todayX}
    x2={layout.todayX}
    y1="0"
    y2={layout.height}
    stroke-width="2"
    class="stroke-today"
  />
</svg>
