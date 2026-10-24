<script lang="ts">
  import type { ProjectSession } from '../../app/store/app-store.ts'
  import {
    addTask,
    deleteTask,
    subtreeOf,
    updateTask,
    type TaskInput,
  } from '../../app/edits/project-edits.ts'
  import { ZOOMS, type Zoom } from '../gantt/layout.ts'
  import Icon from '../icons/Icon.svelte'
  import { fade, fly } from '../motion.ts'
  import { prefs, type Columns } from '../prefs.ts'
  import ResourceView from '../resource/ResourceView.svelte'
  import { useApp } from '../shell/context.ts'
  import Segmented from '../shell/Segmented.svelte'
  import ColumnMenu from './ColumnMenu.svelte'
  import GanttView from './GanttView.svelte'
  import TaskDialog from './TaskDialog.svelte'

  let { session }: { session: ProjectSession } = $props()

  const { store, today } = useApp()

  let view: 'gantt' | 'resource' = $state('gantt')
  let zoom: Zoom = $state(prefs.zoom())
  let columns: Columns = $state(prefs.columns())
  let criticalOn = $state(prefs.critical())
  let todayRequest = $state(0)
  let selectedId: string | null = $state(null)
  let dialog: { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: string } | null =
    $state(null)

  const project = $derived(session.project)
  const analysis = $derived(session.analysis.ok ? session.analysis.value : null)
  const names = $derived(new Map(project.tasks.map((task) => [task.id, task.name])))
  const cycle = $derived(
    session.analysis.ok
      ? null
      : [...session.analysis.error.taskIds, session.analysis.error.taskIds[0] ?? '']
          .map((id) => names.get(id) ?? id)
          .join(' → '),
  )
  const editing = $derived.by(() => {
    const open = dialog
    return open?.kind === 'edit'
      ? (project.tasks.find((task) => task.id === open.id) ?? null)
      : null
  })
  const subtaskCount = $derived(editing ? subtreeOf(project, editing.id).size - 1 : 0)
  const selectedTask = $derived(project.tasks.find((task) => task.id === selectedId) ?? null)
  const zoomIndex = $derived(ZOOMS.indexOf(zoom))

  function setZoom(next: Zoom): void {
    zoom = next
    prefs.setZoom(next)
  }

  function submitTask(input: TaskInput): void {
    if (dialog?.kind === 'new') {
      const id = store.getState().createId()
      if (
        store.getState().edit('Tugas ditambahkan', addTask(id, input, selectedId)) === 'applied'
      ) {
        selectedId = id
      }
    } else if (dialog?.kind === 'edit') {
      store.getState().edit('Tugas diubah', updateTask(dialog.id, input))
    }
    dialog = null
  }

  function removeTask(): void {
    if (dialog?.kind !== 'edit') return
    const { id } = dialog
    store.getState().edit('Tugas dihapus', deleteTask(id))
    if (selectedId !== null && subtreeOf(project, id).has(selectedId)) selectedId = null
    dialog = null
  }

  function showTaskInGantt(id: string): void {
    view = 'gantt'
    selectedId = id
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <h1 class="sr-only">{project.name}</h1>
  <div class="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
    <Segmented
      label="Tampilan proyek"
      value={view}
      compact
      options={[
        { value: 'gantt', label: 'Gantt', icon: 'gantt' },
        { value: 'resource', label: 'Resource', icon: 'users' },
      ]}
      onChange={(next: 'gantt' | 'resource') => {
        view = next
      }}
    />
    <span aria-hidden="true" class="mx-1 h-[22px] w-px bg-line"></span>

    {#if view === 'gantt'}
      <div in:fade class="flex flex-1 flex-wrap items-center gap-2">
        <button type="button" class="btn" onclick={() => (dialog = { kind: 'new' })}>
          <Icon name="plus" />
          <span class="max-sm:sr-only">Tugas</span>
        </button>
        <span aria-hidden="true" class="mx-1 h-[22px] w-px bg-line max-sm:hidden"></span>
        <button type="button" class="btn" disabled={!analysis} onclick={() => (todayRequest += 1)}>
          <Icon name="calendar-check" />
          <span class="max-sm:sr-only">Hari ini</span>
        </button>
        <div class="flex overflow-hidden rounded-md border border-line-strong">
          <button
            type="button"
            aria-label="Perkecil skala waktu"
            title="Perkecil"
            disabled={zoomIndex >= ZOOMS.length - 1}
            onclick={() => {
              setZoom(ZOOMS[zoomIndex + 1] ?? zoom)
            }}
            class="press flex h-[34px] w-9 items-center justify-center bg-surface text-text-2 hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="zoom-out" />
          </button>
          <span aria-hidden="true" class="w-px bg-line-strong"></span>
          <button
            type="button"
            aria-label="Perbesar skala waktu"
            title="Perbesar"
            disabled={zoomIndex <= 0}
            onclick={() => {
              setZoom(ZOOMS[zoomIndex - 1] ?? zoom)
            }}
            class="press flex h-[34px] w-9 items-center justify-center bg-surface text-text-2 hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="zoom-in" />
          </button>
        </div>
        <span class="sr-only" aria-live="polite"
          >Skala: {zoom === 'day' ? 'hari' : zoom === 'week' ? 'minggu' : 'bulan'}</span
        >
        <ColumnMenu
          {columns}
          onChange={(next: Columns) => {
            columns = next
            prefs.setColumns(next)
          }}
        />
        <button
          type="button"
          role="switch"
          aria-checked={criticalOn}
          onclick={() => {
            criticalOn = !criticalOn
            prefs.setCritical(criticalOn)
          }}
          class="btn ml-auto pr-2.5"
        >
          <Icon name="route" />
          <span class="max-sm:sr-only">Jalur kritis</span>
          <span
            class={[
              'relative inline-block h-[18px] w-[30px] rounded-full transition-colors duration-200',
              criticalOn ? 'bg-accent' : 'bg-line-strong',
            ]}
          >
            <span
              class={[
                'absolute top-[2px] left-[2px] size-[14px] rounded-full bg-knob shadow-[0_1px_2px_rgb(0_0_0/25%)] transition-transform duration-200 ease-(--ease-spring)',
                criticalOn && 'translate-x-3',
              ]}
            ></span>
          </span>
        </button>
      </div>
    {/if}
  </div>

  {#if cycle}
    <div
      role="alert"
      class="flex items-center gap-2 border-b border-line bg-surface px-4 py-3 text-[13px] text-danger"
    >
      <Icon name="alert" />
      Jadwal tidak bisa dihitung karena ada dependensi melingkar: {cycle}.
    </div>
  {/if}

  {#key view}
    <div in:fly={{ y: 6, duration: 240 }} class="flex min-h-0 flex-1 flex-col">
      {#if view === 'gantt'}
        <GanttView
          {project}
          {analysis}
          progress={session.progress}
          {zoom}
          {columns}
          {criticalOn}
          today={today()}
          {todayRequest}
          {selectedId}
          onSelect={(id: string | null) => {
            selectedId = id
          }}
          onOpen={(id: string) => {
            selectedId = id
            dialog = { kind: 'edit', id }
          }}
        />
      {:else}
        <ResourceView {session} onShowTask={showTaskInGantt} />
      {/if}
    </div>
  {/key}
</div>

<TaskDialog
  open={dialog !== null}
  task={editing}
  {subtaskCount}
  defaultStart={selectedTask?.start ?? analysis?.schedule.projectStart ?? today()}
  onClose={() => {
    dialog = null
  }}
  onSubmit={submitTask}
  onDelete={removeTask}
/>
