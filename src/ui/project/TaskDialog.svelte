<script lang="ts">
  import type { TaskInput } from '../../app/edits/project-edits.ts'
  import { isIsoDate, isSupportedDate, MAX_DATE, MIN_DATE, type IsoDate } from '../../core/dates.ts'
  import {
    MAX_DURATION,
    noteTextOf,
    TASK_TYPES,
    type Task,
    type TaskType,
  } from '../../core/model.ts'
  import Dialog from '../dialog/Dialog.svelte'
  import Icon from '../icons/Icon.svelte'
  import { TYPE_LABELS } from '../labels.ts'
  import { slide } from '../motion.ts'
  import TypeChip from '../table/TypeChip.svelte'

  type Props = {
    open: boolean
    /** The task being edited, or null to add a new one. */
    task: Task | null
    /** For a new task: the task it is added under, or null for a top-level one. */
    parentName?: string | null
    /** How many subtasks the task has; a summary task's dates come from them. */
    subtaskCount: number
    /** Tasks this one can sit under, in tree order; depth indents the label. */
    parentOptions?: readonly { id: string; label: string }[]
    /** Tasks this one can wait for, in tree order. */
    predecessorChoices?: readonly { id: string; label: string }[]
    /** Ids of the tasks it waits for now. */
    currentPredecessors?: readonly string[]
    defaultStart: IsoDate
    onClose: () => void
    onSubmit: (input: TaskInput, parentId: string | null, predecessors: string[]) => void
    onDelete: () => void
  }
  let {
    open,
    task,
    parentName = null,
    subtaskCount,
    parentOptions = [],
    predecessorChoices = [],
    currentPredecessors = [],
    defaultStart,
    onClose,
    onSubmit,
    onDelete,
  }: Props = $props()

  const PROGRESS_STEPS = [0, 25, 50, 75, 100]

  let name = $state('')
  let type: TaskType | null = $state(null)
  let start: string = $state('')
  let duration = $state(1)
  let isMilestone = $state(false)
  let progress = $state(0)
  let notes = $state('')
  let parentId: string | null = $state(null)
  let predecessors: string[] = $state([])
  let confirmDelete = $state(false)
  let nameInput: HTMLInputElement | undefined = $state()

  const isSummary = $derived(subtaskCount > 0)
  const valid = $derived(
    name.trim().length > 0 &&
      isIsoDate(start) &&
      isSupportedDate(start) &&
      (isMilestone || (Number.isInteger(duration) && duration >= 1 && duration <= MAX_DURATION)),
  )

  // Reset the form every time the dialog opens.
  $effect(() => {
    if (!open) return
    name = task?.name ?? ''
    type = task?.type ?? null
    start = task?.start ?? defaultStart
    duration = task && !task.isMilestone ? task.duration : 1
    isMilestone = task?.isMilestone ?? false
    progress = task?.progress ?? 0
    notes = task ? noteTextOf(task) : ''
    parentId = task?.parentId ?? null
    predecessors = [...currentPredecessors]
    confirmDelete = false
  })

  function submit(event: SubmitEvent): void {
    event.preventDefault()
    if (!valid || !isIsoDate(start)) return
    onSubmit({ name, type, start, duration, isMilestone, progress, notes }, parentId, predecessors)
  }
</script>

<Dialog
  {open}
  onOpenChange={(next) => {
    if (!next) onClose()
  }}
  title={task ? 'Ubah tugas' : parentName ? 'Subtugas baru' : 'Tugas baru'}
  width={520}
  initialFocus={() => nameInput}
