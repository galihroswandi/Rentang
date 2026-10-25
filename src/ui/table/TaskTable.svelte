<script lang="ts">
  import { tick } from 'svelte'
  import Icon from '../icons/Icon.svelte'
  import { formatLongDate, formatShortDate } from '../format.ts'
  import type { Columns } from '../prefs.ts'
  import Avatar from '../resource/Avatar.svelte'
  import type { TaskRow } from './rows.ts'
  import { treegridAction } from './treegrid-keys.ts'
  import TypeChip from './TypeChip.svelte'

  type Props = {
    rows: readonly TaskRow[]
    columns: Columns
    selectedId: string | null
    criticalOn: boolean
    onSelect: (id: string) => void
    onOpen: (id: string) => void
    onToggle: (id: string, expanded: boolean) => void
    onReorder: (id: string, targetId: string, place: 'before' | 'after') => void
    /** Drops a task onto another, making that one its parent. */
    onNest: (id: string, parentId: string) => void
  }

  let {
    rows,
    columns,
    selectedId,
    criticalOn,
    onSelect,
    onOpen,
    onToggle,
    onReorder,
    onNest,
  }: Props = $props()

  let focusedIndex = $state(0)
  const rowElements: HTMLTableRowElement[] = $state([])
  const activeIndex = $derived(Math.min(focusedIndex, Math.max(0, rows.length - 1)))

  export async function focusRow(index: number): Promise<void> {
    focusedIndex = index
    await tick()
    rowElements[index]?.focus()
  }

  // Rows can be dragged by their grip. Dropped on the left half of a row, the task
  // goes before or after it, joining that row's group; dropped on the right half of any row, it becomes a subtask.
  let dragId: string | null = $state(null)
  let armedId: string | null = $state(null)
  let dropTarget: { id: string; place: 'before' | 'after' | 'inside' } | null = $state(null)

  function isInside(candidateId: string, ancestorId: string): boolean {
    const byId = new Map(rows.map((row) => [row.id, row]))
    for (let id: string | null = candidateId; id !== null; id = byId.get(id)?.parentId ?? null) {
      if (id === ancestorId) return true
    }
    return false
  }

  function dropPlace(event: DragEvent, row: TaskRow): 'before' | 'after' | 'inside' | null {
    const dragged = rows.find((candidate) => candidate.id === dragId)
    if (!dragged || dragged.id === row.id) return null
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const inRightHalf = event.clientX > box.left + box.width / 2
    if (!inRightHalf && !isInside(row.id, dragged.id)) {
      return event.clientY < box.top + box.height / 2 ? 'before' : 'after'
    }
    if (row.isMilestone || isInside(row.id, dragged.id) || dragged.parentId === row.id) return null
    return 'inside'
  }

  function endDrag(): void {
    dragId = null
    armedId = null
    dropTarget = null
  }

  function onKeydown(event: KeyboardEvent): void {
    const row = rows[activeIndex]
    if (!row || event.target instanceof HTMLButtonElement) return
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen(row.id)
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      onSelect(row.id)
      return
    }
    const action = treegridAction(event.key, rows, activeIndex)
    if (action.type === 'none') return
    event.preventDefault()
    if (action.type === 'focus') {
      void focusRow(action.index)
      const target = rows[action.index]
      if (target) onSelect(target.id)
    } else onToggle(action.id, action.type === 'expand')
  }
</script>

<!--
  ARIA in HTML allows any role on <table>, and the WAI-ARIA treegrid example uses exactly this;
  Svelte's check does not know that.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<table
  role="treegrid"
  aria-label="Daftar tugas"
  class="w-full table-fixed border-collapse"
  onkeydown={onKeydown}
