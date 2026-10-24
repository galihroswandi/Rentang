<script lang="ts">
  import type { AppStore } from '../../app/store/app-store.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import { describeNotice } from '../import/error-text.ts'
  import ImportReportDialog from '../import/ImportReportDialog.svelte'
  import ProjectScreen from '../project/ProjectScreen.svelte'
  import StartScreen from '../start/StartScreen.svelte'
  import { provideApp } from './context.ts'
  import Sidebar from './Sidebar.svelte'

  let { store, today }: { store: AppStore; today: () => IsoDate } = $props()

  // The store and clock are fixed for the app's lifetime, so capturing them once is intended.
  // svelte-ignore state_referenced_locally
  const { app } = provideApp(store, today)
</script>

<div class="flex min-h-screen bg-bg text-text">
  {#if $app.projects.length > 0}
    <Sidebar />
  {/if}
  <div class="flex min-w-0 flex-1 flex-col">
    {#if $app.notice}
      <div role="alert" class="flex items-center gap-3 border-b border-line bg-surface px-6 py-3">
        <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true" class="flex-none">
          <path d="M7 1.2L13.2 12.6H0.8z" class="fill-late" />
          <path
            d="M7 5.4v3.2M7 10.4v.2"
            fill="none"
            stroke-width="1.5"
            stroke-linecap="round"
            class="stroke-surface"
          />
        </svg>
        <span class="flex-1">{describeNotice($app.notice)}</span>
        <button
          type="button"
          onclick={() => {
            store.getState().dismissNotice()
          }}
          class="h-10 cursor-pointer rounded-lg border border-line px-3.5"
        >
          Tutup
        </button>
      </div>
    {/if}

    {#if $app.screen.kind === 'loading'}
      <p role="status" class="m-auto text-text-2">Memuat proyek…</p>
    {:else if $app.screen.kind === 'start' || !$app.current}
      <StartScreen />
    {:else}
      <ProjectScreen open={$app.current} saved={$app.notice?.kind !== 'storage-failed'} />
    {/if}
  </div>
</div>

<ImportReportDialog />
