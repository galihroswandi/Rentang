<script lang="ts">
  import type { ProjectSession } from '../../app/store/app-store.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import {
    addSubtask,
    addTask,
    indentTask,
    outdentTask,
    renameProject,
    deleteTask,
    placeTask as reorderTask,
    reschedule,
    setParent,
    subtreeOf,
    updateTask,
    type TaskInput,
  } from '../../app/edits/project-edits.ts'
  import { ZOOMS, type Zoom } from '../gantt/layout.ts'
  import { ZOOM_LABELS } from '../labels.ts'
  import Icon from '../icons/Icon.svelte'
  import { saveFile } from '../file-access.ts'
  import { fade, fly } from '../motion.ts'
  import { prefs, type Columns } from '../prefs.ts'
  import { NO_FILTER, type RowFilter } from '../table/rows.ts'
  import ResourceView from '../resource/ResourceView.svelte'
  import { useApp } from '../shell/context.ts'
  import Segmented from '../shell/Segmented.svelte'
  import CalendarDialog from './CalendarDialog.svelte'
  import GanttView from './GanttView.svelte'
  import DeleteProjectDialog from './DeleteProjectDialog.svelte'
  import { projectFileName, serializeProject } from './project-file.ts'
  import RenameProjectDialog from './RenameProjectDialog.svelte'
  import TaskDialog from './TaskDialog.svelte'

  let { session }: { session: ProjectSession } = $props()

  const { store, today } = useApp()

  let view: 'gantt' | 'resource' = $state('gantt')
  let zoom: Zoom = $state(prefs.zoom())
  let columns: Columns = $state(prefs.columns())
  let criticalOn = $state(prefs.critical())
  let todayRequest = $state(0)
  let startRequest = $state(0)
  let selectedId: string | null = $state(null)
  let peopleQuery = $state('')
  let addPersonRequest = $state(0)
  let rolesOpen = $state(false)
  let calendarOpen = $state(false)
  let renameOpen = $state(false)
  let deleteOpen = $state(false)
  let filter: RowFilter = $state(NO_FILTER)
  let dialog:
    | { readonly kind: 'new'; readonly parentId: string | null }
    | { readonly kind: 'edit'; readonly id: string }
    | null = $state(null)

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
  const newParent = $derived.by(() => {
    const open = dialog
    return open?.kind === 'new' && open.parentId !== null
      ? (project.tasks.find((task) => task.id === open.parentId) ?? null)
      : null
  })
  const parentOptions = $derived.by(() => {
    const own = editing ? subtreeOf(project, editing.id) : new Set<string>()
    const out: { id: string; label: string }[] = []
    const walk = (parentId: string | undefined, depth: number): void => {
      const children = project.tasks
        .filter((task) => task.parentId === parentId)
        .sort((a, b) => a.order - b.order)
      for (const task of children) {
        if (own.has(task.id)) continue
        if (!task.isMilestone) out.push({ id: task.id, label: `${'— '.repeat(depth)}${task.name}` })
        walk(task.id, depth + 1)
      }
    }
    walk(undefined, 0)
    return out
  })
  const canAddSubtask = $derived(selectedTask !== null && !selectedTask.isMilestone)
  const canOutdent = $derived(selectedTask?.parentId !== undefined)
  const canIndent = $derived.by(() => {
    const task = selectedTask
    if (!task) return false
    const above = project.tasks
      .filter((other) => other.parentId === task.parentId && other.order < task.order)
      .sort((a, b) => b.order - a.order)[0]
    return above !== undefined && !above.isMilestone
  })
  const zoomIndex = $derived(ZOOMS.indexOf(zoom))

  /** One level closer (-1) or wider (+1); stays put at either end. */
  function stepZoom(direction: -1 | 1): void {
    const next = ZOOMS[zoomIndex + direction]
    if (next) setZoom(next)
  }

  function setZoom(next: Zoom): void {
    zoom = next
    prefs.setZoom(next)
  }

  function submitTask(input: TaskInput, parentId: string | null): void {
    if (dialog?.kind === 'new') {
      const id = store.getState().createId()
      const under = dialog.parentId
      const recipe = under === null ? addTask(id, input, selectedId) : addSubtask(id, input, under)
      if (store.getState().edit('Tugas ditambahkan', recipe) === 'applied') {
        selectedId = id
      }
    } else if (dialog?.kind === 'edit') {
      const { id } = dialog
      const current = project.tasks.find((task) => task.id === id)
      store.getState().edit('Tugas diubah', (draft) => {
        updateTask(id, input)(draft)
        if (current && (current.parentId ?? null) !== parentId) setParent(id, parentId)(draft)
      })
    }
    dialog = null
  }

  function restructure(label: string, recipe: ReturnType<typeof indentTask>): void {
    store.getState().edit(label, recipe)
  }

  function moveTask(change: {
    id: string
    start: IsoDate
    duration: number
    mode: 'move' | 'resize'
  }): void {
    const label = change.mode === 'move' ? 'Tugas dipindah' : 'Durasi diubah'
    store.getState().edit(label, reschedule(change.id, change.start, change.duration))
    selectedId = change.id
  }

  function removeTask(): void {
    if (dialog?.kind !== 'edit') return
    const { id } = dialog
    store.getState().edit('Tugas dihapus', deleteTask(id))
    if (selectedId !== null && subtreeOf(project, id).has(selectedId)) selectedId = null
    dialog = null
  }

  function renameCurrent(name: string): void {
    store.getState().edit('Nama proyek diubah', renameProject(name))
    renameOpen = false
  }

  function deleteCurrent(): void {
    deleteOpen = false
    void store.getState().deleteProject(project.id)
  }

  /** Saves the project as a `.rentang` file where the person chooses. Nothing is sent anywhere. */
  async function saveToFile(): Promise<void> {
    await saveFile('rentang', projectFileName(project.name), serializeProject(project))
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
        <button
          type="button"
          class="btn"
          onclick={() => (dialog = { kind: 'new', parentId: null })}
        >
          <Icon name="plus" />
          <span class="max-sm:sr-only">Tugas</span>
        </button>
        <button
          type="button"
          class="btn"
          disabled={!canAddSubtask}
          title="Tambah subtugas di bawah tugas yang dipilih"
          onclick={() => (dialog = { kind: 'new', parentId: selectedId })}
        >
          <Icon name="corner-down-right" />
          <span class="max-sm:sr-only">Subtugas</span>
        </button>
        <button
          type="button"
          class="btn"
          disabled={!canIndent}
          aria-label="Jadikan subtugas dari tugas di atasnya"
          title="Jadikan subtugas dari tugas di atasnya"
          onclick={() => {
            if (selectedId) restructure('Tugas digeser ke dalam', indentTask(selectedId))
          }}
        >
          <Icon name="indent-increase" />
        </button>
        <button
          type="button"
          class="btn"
          disabled={!canOutdent}
          aria-label="Naikkan satu tingkat"
          title="Naikkan satu tingkat"
          onclick={() => {
            if (selectedId) restructure('Tugas digeser ke luar', outdentTask(selectedId))
          }}
        >
          <Icon name="indent-decrease" />
        </button>
        <span aria-hidden="true" class="mx-1 h-[22px] w-px bg-line max-sm:hidden"></span>
        <button type="button" class="btn" disabled={!analysis} onclick={() => (startRequest += 1)}>
          <Icon name="arrow-left-to-line" />
          <span class="max-sm:sr-only">Awal proyek</span>
        </button>
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
          <span
            aria-hidden="true"
            class="mono flex w-[66px] items-center justify-center border-x border-line-strong bg-surface-2 text-[11.5px] font-semibold text-text-2"
          >
            {#key zoom}<span class="zoom-label">{ZOOM_LABELS[zoom]}</span>{/key}
          </span>
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
        <span class="sr-only" aria-live="polite">Skala: {ZOOM_LABELS[zoom].toLowerCase()}</span>
        <button type="button" class="btn" onclick={() => (calendarOpen = true)}>
          <Icon name="calendar-days" />
          <span class="max-sm:sr-only">Kalender</span>
        </button>
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
    {:else}
      <div in:fade class="flex flex-1 flex-wrap items-center gap-2">
        <button type="button" class="btn" onclick={() => (addPersonRequest += 1)}>
          <Icon name="user-plus" />
          <span class="max-sm:sr-only">Orang</span>
        </button>
        <button type="button" class="btn" onclick={() => (rolesOpen = true)}>
          <Icon name="tag" />
          <span class="max-sm:sr-only">Kelola role</span>
        </button>
        <label
          class="press ml-auto flex h-9 w-[260px] max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-text-3 focus-within:border-accent-border focus-within:shadow-[0_0_0_3px_rgb(245_158_11/25%)] max-sm:ml-0 max-sm:w-full"
        >
          <Icon name="search" />
          <span class="sr-only">Cari orang</span>
          <input
            type="search"
            bind:value={peopleQuery}
            placeholder="Cari nama atau role"
            class="h-full min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-text outline-none"
          />
        </label>
      </div>
    {/if}

    <span aria-hidden="true" class="mx-1 h-[22px] w-px bg-line"></span>
    <div class="flex items-center gap-2" role="group" aria-label="Aksi proyek">
      <button type="button" class="btn" onclick={saveToFile}>
        <Icon name="file-down" />
        <span class="max-lg:sr-only">Simpan ke berkas</span>
      </button>
      <button
        type="button"
        class="btn-icon"
        aria-label="Ubah nama proyek"
        title="Ubah nama proyek"
        onclick={() => (renameOpen = true)}
      >
        <Icon name="pencil" />
      </button>
      <button
        type="button"
        class="btn-icon hover:text-danger"
        aria-label="Hapus proyek"
        title="Hapus proyek"
        onclick={() => (deleteOpen = true)}
      >
        <Icon name="trash" />
      </button>
    </div>
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
          {startRequest}
          {selectedId}
          onSelect={(id: string | null) => {
            selectedId = id
          }}
          onReschedule={moveTask}
          onZoomStep={stepZoom}
          {filter}
          onFilter={(next: RowFilter) => {
            filter = next
          }}
          onColumns={(next: Columns) => {
            columns = next
            prefs.setColumns(next)
          }}
          onNest={(id: string, parentId: string) => {
            store.getState().edit('Tugas dijadikan subtugas', setParent(id, parentId))
          }}
          onReorder={(id: string, targetId: string, place: 'before' | 'after') => {
            store.getState().edit('Urutan tugas diubah', reorderTask(id, targetId, place))
          }}
          onOpen={(id: string) => {
            selectedId = id
            dialog = { kind: 'edit', id }
          }}
        />
      {:else}
        <ResourceView
          {session}
          query={peopleQuery}
          addRequest={addPersonRequest}
          {rolesOpen}
          onRolesClose={() => (rolesOpen = false)}
          onOpenRoles={() => (rolesOpen = true)}
          onShowTask={showTaskInGantt}
        />
      {/if}
    </div>
  {/key}
</div>

<RenameProjectDialog
  open={renameOpen}
  name={project.name}
  onClose={() => (renameOpen = false)}
  onSubmit={renameCurrent}
/>

<DeleteProjectDialog
  open={deleteOpen}
  name={project.name}
  onClose={() => (deleteOpen = false)}
  onConfirm={deleteCurrent}
/>

<CalendarDialog
  open={calendarOpen}
  {project}
  defaultDate={analysis?.schedule.projectStart ?? today()}
  onClose={() => (calendarOpen = false)}
/>

<TaskDialog
  open={dialog !== null}
  task={editing}
  parentName={newParent?.name ?? null}
  {subtaskCount}
  {parentOptions}
  defaultStart={selectedTask?.start ?? analysis?.schedule.projectStart ?? today()}
  onClose={() => {
    dialog = null
  }}
  onSubmit={submitTask}
  onDelete={removeTask}
/>

<style>
  /* The level name changes with a short slide so the step is felt. */
  .zoom-label {
    animation: fade-up 220ms var(--ease-out);
  }
</style>
