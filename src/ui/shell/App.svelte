<script lang="ts">
  import type { AppStore } from '../../app/store/app-store.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import Icon from '../icons/Icon.svelte'
  import { describeNotice } from '../import/error-text.ts'
  import ImportReportDialog from '../import/ImportReportDialog.svelte'
  import ProjectList from '../list/ProjectList.svelte'
  import { fade, fly, slide } from '../motion.ts'
  import ProjectView from '../project/ProjectView.svelte'
  import AppHeader from './AppHeader.svelte'
  import { provideApp } from './context.ts'
  import NewProjectDialog from './NewProjectDialog.svelte'
  import TabBar from './TabBar.svelte'
  import Toast from './Toast.svelte'
  import type { FileKind } from './ui-state.svelte.ts'

  let { store, today }: { store: AppStore; today: () => IsoDate } = $props()

  // The store and clock are fixed for the app's lifetime, so capturing them once is intended.
  // svelte-ignore state_referenced_locally
  const { app, ui } = provideApp(store, today)

  const inputs: Partial<Record<FileKind, HTMLInputElement>> = {}
  ui.registerPicker((kind) => inputs[kind]?.click())

  let dragDepth = $state(0)
  const session = $derived($app.active === null ? null : ($app.sessions[$app.active] ?? null))

  async function openFiles(files: FileList | null | undefined): Promise<void> {
    const file = files?.[0]
    if (!file) return
    await store.getState().openFile({ name: file.name, text: await file.text() })
  }

  function hasFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes('Files') ?? false
  }

  function isEditable(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    )
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!session || isEditable(event.target) || !(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault()
      store.getState().undo()
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault()
      store.getState().redo()
    }
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  ondragenter={(event: DragEvent) => {
    if (hasFiles(event)) dragDepth += 1
  }}
  ondragleave={(event: DragEvent) => {
    if (hasFiles(event)) dragDepth = Math.max(0, dragDepth - 1)
  }}
  ondragover={(event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault()
  }}
  ondrop={(event: DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth = 0
    void openFiles(event.dataTransfer?.files)
  }}
/>

<div class="flex min-h-dvh flex-col bg-bg text-text">
  <AppHeader />
  <TabBar />

  {#if $app.notice}
    <div
      transition:slide
      role="alert"
      class="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 text-[13px]"
    >
      <span class="flex text-danger"><Icon name="alert" /></span>
      <span class="flex-1">{describeNotice($app.notice)}</span>
      <button
        type="button"
        class="btn h-8"
        onclick={() => {
          store.getState().dismissNotice()
        }}>Tutup</button
      >
    </div>
  {/if}

  {#if !$app.ready}
    <p role="status" class="m-auto text-text-2">Memuat proyek…</p>
  {:else}
    {#key $app.active}
      <div in:fly={{ y: 8, duration: 260 }} class="flex min-h-0 flex-1 flex-col">
        {#if session}
          <ProjectView {session} />
        {:else}
          <ProjectList />
        {/if}
      </div>
    {/key}
  {/if}
</div>

<input
  bind:this={inputs.gan}
  type="file"
  accept=".gan"
  class="hidden"
  aria-label="Pilih berkas .gan"
  onchange={(event) => {
    const input = event.currentTarget
    void openFiles(input.files).finally(() => (input.value = ''))
  }}
/>
<input
  bind:this={inputs.rentang}
  type="file"
  accept=".rentang"
  class="hidden"
  aria-label="Pilih berkas .rentang"
  onchange={(event) => {
    const input = event.currentTarget
    void openFiles(input.files).finally(() => (input.value = ''))
  }}
/>

{#if dragDepth > 0}
  <div
    transition:fade={{ duration: 150 }}
    class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgb(10_9_8/35%)] p-6 backdrop-blur-[2px]"
  >
    <div
      class="drop flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-surface px-10 py-8 text-center shadow-pop"
    >
      <span
        class="bounce flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-text"
        ><Icon name="upload" size={26} /></span
      >
      <p class="m-0 text-base font-semibold">Lepaskan untuk membuka</p>
      <p class="m-0 text-[13px] text-text-2">Berkas .gan atau .rentang</p>
    </div>
  </div>
{/if}

<ImportReportDialog />
<NewProjectDialog />
<Toast />

<style>
  .drop {
    animation: pop 360ms var(--ease-out);
  }
  .bounce {
    animation: bounce 1.2s var(--ease-out) infinite;
  }
  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }
</style>
