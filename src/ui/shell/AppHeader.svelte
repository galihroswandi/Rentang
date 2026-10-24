<script lang="ts">
  import Icon from '../icons/Icon.svelte'
  import { useApp } from './context.ts'
  import Logo from './Logo.svelte'
  import SaveStatus from './SaveStatus.svelte'
  import ThemeToggle from './ThemeToggle.svelte'

  const { store, app, ui } = useApp()
</script>

<header
  class="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2"
>
  <button
    type="button"
    onclick={() => {
      store.getState().showList()
    }}
    class="press mr-auto flex items-center gap-2.5 rounded-md text-text"
    aria-label="Rentang, ke daftar proyek"
  >
    <Logo />
    <span class="text-base font-semibold tracking-[-0.01em]">Rentang</span>
  </button>

  {#if $app.saveState !== 'idle'}
    <SaveStatus state={$app.saveState} />
    <span aria-hidden="true" class="h-5 w-px bg-line max-sm:hidden"></span>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="btn max-md:w-9 max-md:px-0"
      onclick={() => {
        ui.pick('gan')
      }}
    >
      <Icon name="file-import" />
      <span class="max-md:sr-only">Impor .gan</span>
    </button>
    <button
      type="button"
      class="btn max-md:w-9 max-md:px-0"
      onclick={() => {
        ui.pick('rentang')
      }}
    >
      <Icon name="folder-open" />
      <span class="max-md:sr-only">Buka</span>
    </button>
    <button
      type="button"
      class="btn-primary pr-3.5 max-md:w-9 max-md:px-0"
      onclick={() => {
        ui.newProjectOpen = true
      }}
    >
      <Icon name="plus" strokeWidth={2} />
      <span class="max-md:sr-only">Proyek baru</span>
    </button>
    <ThemeToggle />
  </div>
</header>
