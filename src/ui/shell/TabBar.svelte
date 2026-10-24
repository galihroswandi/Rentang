<script lang="ts">
  import { flip } from 'svelte/animate'
  import Icon from '../icons/Icon.svelte'
  import { prefersReducedMotion, scale } from '../motion.ts'
  import { useApp } from './context.ts'

  const { store, app } = useApp()

  const tabs = $derived(
    $app.tabs.map((id) => ({ id, name: $app.sessions[id]?.project.name ?? 'Proyek' })),
  )
  const flipDuration = prefersReducedMotion() ? 0 : 220
</script>

<!-- Tabs switch views inside one page, so they are buttons with aria-current, as in the design. -->
<nav
  aria-label="Tab proyek"
  class="flex items-end gap-1 overflow-x-auto bg-tab-bar px-3 pt-1.5 [scrollbar-width:none]"
>
  <button
    type="button"
    aria-current={$app.active === null ? 'page' : undefined}
    onclick={() => {
      store.getState().showList()
    }}
    class={['tab', $app.active === null && 'tab-active']}
  >
    <Icon name="layout-list" size={15} />
    Daftar proyek
  </button>

  {#each tabs as tab (tab.id)}
    <div
      animate:flip={{ duration: flipDuration }}
      in:scale={{ start: 0.9, duration: 220 }}
      out:scale={{ start: 0.9, duration: 160 }}
      class={['tab pr-1.5', $app.active === tab.id && 'tab-active']}
    >
      <button
        type="button"
        aria-current={$app.active === tab.id ? 'page' : undefined}
        onclick={() => {
          void store.getState().openProject(tab.id)
        }}
        class="flex h-full max-w-[220px] items-center gap-2"
      >
        <Icon name="gantt" size={15} />
        <span class="truncate">{tab.name}</span>
      </button>
      <button
        type="button"
        aria-label={`Tutup tab ${tab.name}`}
        onclick={() => {
          store.getState().closeTab(tab.id)
        }}
        class="btn-ghost ml-1.5 size-6 text-text-3"
      >
        <Icon name="x" size={14} strokeWidth={2} />
      </button>
    </div>
  {/each}

  <button
    type="button"
    aria-label="Buka proyek lain"
    title="Buka proyek lain"
    onclick={() => {
      store.getState().showList()
    }}
    class="btn-ghost mb-0.5 ml-0.5 size-8 flex-none"
  >
    <Icon name="plus" />
  </button>
</nav>

<style>
  .tab {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border-radius: 8px 8px 0 0;
    white-space: nowrap;
    font-size: 13px;
    color: var(--color-text-2);
    transition:
      background-color 200ms var(--ease-out),
      color 200ms var(--ease-out);
  }
  .tab:hover:not(.tab-active) {
    color: var(--color-text);
    background: color-mix(in oklab, var(--color-surface) 45%, transparent);
  }
  .tab-active {
    z-index: 1;
    background: var(--color-bg);
    color: var(--color-text);
    font-weight: 600;
  }
  /* Inverted corners join the active tab to the page below it. */
  .tab-active::before,
  .tab-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    width: 8px;
    height: 8px;
  }
  .tab-active::before {
    left: -8px;
    background: radial-gradient(circle at 0 0, transparent 7.5px, var(--color-bg) 8px);
  }
  .tab-active::after {
    right: -8px;
    background: radial-gradient(circle at 100% 0, transparent 7.5px, var(--color-bg) 8px);
  }
</style>
