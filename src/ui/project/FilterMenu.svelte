<script lang="ts">
  import { Popover } from 'bits-ui'
  import { SvelteSet } from 'svelte/reactivity'
  import Icon from '../icons/Icon.svelte'
  import { fly } from '../motion.ts'
  import { activeFilters, type RowFilter, type TypeKey } from '../table/rows.ts'
  import TypeChip from '../table/TypeChip.svelte'
  import { TYPE_LABELS } from '../labels.ts'

  type Props = {
    filter: RowFilter
    counts: Readonly<Record<TypeKey, number>>
    onChange: (filter: RowFilter) => void
  }
  let { filter, counts, onChange }: Props = $props()
  let open = $state(false)

  // Types in the order the design lists them: work types first, milestones last.
  const KEYS: readonly TypeKey[] = ['DOC', 'DSG', 'IMP', 'BUG', 'FIX', 'REV', 'MS']
  const active = $derived(activeFilters(filter))

  function toggleType(key: TypeKey): void {
    const hidden = new SvelteSet(filter.hiddenTypes)
    if (hidden.has(key)) hidden.delete(key)
    else hidden.add(key)
    onChange({ ...filter, hiddenTypes: hidden })
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    aria-label={active > 0 ? `Filter tugas, ${String(active)} aktif` : 'Filter tugas'}
    title="Filter tugas"
    class={[
      'press inline-flex h-[30px] min-w-[30px] items-center justify-center gap-1 rounded-md px-[7px] text-xs font-semibold',
      open
        ? 'bg-accent-soft text-accent-text'
        : active > 0
          ? 'text-accent-text hover:bg-surface'
          : 'text-text-2 hover:bg-surface hover:text-text',
    ]}
  >
    <Icon name="filter" />
    {#if active > 0}<span class="mono pop">{active}</span>{/if}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content forceMount sideOffset={6} align="end" collisionPadding={12}>
      {#snippet child({ wrapperProps, props, open: visible })}
        {#if visible}
          <div {...wrapperProps}>
            <div
              {...props}
              transition:fly={{ y: -6, duration: 180 }}
              class="relative z-50 w-[250px] rounded-[10px] border border-line-strong bg-surface p-1.5 shadow-pop"
            >
              <div class="flex items-center justify-between px-2.5 pt-1.5 pb-2">
                <span class="text-xs font-semibold text-text-2">Tampilkan tipe</span>
                <button
                  type="button"
                  disabled={active === 0}
                  onclick={() => {
                    onChange({ hiddenTypes: new Set(), hideDone: false })
                  }}
                  class="press rounded-sm text-xs font-semibold text-accent-text disabled:cursor-default disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
              {#each KEYS as key (key)}
                <label
                  class="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={!filter.hiddenTypes.has(key)}
                    onchange={() => {
                      toggleType(key)
                    }}
                    class="m-0 size-4 accent-[var(--color-accent)]"
                  />
                  <TypeChip type={key} />
                  <span class="sr-only">{TYPE_LABELS[key]}</span>
                  <span class="flex-1"></span>
                  <span class="mono text-xs text-text-3">{counts[key]}</span>
                </label>
              {/each}
              <div class="mx-1 my-1.5 h-px bg-line"></div>
              <label
                class="flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={filter.hideDone}
                  onchange={() => {
                    onChange({ ...filter, hideDone: !filter.hideDone })
                  }}
                  class="m-0 size-4 accent-[var(--color-accent)]"
                />
                <span>Sembunyikan tugas selesai</span>
              </label>
            </div>
          </div>
        {/if}
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
