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
    aria-label="Atur kolom tabel"
    title="Atur kolom"
    class={[
      'press inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-md px-[7px]',
      open ? 'bg-accent-soft text-accent-text' : 'text-text-2 hover:bg-surface hover:text-text',
    ]}
  >
    <Icon name="columns" />
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
