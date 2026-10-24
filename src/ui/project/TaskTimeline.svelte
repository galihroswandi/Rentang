<script lang="ts">
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { createWorkCalendar } from '../../core/calendar.ts'
  import type { CriticalPath } from '../../core/critical-path.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import type { Project } from '../../core/model.ts'
  import GanttChart from '../gantt/GanttChart.svelte'
  import { layoutGantt, type Zoom } from '../gantt/layout.ts'
  import { buildTaskRows } from '../table/rows.ts'
  import TaskTable from '../table/TaskTable.svelte'

  type Props = {
    project: Project
    analysis: CriticalPath | null
    progress: ReadonlyMap<string, number>
    zoom: Zoom
    today: IsoDate
    /** Incremented by the "Hari ini" button; each change scrolls to today. */
    todayRequest: number
  }
  let { project, analysis, progress, zoom, today, todayRequest }: Props = $props()

  const TABLE_WIDTH = 380

  const collapsed = new SvelteSet<string>()
  let selectedId: string | null = $state(null)
  let scroller: HTMLDivElement | undefined = $state()

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
      const visible = scroller.clientWidth - TABLE_WIDTH
      scroller.scrollTo({ left: Math.max(0, layout.todayX - visible / 2), behavior })
    })
  })

  function toggle(id: string, expanded: boolean): void {
    if (expanded) collapsed.delete(id)
    else collapsed.add(id)
  }
</script>

<div bind:this={scroller} class="relative min-h-0 flex-1 overflow-auto bg-surface">
  <div class="flex w-max min-w-full">
    <div class="sticky left-0 z-20 flex-none border-r border-line bg-surface">
      <TaskTable
        {rows}
        {selectedId}
        onSelect={(id: string) => {
          selectedId = id
        }}
        onToggle={toggle}
      />
    </div>
    {#if layout}
      <div class="flex-none">
        <GanttChart {layout} {selectedIndex} />
      </div>
    {/if}
  </div>
</div>
