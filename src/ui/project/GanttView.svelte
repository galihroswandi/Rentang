<script lang="ts">
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { createWorkCalendar } from '../../core/calendar.ts'
  import { diffDays, MAX_DATE } from '../../core/dates.ts'
  import type { CriticalPath } from '../../core/critical-path.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import type { Project } from '../../core/model.ts'
  import GanttChart, { type Reschedule } from '../gantt/GanttChart.svelte'
  import { layoutGantt, type GanttLayout, type Zoom } from '../gantt/layout.ts'
  import { scrollAfterZoom, type ChartView } from '../gantt/zoom.ts'
  import { isSideways, nearestSnap, sidewaysDelta, snapPoints } from '../gantt/snap.ts'
  import { prefersReducedMotion } from '../motion.ts'
  import Icon from '../icons/Icon.svelte'
  import { prefs, type ColumnKey, type Columns } from '../prefs.ts'
  import { buildTaskRows, countTypes, type RowFilter } from '../table/rows.ts'
  import TaskTable from '../table/TaskTable.svelte'
  import TableToolbar from './TableToolbar.svelte'

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
    /** Incremented by the "Awal proyek" button; each change scrolls to the first task's start. */
    startRequest: number
    selectedId: string | null
    onSelect: (id: string | null) => void
    onOpen: (id: string) => void
    onReschedule: (change: Reschedule) => void
    filter: RowFilter
    onFilter: (filter: RowFilter) => void
    onColumns: (columns: Columns) => void
    /** Puts the selected task before or after a sibling that is showing. */
    onReorder: (id: string, targetId: string, place: 'before' | 'after') => void
    onNest: (id: string, parentId: string) => void
    onDelete: (id: string) => void
    /** Ctrl or Cmd with the mouse wheel: -1 closer, +1 wider. */
    onZoomStep: (direction: -1 | 1) => void
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
    startRequest,
    selectedId,
    onSelect,
    onOpen,
    onReschedule,
    onZoomStep,
    filter,
    onFilter,
    onColumns,
    onReorder,
    onNest,
    onDelete,
  }: Props = $props()

  const DEFAULT_TABLE = 452
  const SPLITTER = 10
  /** Room the name column always keeps, plus the cell padding. */
  const NAME_ROOM = 200
  const COLUMN_WIDTHS: Readonly<Record<ColumnKey, number>> = {
    resource: 72,
    start: 64,
    end: 64,
    duration: 64,
    progress: 52,
  }
  /** On a phone the chart matters more than the dates, which it already shows. */
  const PHONE_COLUMNS: Columns = {
    resource: false,
    start: false,
    end: false,
    duration: false,
    progress: true,
  }

  const collapsed = new SvelteSet<string>()
  let scroller: HTMLDivElement | undefined = $state()
  let containerWidth = $state(0)
  // svelte-ignore state_referenced_locally
  let customWidth: number | null = $state(prefs.tableWidth(project.id))
  let dragging = $state(false)

  const phone = $derived(containerWidth > 0 && containerWidth < 640)
  const visibleColumns = $derived(phone ? PHONE_COLUMNS : columns)
  // The table widens by itself when columns are added, so names never get squeezed out.
  const minTable = $derived(
    NAME_ROOM +
      (Object.keys(COLUMN_WIDTHS) as ColumnKey[])
        .filter((key) => visibleColumns[key])
        .reduce((sum, key) => sum + COLUMN_WIDTHS[key], 0),
  )
  const maxTable = $derived(Math.max(minTable, containerWidth - 120))
  const shownWidth = $derived(
    Math.round(
      Math.min(
        Math.max(customWidth ?? Math.max(DEFAULT_TABLE, minTable + 100), minTable),
        phone ? containerWidth * 0.56 : maxTable,
      ),
    ),
  )

  const rows = $derived(buildTaskRows({ project, analysis, progress, collapsed, today, filter }))
  const calendar = $derived(createWorkCalendar(project.calendar))
  /**
   * Whole years added after the project's last one. It starts at one, so December is always
   * followed by a January, and grows by itself as you scroll toward the end.
   */
  let extraYears = $state(1)
  const MAX_EXTRA_YEARS = 40
  /** "Hari ini" asked for a date the chart does not reach yet; scroll again once it does. */
  let todayPending: ScrollBehavior | null = null

  const layout = $derived(
    analysis
      ? layoutGantt({
          rows,
          dependencies: project.dependencies,
          calendar,
          zoom,
          today,
          extraYears,
        })
      : null,
  )
  const counts = $derived(countTypes(project.tasks))

  // The neighbours the selected task can swap places with: siblings that are showing.
  const neighbours = $derived.by(() => {
    const index = rows.findIndex((row) => row.id === selectedId)
    const row = rows[index]
    if (!row) return { before: null, after: null }
    const siblings = rows.filter((candidate) => candidate.parentId === row.parentId)
    const at = siblings.indexOf(row)
    return { before: siblings[at - 1]?.id ?? null, after: siblings[at + 1]?.id ?? null }
  })

  function moveSelected(direction: -1 | 1): void {
    if (selectedId === null) return
    const target = direction < 0 ? neighbours.before : neighbours.after
    if (target) onReorder(selectedId, target, direction < 0 ? 'before' : 'after')
  }

  const selectedIndex = $derived(rows.findIndex((row) => row.id === selectedId))

  let handledRequest = 0
  let handledStart = 0
  /** The first day and day width on screen, so a zoom change knows what it is leaving. */
  let rendered: { zoom: Zoom; start: IsoDate; dayWidth: number } | null = null
  /** Where the view was just before the zoom changed; the browser may clamp it afterwards. */
  let anchor: ChartView | null = null

  // Runs before the page is redrawn for a new zoom, while the scroll position is still the
  // reader's own: a narrower chart would make the browser clamp it.
  $effect.pre(() => {
    const nextZoom = zoom
    untrack(() => {
      if (scroller && rendered && rendered.zoom !== nextZoom) {
        anchor = { ...rendered, scrollLeft: scroller.scrollLeft }
      }
    })
  })

  $effect(() => {
    if (layout) rendered = { zoom: layout.zoom, start: layout.start, dayWidth: layout.dayWidth }
  })

  // Start the chart at today when it first appears and on every "Hari ini"; "Awal proyek"
  // goes to the first task's start instead. When only the zoom changes, keep the date that
  // was in the middle of the screen in the middle.
  $effect(() => {
    const requested = todayRequest !== handledRequest
    const startRequested = startRequest !== handledStart
    const behavior: ScrollBehavior = requested || startRequested ? 'smooth' : 'instant'
    handledRequest = todayRequest
    handledStart = startRequest
    const visibleZoom = zoom
    untrack(() => {
      if (!scroller || layout?.zoom !== visibleZoom) return
      const visible = scroller.clientWidth - shownWidth - SPLITTER
      const last = anchor
      anchor = null
      const first = startRequested ? projectStart() : null
      if (first) {
        // Its column becomes the first one against the table, like today does.
        const left = diffDays(layout.start, first) * layout.dayWidth
        const furthest = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
        scroller.scrollTo({ left: Math.min(Math.max(0, left), furthest), behavior })
        return
      }
      if (last && !requested && last.dayWidth !== layout.dayWidth) {
        scroller.scrollTo({ left: scrollAfterZoom(last, layout, visible), behavior })
        return
      }
      scrollToToday(scroller, layout, behavior)
    })
  })

  /** The earliest start over every task, or null when there are none. */
  function projectStart(): IsoDate | null {
    let first: IsoDate | null = null
    for (const row of rows) if (row.start && (!first || row.start < first)) first = row.start
    return first
  }

  /**
   * Today's column becomes the first one against the table: its left edge is the cell's.
   * When the chart is too short for that, more years are added first and the scroll follows.
   */
  function scrollToToday(
    element: HTMLElement,
    current: GanttLayout,
    behavior: ScrollBehavior,
  ): void {
    const todayEdge =
      current.bottom.find((cell) => cell.isToday)?.x ?? current.todayX - current.dayWidth / 2
    const furthest = Math.max(0, element.scrollWidth - element.clientWidth)
    if (todayEdge > furthest + 0.5 && canAddYear(current)) {
      todayPending = behavior
      extraYears += 1
      return
    }
    todayPending = null
    element.scrollTo({ left: Math.min(Math.max(0, todayEdge), furthest), behavior })
  }

  /** Whether another year still fits: under the cap and before the end of the supported dates. */
  function canAddYear(current: GanttLayout): boolean {
    return extraYears < MAX_EXTRA_YEARS && current.end < MAX_DATE
  }

  /** Keeps at least a screen and a half of dates ahead of the view, adding a year when not. */
  function ensureDatesAhead(element: HTMLElement): void {
    const ahead = element.scrollWidth - element.clientWidth - element.scrollLeft
    if (ahead < element.clientWidth * 1.5 && layout && canAddYear(layout)) extraYears += 1
  }

  // After the chart grows (a new year, a zoom, a resize), check that dates still lie ahead,
  // and finish a "Hari ini" that was waiting for them.
  $effect(() => {
    const element = scroller
    const current = layout
    const width = containerWidth
    if (!element || !current || width === 0) return
    untrack(() => {
      if (todayPending) scrollToToday(element, current, todayPending)
      else ensureDatesAhead(element)
    })
  })

  const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'instant' : 'smooth')

  /**
   * Where sideways scrolling may come to rest: the left edge of each header cell (a day,
   * a week start, a month or a quarter). A cell edge at scroll position x sits exactly
   * against the right edge of the sticky table, so a column is never cut in half there.
   */
  function stops(element: HTMLElement): number[] {
    const edges = layout?.bottom.map((cell) => cell.x) ?? []
    return snapPoints(edges, element.scrollWidth - element.clientWidth)
  }

  let panning = $state(false)

  // When scrolling stops, a column slides the last bit against the table's edge, like a magnet.
  $effect(() => {
    const element = scroller
    if (!element) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = (): void => {
      untrack(() => {
        ensureDatesAhead(element)
      })
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (panning) return
        const target = nearestSnap(stops(element), element.scrollLeft)
        if (Math.abs(target - element.scrollLeft) > 0.5) {
          element.scrollTo({ left: target, behavior: scrollBehavior() })
        }
      }, 140)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      element.removeEventListener('scroll', onScroll)
    }
  })

  // Wheel: Ctrl or Cmd zooms, like a map; Shift with the wheel, or a sideways swipe, moves the
  // view sideways. Both need a non-passive listener to stop the browser's own behaviour, so
  // it is attached by hand.
  $effect(() => {
    const element = scroller
    if (!element) return
    let zoomRest = 0
    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        // A notch of a mouse wheel or a stretch of trackpad pinch makes one step.
        zoomRest += event.deltaY
        if (Math.abs(zoomRest) < 40) return
        onZoomStep(zoomRest > 0 ? 1 : -1)
        zoomRest = 0
        return
      }
      if (!isSideways(event)) return
      event.preventDefault()
      // Follows the wheel or swipe directly, a mouse notch counting for several, so a year
      // away is a few turns; the magnet below settles it on a column once it stops.
      const amount = sidewaysDelta(event) * (event.deltaMode === 0 ? 2 : 40)
      element.scrollBy({ left: amount, behavior: 'instant' })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
    }
  })

  /** Dragging the chart's background with the mouse moves the view; letting go snaps it. */
  function startPan(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
    const element = scroller
    if (!element || event.pointerType !== 'mouse' || event.button !== 0) return
    // Bars handle their own drag.
    if (event.target instanceof Element && event.target.closest('[data-id]')) return
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = element.scrollLeft
    const startTop = element.scrollTop
    let moved = false
    const move = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      if (!moved && Math.hypot(dx, dy) < 4) return
      moved = true
      panning = true
      element.scrollLeft = startLeft - dx
      element.scrollTop = startTop - dy
    }
    const stop = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
      if (!moved) return
      panning = false
      const target = nearestSnap(stops(element), element.scrollLeft)
      element.scrollTo({ left: target, behavior: scrollBehavior() })
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  function toggle(id: string, expanded: boolean): void {
    if (expanded) collapsed.delete(id)
    else collapsed.add(id)
  }

  function resizeTo(width: number): void {
    customWidth = Math.min(Math.max(width, minTable), maxTable)
    prefs.setTableWidth(project.id, customWidth)
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
            ? minTable
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
  data-gantt-scroller
  bind:clientWidth={containerWidth}
  class={[
    // scroll-pt equals the sticky header height, so a focused row never lands underneath it.
    'relative min-h-0 flex-1 scroll-pt-16 overflow-auto bg-surface',
    dragging && 'cursor-col-resize select-none',
  ]}
>
  {#if project.tasks.length === 0}
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
            // Clipped, not hidden: a hidden overflow would stop the header from sticking.
            'overflow-clip',
            !dragging && 'transition-[width] duration-200 ease-(--ease-out)',
          ]}
        >
          <div class="sticky top-0 z-20">
            <TableToolbar
              canMoveUp={neighbours.before !== null}
              canMoveDown={neighbours.after !== null}
              onMove={moveSelected}
              {filter}
              {counts}
              {onFilter}
              {columns}
              {onColumns}
            />
          </div>
          <TaskTable
            {rows}
            columns={visibleColumns}
            {selectedId}
            {criticalOn}
            {onSelect}
            {onOpen}
            onToggle={toggle}
            {onReorder}
            {onNest}
            {onDelete}
          />
          {#if rows.length === 0}
            <p class="m-0 px-4 py-5 text-[13px] text-text-3">
              Tidak ada tugas yang cocok dengan filter.
            </p>
          {/if}
        </div>
        <div class="group relative flex w-2.5 flex-none justify-center">
          <span
            aria-hidden="true"
            class={[
              'pointer-events-none absolute inset-0 border-x border-line transition-colors duration-150',
              dragging ? 'bg-accent-soft' : 'bg-surface-2 group-hover:bg-accent-soft',
            ]}
          ></span>
          <div
            role="slider"
            tabindex="0"
            aria-orientation="horizontal"
            aria-label="Lebar tabel"
            aria-valuetext={`${String(shownWidth)} piksel`}
            aria-valuemin={minTable}
            aria-valuemax={Math.round(maxTable)}
            aria-valuenow={shownWidth}
            title="Seret untuk mengatur lebar tabel"
            onpointerdown={startDrag}
            onkeydown={onSplitterKey}
            class={[
              'sticky top-1/2 z-10 flex h-8 w-full -translate-y-1/2 cursor-col-resize touch-none items-center justify-center border-x border-line text-text-3 transition-colors duration-150 hover:bg-accent-soft hover:text-accent-text',
              dragging ? 'bg-accent-soft text-accent-text' : 'bg-surface-2',
            ]}
          >
            <span class="transition-transform duration-200 group-hover:scale-125"
              ><Icon name="grip" size={12} strokeWidth={2} /></span
            >
          </div>
        </div>
      </div>
      {#if layout}
        <!-- Panning is a mouse shortcut; the chart is decorative for assistive technology. -->
        <div
          role="presentation"
          class={['flex-none', panning ? 'cursor-grabbing select-none' : 'cursor-grab']}
          onpointerdown={startPan}
        >
          <GanttChart
            {layout}
            {rows}
            {calendar}
            {selectedIndex}
            {criticalOn}
            onSelect={(id: string) => {
              onSelect(id)
            }}
            {onOpen}
            {onReschedule}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>