>
  {#snippet description()}
    {#if isSummary}
      Tugas induk: tanggal dan kemajuannya dihitung dari {subtaskCount} subtugas.
    {:else if parentName}
      Subtugas dari "{parentName}". Tanggal selesai dihitung dari mulai dan durasi hari kerja.
    {:else}
      Tanggal selesai dihitung dari mulai, durasi hari kerja, dan dependensi.
    {/if}
  {/snippet}

  <form id="task-form" class="flex min-w-0 flex-col gap-4" onsubmit={submit}>
    <div class="flex flex-col gap-1.5">
      <label for="task-name" class="label">Nama tugas</label>
      <input
        bind:this={nameInput}
        id="task-name"
        class="field"
        bind:value={name}
        required
        autocomplete="off"
      />
    </div>

    {#if task}
      <div class="flex flex-col gap-1.5">
        <label for="task-parent" class="label">Tugas induk</label>
        <select id="task-parent" class="field" bind:value={parentId}>
          <option value={null}>Tanpa induk (tingkat atas)</option>
          {#each parentOptions as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </div>
    {/if}

    <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend class="label mb-1.5">Jenis</legend>
      <div class="flex flex-wrap gap-1.5">
        <label class={['type-option', type === null && 'type-on']}>
          <input type="radio" name="task-type" value={null} bind:group={type} class="sr-only" />
          Tanpa jenis
        </label>
        {#each TASK_TYPES as option (option)}
          <label class={['type-option', type === option && 'type-on']}>
            <input type="radio" name="task-type" value={option} bind:group={type} class="sr-only" />
            <TypeChip type={option} />
            <span class="max-sm:hidden" aria-hidden="true">{TYPE_LABELS[option]}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <div class="flex flex-col gap-1.5">
      <label for="task-notes" class="label">Catatan</label>
      <textarea
        id="task-notes"
        class="field min-h-24 resize-y py-2 leading-snug"
        rows="4"
        bind:value={notes}
        placeholder="Tulis catatan untuk tugas ini (opsional)"></textarea>
    </div>

    {#if predecessorChoices.length > 0}
      <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend class="label mb-1.5">Dikerjakan setelah</legend>
        <p class="m-0 text-xs text-text-3">
          Tugas ini baru mulai setelah tugas yang dipilih selesai. Rantai tugas yang saling
          bergantung inilah yang membentuk jalur kritis.
        </p>
        <ul class="m-0 max-h-40 list-none overflow-y-auto rounded-lg border border-line-strong p-1">
          {#each predecessorChoices as option (option.id)}
            <li>
              <label
                class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  value={option.id}
                  bind:group={predecessors}
                  class="size-4 accent-accent"
                />
                <span class="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}

    {#if !isSummary}
      <div transition:slide class="flex flex-col gap-4">
        <label class="flex items-center gap-3 text-[13px]">
          <span class="relative inline-flex">
            <input type="checkbox" role="switch" bind:checked={isMilestone} class="peer sr-only" />
            <span
              class="h-[18px] w-[30px] rounded-full bg-line-strong transition-colors duration-200 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
            ></span>
            <span
              class="absolute top-[2px] left-[2px] size-[14px] rounded-full bg-knob shadow-[0_1px_2px_rgb(0_0_0/25%)] transition-transform duration-200 ease-(--ease-spring) peer-checked:translate-x-3"
            ></span>
          </span>
          <span class="flex items-center gap-1.5"
            ><Icon name="diamond" size={14} /> Milestone (titik waktu, tanpa durasi)</span
          >
        </label>

        <div class="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <div class="flex flex-col gap-1.5">
            <label for="task-start" class="label">{isMilestone ? 'Tanggal' : 'Mulai'}</label>
            <input
              id="task-start"
              type="date"
              class="field mono"
              bind:value={start}
              min={MIN_DATE}
              max={MAX_DATE}
              required
            />
          </div>
          {#if !isMilestone}
            <div transition:slide={{ axis: 'x' }} class="flex flex-col gap-1.5">
              <label for="task-duration" class="label">Durasi (hari kerja)</label>
              <input
                id="task-duration"
                type="number"
                min="1"
                max={MAX_DURATION}
                class="field mono"
                bind:value={duration}
                required
              />
            </div>
          {/if}
        </div>

        <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend class="label mb-1.5">Kemajuan</legend>
          <div class="grid grid-cols-5 gap-1.5">
            {#each PROGRESS_STEPS as step (step)}
              <label class={['progress-option mono', progress === step && 'progress-on']}>
                <input
                  type="radio"
                  name="task-progress"
                  value={step}
                  bind:group={progress}
                  class="sr-only"
                />
                {step}%
              </label>
            {/each}
          </div>
        </fieldset>
      </div>
    {/if}
  </form>

  {#snippet footer()}
    {#if task}
      {#if confirmDelete}
        <span
          class="mr-auto flex flex-wrap items-center gap-2 text-[13px] text-danger"
          transition:slide={{ axis: 'x' }}
        >
          Hapus{subtaskCount > 0 ? ` beserta ${String(subtaskCount)} subtugas` : ''}?
          <button type="button" class="btn-danger h-9 border border-danger/40" onclick={onDelete}
            >Ya, hapus</button
          >
        </span>
      {:else}
        <button type="button" class="btn-danger mr-auto" onclick={() => (confirmDelete = true)}>
          <Icon name="trash" /> Hapus tugas
        </button>
      {/if}
    {/if}
    <button type="button" class="btn h-10" onclick={onClose}>Batal</button>
    <button type="submit" form="task-form" class="btn-primary h-10 px-4" disabled={!valid}>
      {task ? 'Simpan' : 'Tambah tugas'}
    </button>
  {/snippet}
</Dialog>

<style>
  .type-option,
  .progress-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--color-line-strong);
    border-radius: 8px;
    font-size: 12.5px;
    color: var(--color-text-2);
    transition:
      background-color 160ms var(--ease-out),
      border-color 160ms var(--ease-out),
      transform 120ms var(--ease-out);
  }
  .type-option:hover,
  .progress-option:hover {
    border-color: var(--color-text-3);
  }
  .type-option:active,
  .progress-option:active {
    transform: scale(0.96);
  }
  .type-option:has(:focus-visible),
  .progress-option:has(:focus-visible) {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  .type-on,
  .progress-on {
    border-color: var(--color-accent-border);
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-weight: 600;
  }
</style>
