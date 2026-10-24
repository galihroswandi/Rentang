<script lang="ts">
  import { tick } from 'svelte'
  import { formatLongDate, formatShortDate } from '../format.ts'
  import type { TaskRow } from './rows.ts'
  import StatusIcon from './StatusIcon.svelte'
  import { treegridAction } from './treegrid-keys.ts'

  type Props = {
    rows: readonly TaskRow[]
    selectedId: string | null
    onSelect: (id: string) => void
    onToggle: (id: string, expanded: boolean) => void
  }

  let { rows, selectedId, onSelect, onToggle }: Props = $props()

  let focusedIndex = $state(0)
  const rowElements: HTMLTableRowElement[] = $state([])
  const activeIndex = $derived(Math.min(focusedIndex, Math.max(0, rows.length - 1)))

  async function focusRow(index: number): Promise<void> {
    focusedIndex = index
    await tick()
    rowElements[index]?.focus()
  }

  function onKeydown(event: KeyboardEvent): void {
    const row = rows[activeIndex]
    if (!row) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(row.id)
      return
    }
    const action = treegridAction(event.key, rows, activeIndex)
    if (action.type === 'none') return
    event.preventDefault()
    if (action.type === 'focus') void focusRow(action.index)
    else onToggle(action.id, action.type === 'expand')
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
  aria-readonly="true"
  class="w-95 table-fixed border-collapse"
  onkeydown={onKeydown}
>
  <colgroup>
    <col class="w-11" />
    <col />
    <col class="w-15" />
    <col class="w-15" />
    <col class="w-12" />
  </colgroup>
  <thead class="sticky top-0 z-10 bg-surface">
    <tr class="h-14 border-b border-line text-left align-bottom text-xs font-semibold text-text-2">
      <th scope="col" class="pb-2.5 pl-3 font-semibold">#</th>
      <th scope="col" class="pb-2.5 font-semibold">Nama tugas</th>
      <th scope="col" class="pb-2.5 font-semibold">Mulai</th>
      <th scope="col" class="pb-2.5 font-semibold">Selesai</th>
      <th scope="col" class="pr-3 pb-2.5 text-right font-semibold">%</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as row, index (row.id)}
      <tr
        bind:this={rowElements[index]}
        aria-level={row.level}
        aria-posinset={row.positionInSet}
        aria-setsize={row.setSize}
        aria-expanded={row.isSummary ? row.expanded : undefined}
        aria-selected={row.id === selectedId}
        tabindex={index === activeIndex ? 0 : -1}
        onclick={() => {
          focusedIndex = index
          onSelect(row.id)
        }}
        onfocus={() => {
          focusedIndex = index
        }}
        class={[
          'h-9 border-b border-line outline-offset-[-2px]',
          row.id === selectedId ? 'bg-selected' : 'hover:bg-bg',
        ]}
      >
        <td class="truncate pl-3 font-mono text-xs text-text-3">{row.wbs}</td>
        <td class="overflow-hidden pr-2">
          <span
            class="flex min-w-0 items-center gap-1.5"
            style:padding-left={`${String((row.level - 1) * 20)}px`}
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
                class="-my-2 flex size-6 flex-none cursor-pointer items-center justify-center rounded-sm"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  class={['stroke-text-2', !row.expanded && '-rotate-90']}
                >
                  <path d="M3 5l4 4 4-4" />
                </svg>
              </button>
            {:else if row.isMilestone}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                role="img"
                aria-label="Milestone"
                class="flex-none"
              >
                <path d="M7 1l6 6-6 6-6-6z" class="fill-text" />
              </svg>
            {:else if row.status}
              <StatusIcon status={row.status} />
            {/if}
            <span class={['min-w-0 truncate', row.isSummary && 'font-semibold']}>{row.name}</span>
            {#if row.critical}<span class="sr-only">, jalur kritis</span>{/if}
          </span>
        </td>
        <td class="font-mono text-sm text-text-2">
          {#if row.start}<time datetime={row.start} title={formatLongDate(row.start)}
              >{formatShortDate(row.start)}</time
            >{:else}—{/if}
        </td>
        <td class="font-mono text-sm text-text-2">
          {#if row.end && !row.isMilestone}<time datetime={row.end} title={formatLongDate(row.end)}
              >{formatShortDate(row.end)}</time
            >{:else}—{/if}
        </td>
        <td class="pr-3 text-right font-mono text-sm"
          >{row.isMilestone ? '—' : `${String(row.progress)}%`}</td
        >
      </tr>
    {/each}
  </tbody>
</table>
