<script lang="ts">
  import { Popover } from 'bits-ui'
  import Icon from '../icons/Icon.svelte'
  import { fly } from '../motion.ts'
  import type { ColumnKey, Columns } from '../prefs.ts'

  let { columns, onChange }: { columns: Columns; onChange: (columns: Columns) => void } = $props()
  let open = $state(false)

  const options: { key: ColumnKey | 'name' | 'notes'; label: string; hint?: string }[] = [
    { key: 'name', label: 'Nama', hint: 'selalu' },
    { key: 'start', label: 'Mulai' },
    { key: 'end', label: 'Selesai' },
    { key: 'duration', label: 'Durasi' },
    { key: 'resource', label: 'Resource' },
    { key: 'progress', label: '% selesai' },
    { key: 'notes', label: 'Catatan', hint: 'segera' },
  ]
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class={[
      'btn pr-2.5',
      open && 'border-accent-border bg-accent-soft hover:border-accent-border hover:bg-accent-soft',
    ]}
  >
    <Icon name="columns" />
    <span class="max-sm:sr-only">Kolom</span>
    <span class={['flex transition-transform duration-200', open && 'rotate-180']}>
      <Icon name="chevron-down" size={14} strokeWidth={2} />
    </span>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content forceMount sideOffset={6} align="start" collisionPadding={12}>
      {#snippet child({ wrapperProps, props, open: visible })}
        {#if visible}
          <div {...wrapperProps}>
            <div
              {...props}
              transition:fly={{ y: -6, duration: 180 }}
              class="relative z-50 w-[250px] rounded-[10px] border border-line-strong bg-surface p-1.5 shadow-pop"
            >
              <p class="m-0 px-2.5 pt-1.5 pb-2 text-xs font-semibold text-text-2">
                Kolom yang tampil di tabel
              </p>
              {#each options as option (option.key)}
                {@const locked = option.key === 'name' || option.key === 'notes'}
                {@const checked =
                  option.key === 'name'
                    ? true
                    : option.key === 'notes'
                      ? false
                      : columns[option.key]}
                <label
                  class={[
                    'flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150',
                    locked ? 'cursor-default text-text-3' : 'text-text hover:bg-surface-2',
                  ]}
                >
                  <input
                    type="checkbox"
                    {checked}
                    disabled={locked}
                    onchange={() => {
                      if (option.key !== 'name' && option.key !== 'notes') {
                        onChange({ ...columns, [option.key]: !columns[option.key] })
                      }
                    }}
                    class="m-0 size-4 accent-[var(--color-accent)]"
                  />
                  <span class="flex-1">{option.label}</span>
                  {#if option.hint}<span class="text-[11.5px] text-text-3">{option.hint}</span>{/if}
                </label>
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