>
  <colgroup>
    <col />
    {#if columns.resource}<col class="w-[72px]" />{/if}
    {#if columns.start}<col class="w-[64px]" />{/if}
    {#if columns.end}<col class="w-[64px]" />{/if}
    {#if columns.duration}<col class="w-[64px]" />{/if}
    {#if columns.progress}<col class="w-[52px]" />{/if}
  </colgroup>
  <thead class="sticky top-9 z-10">
    <tr
      class="h-7 border-b border-line-strong bg-surface-2 text-left text-xs font-semibold text-text-2"
    >
      <th scope="col" class="pl-3.5 font-semibold">Nama</th>
      {#if columns.resource}<th scope="col" class="font-semibold">Resource</th>{/if}
      {#if columns.start}<th scope="col" class="font-semibold">Mulai</th>{/if}
      {#if columns.end}<th scope="col" class="font-semibold">Selesai</th>{/if}
      {#if columns.duration}<th scope="col" class="font-semibold">Durasi</th>{/if}
      {#if columns.progress}<th scope="col" class="pr-3 text-right font-semibold">%</th>{/if}
    </tr>
  </thead>
  <tbody>
    {#each rows as row, index (row.id)}
      {@const selected = row.id === selectedId}
      <tr
        bind:this={rowElements[index]}
        aria-level={row.level}
        aria-posinset={row.positionInSet}
        aria-setsize={row.setSize}
        aria-expanded={row.isSummary ? row.expanded : undefined}
        aria-selected={selected}
        tabindex={index === activeIndex ? 0 : -1}
        draggable={armedId === row.id}
        ondragstart={(event) => {
          dragId = row.id
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', row.id)
          }
        }}
        ondragover={(event) => {
          const place = dropPlace(event, row)
          if (!place) {
            dropTarget = null
            return
          }
          event.preventDefault()
          dropTarget = { id: row.id, place }
        }}
        ondrop={(event) => {
          const place = dropPlace(event, row)
          if (place && dragId) {
            event.preventDefault()
            if (place === 'inside') onNest(dragId, row.id)
            else onReorder(dragId, row.id, place)
          }
          endDrag()
        }}
        ondragend={endDrag}
        onclick={() => {
          focusedIndex = index
          onSelect(row.id)
        }}
        ondblclick={() => {
          onOpen(row.id)
        }}
        onfocus={() => {
          focusedIndex = index
        }}
        style:--i={index}
        class={[
          'row group/row h-9 border-b border-line outline-offset-[-2px] transition-colors duration-150',
          selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
          dragId === row.id && 'opacity-50',
          dropTarget?.id === row.id &&
            (dropTarget.place === 'before'
              ? 'shadow-[inset_0_2px_0_var(--color-accent)]'
              : dropTarget.place === 'after'
                ? 'shadow-[inset_0_-2px_0_var(--color-accent)]'
                : 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--color-accent)]'),
        ]}
      >
        <td class="relative overflow-hidden pr-2 pl-3.5">
          <span
            role="presentation"
            title="Seret untuk memindah urutan (lepas di sisi kiri baris, juga untuk mengeluarkan dari induk) atau menjadikan subtugas (lepas di sisi kanan baris)"
            onpointerdown={() => {
              armedId = row.id
            }}
            onpointerup={() => {
              armedId = null
            }}
            class="absolute top-1/2 left-0 flex h-6 w-3.5 -translate-y-1/2 cursor-grab items-center justify-center text-text-3 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100"
          >
            <Icon name="grip" size={12} />
          </span>
          <span
            class="flex min-w-0 items-center gap-2"
            style:padding-left={`${String((row.level - 1) * 18)}px`}
          >
            {#if row.isSummary}
              <button
                type="button"
                tabindex="-1"
                aria-label={row.expanded ? `Tutup ${row.name}` : `Buka ${row.name}`}
                onclick={(event) => {
                  event.stopPropagation()
                  onToggle(row.id, !row.expanded)
                }}
                class="btn-ghost -my-2 size-6 flex-none"
              >
                <span
                  class={[
                    'flex transition-transform duration-200 ease-(--ease-out)',
                    !row.expanded && '-rotate-90',
                  ]}
                >
                  <Icon name="chevron-down" size={14} strokeWidth={2} />
                </span>
              </button>
            {/if}
            {#if row.isMilestone}
              <span class="flex w-[34px] flex-none justify-center text-accent-text">
                <span class="flex [&_svg]:fill-current"><Icon name="diamond" size={14} /></span>
                <span class="sr-only">Milestone:</span>
              </span>
            {:else if row.type}
              <TypeChip type={row.type} />
            {/if}
            <span
              class={[
                'min-w-0 truncate text-[13px]',
                (selected || row.isMilestone || row.isSummary) && 'font-semibold',
              ]}
            >
              {row.name || 'Tanpa nama'}
            </span>
            {#if criticalOn && row.critical}
              <span class="size-1.5 flex-none rounded-full bg-critical" aria-hidden="true"></span>
              <span class="sr-only">, jalur kritis</span>
            {/if}
          </span>
        </td>
        {#if columns.resource}
          <td>
            <span class="flex items-center -space-x-1.5">
              {#each row.people.slice(0, 2) as person (person.id)}
                <Avatar initials={person.initials} name={person.name} />
              {/each}
              {#if row.people.length > 2}
                <span class="mono pl-2.5 text-[11px] text-text-3">+{row.people.length - 2}</span>
              {/if}
            </span>
          </td>
        {/if}
        {#if columns.start}
          <td class="mono text-xs whitespace-nowrap text-text-2">
            {#if row.start}<time datetime={row.start} title={formatLongDate(row.start)}
                >{formatShortDate(row.start)}</time
              >{:else}—{/if}
          </td>
        {/if}
        {#if columns.end}
          <td class="mono text-xs whitespace-nowrap text-text-2">
            {#if row.end}<time datetime={row.end} title={formatLongDate(row.end)}
                >{formatShortDate(row.end)}</time
              >{:else}—{/if}
          </td>
        {/if}
        {#if columns.duration}
          <td class="mono text-xs whitespace-nowrap text-text-2">
            {row.isMilestone || row.isSummary ? '—' : `${String(row.duration)} hari`}
          </td>
        {/if}
        {#if columns.progress}
          <td class="mono pr-3 text-right text-xs whitespace-nowrap text-text-2">
            {row.isMilestone ? '—' : `${String(row.progress)}%`}
          </td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .row {
    animation: fade-in 320ms var(--ease-out) backwards;
    animation-delay: calc(min(var(--i), 24) * 14ms);
  }
</style>
