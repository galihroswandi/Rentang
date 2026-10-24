<script lang="ts">
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { createWorkCalendar } from '../../core/calendar.ts'
  import type { CriticalPath } from '../../core/critical-path.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import type { Project } from '../../core/model.ts'
  import GanttChart from '../gantt/GanttChart.svelte'
  import { layoutGantt, type Zoom } from '../gantt/layout.ts'
  import Icon from '../icons/Icon.svelte'
  import { prefs, type Columns } from '../prefs.ts'
  import { buildTaskRows } from '../table/rows.ts'
  import TaskTable from '../table/TaskTable.svelte'

  type Props = {
    project: Project
    analysis: CriticalPath | null
    progress: ReadonlyMap<string, number>
    zoom: Zoom
    columns: Columns
    criticalOn: boolean
    today: IsoDate
    /** Incremented by the "Hari ini" button; each change scrolls to today. */
    todayRequest: number
    selectedId: string | null
    onSelect: (id: string | null) => void
    onOpen: (id: string) => void
  }
  let {
    project,
    analysis,
    progress,
    zoom,
    columns,
    criticalOn,
    today,
    todayRequest,
    selectedId,
    onSelect,
    onOpen,
  }: Props = $props()

  const MIN_TABLE = 220
  const DEFAULT_TABLE = 452
  const SPLITTER = 10

  const collapsed = new SvelteSet<string>()
  let scroller: HTMLDivElement | undefined = $state()
  let containerWidth = $state(0)
  // svelte-ignore state_referenced_locally
  let tableWidth = $state(prefs.tableWidth(project.id) ?? DEFAULT_TABLE)
  let dragging = $state(false)

  const maxTable = $derived(Math.max(MIN_TABLE, containerWidth - 120))
  // On a phone the table first takes a little over half the screen.
  const shownWidth = $derived(
    Math.round(
      Math.min(
        Math.max(tableWidth, MIN_TABLE),
        containerWidth < 640 ? containerWidth * 0.58 : maxTable,
      ),
    ),
  )

  const rows = $derived(buildTaskRows({ project, analysis, progress, collapsed, today }))
  const calendar = $derived(createWorkCalendar(project.calendar))
  const layout = $derived(
    analysis
      ? layoutGantt({ rows, dependencies: project.dependencies, calendar, zoom, today })
      : null,
  )
  const selectedIndex = $derived(rows.findIndex((row) => row.id === selectedId))

  let handledRequest = 0
  // Centre today when the chart appears, when the zoom changes, and on every "Hari ini".
  $effect(() => {
    const behavior: ScrollBehavior = todayRequest === handledRequest ? 'instant' : 'smooth'
    handledRequest = todayRequest
    const visibleZoom = zoom
    untrack(() => {
      if (!scroller || layout?.zoom !== visibleZoom) return
      const visible = scroller.clientWidth - shownWidth - SPLITTER
      scroller.scrollTo({ left: Math.max(0, layout.todayX - visible / 2), behavior })
    })
  })

  function toggle(id: string, expanded: boolean): void {
    if (expanded) collapsed.delete(id)
    else collapsed.add(id)
  }

  function resizeTo(width: number): void {
    tableWidth = Math.min(Math.max(width, MIN_TABLE), maxTable)
    prefs.setTableWidth(project.id, tableWidth)
  }

  function startDrag(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    dragging = true
    const startX = event.clientX
    const startWidth = shownWidth
    const move = (moveEvent: PointerEvent) => {
      resizeTo(startWidth + moveEvent.clientX - startX)
    }
    const stop = () => {
      dragging = false
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  function onSplitterKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 64 : 16
    const next =
      event.key === 'ArrowLeft'
        ? shownWidth - step
        : event.key === 'ArrowRight'
          ? shownWidth + step
          : event.key === 'Home'
            ? MIN_TABLE
            : event.key === 'End'
              ? maxTable
              : null
    if (next === null) return
    event.preventDefault()
    resizeTo(next)
  }
</script>

<div
  bind:this={scroller}
  bind:clientWidth={containerWidth}
  class={[
    'relative min-h-0 flex-1 overflow-auto bg-surface',
    dragging && 'cursor-col-resize select-none',
  ]}
>
  {#if rows.length === 0}
    <div
      class="flex h-full min-h-60 flex-col items-center justify-center gap-2 p-8 text-center text-text-2"
    >
      <span
        class="pop flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text"
      >
        <Icon name="gantt" size={22} />
      </span>
      <p class="m-0 text-[15px] font-semibold text-text">Belum ada tugas</p>
      <p class="m-0 max-w-[340px] text-[13px]">
        Tambahkan tugas pertama dengan tombol Tugas di atas.
      </p>
    </div>
  {:else}
    <div class="flex w-max min-w-full">
      <div class="sticky left-0 z-20 flex flex-none bg-surface">
        <div
          style:width={`${String(shownWidth)}px`}
          class={[
            'overflow-hidden',
            !dragging && 'transition-[width] duration-200 ease-(--ease-out)',
          ]}
        >
          <TaskTable
            {rows}
            {columns}
            {selectedId}
            {criticalOn}
            {onSelect}
            {onOpen}
            onToggle={toggle}
          />
        </div>
        <div
          role="slider"
          tabindex="0"
          aria-orientation="horizontal"
          aria-label="Lebar tabel"
          aria-valuetext={`${String(shownWidth)} piksel`}
          aria-valuemin={MIN_TABLE}
          aria-valuemax={Math.round(maxTable)}
          aria-valuenow={shownWidth}
          title="Seret untuk mengatur lebar tabel"
          onpointerdown={startDrag}
          onkeydown={onSplitterKey}
          class={[
            'group flex w-2.5 flex-none cursor-col-resize touch-none items-start justify-center border-x border-line pt-[19px] text-text-3 transition-colors duration-150 hover:bg-accent-soft hover:text-accent-text',
            dragging ? 'bg-accent-soft text-accent-text' : 'bg-surface-2',
          ]}
        >
          <span class="transition-transform duration-200 group-hover:scale-125"
            ><Icon name="grip" size={12} strokeWidth={2} /></span
          >
        </div>
      </div>
      {#if layout}
        <div class="flex-none">
          <GanttChart
            {layout}
            {selectedIndex}
            {criticalOn}
            onSelect={(id: string) => {
              onSelect(id)
            }}
            {onOpen}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>
