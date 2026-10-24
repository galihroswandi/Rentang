<script lang="ts">
  import { Popover } from 'bits-ui'
  import Icon from '../icons/Icon.svelte'
  import { relativeDay } from '../list/list-text.ts'
  import { fly } from '../motion.ts'
  import { useApp } from './context.ts'

  const { store, app, today } = useApp()
  let open = $state(false)

  // Stored projects that have no tab yet, most recently opened first.
  const closed = $derived($app.projects.filter((project) => !$app.tabs.includes(project.id)))

  function choose(id: string): void {
    open = false
    void store.getState().openProject(id)
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    aria-label="Buka proyek lain"
    title="Buka proyek lain"
    class={['btn-ghost mb-0.5 ml-0.5 size-8 flex-none', open && 'bg-surface text-text']}
  >
    <Icon name="plus" />
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content forceMount sideOffset={6} align="start" collisionPadding={12}>
      {#snippet child({ wrapperProps, props, open: visible })}
        {#if visible}
          <div {...wrapperProps}>
            <div
              {...props}
              transition:fly={{ y: -6, duration: 180 }}
              class="relative z-50 w-[300px] max-w-[calc(100vw-24px)] rounded-[10px] border border-line-strong bg-surface p-1.5 shadow-pop"
            >
              <p class="m-0 px-2.5 pt-1.5 pb-2 text-xs font-semibold text-text-2">
                Buka proyek lain
              </p>
              {#if closed.length === 0}
                <p class="m-0 px-2.5 pt-1 pb-3 text-[13px] text-text-3">
                  {$app.projects.length === 0
                    ? 'Belum ada proyek tersimpan.'
                    : 'Semua proyek sudah terbuka di tab.'}
                </p>
              {:else}
                <ul class="m-0 max-h-[320px] list-none overflow-y-auto p-0">
                  {#each closed as project (project.id)}
                    <li>
                      <button
                        type="button"
                        onclick={() => {
                          choose(project.id)
                        }}
                        class="press flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                      >
                        <span class="flex text-text-3"><Icon name="gantt" size={15} /></span>
                        <span class="min-w-0 flex-1 truncate text-[13px] font-medium"
                          >{project.name}</span
                        >
                        <span class="mono text-xs whitespace-nowrap text-text-3"
                          >{relativeDay(project.openedAt, today())}</span
                        >
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        {/if}
      {/snippet}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
