<script lang="ts">
  import Icon from '../icons/Icon.svelte'
  import type { Columns } from '../prefs.ts'
  import type { RowFilter, TypeKey } from '../table/rows.ts'
  import ColumnMenu from './ColumnMenu.svelte'
  import FilterMenu from './FilterMenu.svelte'

  type Props = {
    canMoveUp: boolean
    canMoveDown: boolean
    onMove: (direction: -1 | 1) => void
    filter: RowFilter
    counts: Readonly<Record<TypeKey, number>>
    onFilter: (filter: RowFilter) => void
    columns: Columns
    onColumns: (columns: Columns) => void
  }
  let { canMoveUp, canMoveDown, onMove, filter, counts, onFilter, columns, onColumns }: Props =
    $props()

  const arrow =
    'press inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-md px-[7px] text-text-2 hover:bg-surface hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-2'
</script>

<div class="flex h-9 items-center gap-0.5 border-b border-line bg-surface-2 pr-1.5 pl-2">
  <button
    type="button"
    aria-label="Pindahkan tugas ke atas"
    title="Pindahkan ke atas"
    disabled={!canMoveUp}
    onclick={() => {
      onMove(-1)
    }}
    class={arrow}
  >
    <Icon name="arrow-up" />
  </button>
  <button
    type="button"
    aria-label="Pindahkan tugas ke bawah"
    title="Pindahkan ke bawah"
    disabled={!canMoveDown}
    onclick={() => {
      onMove(1)
    }}
    class={arrow}
  >
    <Icon name="arrow-down" />
  </button>
  <span class="flex-1"></span>
  <FilterMenu {filter} {counts} onChange={onFilter} />
  <ColumnMenu {columns} onChange={onColumns} />
</div>
