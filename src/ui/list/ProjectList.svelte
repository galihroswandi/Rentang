<script lang="ts">
  import { flip } from 'svelte/animate'
  import type { StoredProjectSummary } from '../../app/persistence/storage-provider.ts'
  import Icon from '../icons/Icon.svelte'
  import { fade, prefersReducedMotion } from '../motion.ts'
  import { prefs } from '../prefs.ts'
  import { useApp } from '../shell/context.ts'
  import Segmented from '../shell/Segmented.svelte'
  import EmptyState from './EmptyState.svelte'
  import { filterProjects, milestoneText, relativeDay } from './list-text.ts'

  const { store, app, today } = useApp()

  let mode = $state(prefs.listMode())
  let query = $state('')
  const shown = $derived(filterProjects($app.projects, query))
  const flipDuration = prefersReducedMotion() ? 0 : 260

  function open(project: StoredProjectSummary): void {
    void store.getState().openProject(project.id)
  }
</script>

{#snippet fileLine(project: StoredProjectSummary)}
  <span class="mono flex min-w-0 items-center gap-1.5 text-xs text-text-3">
    <Icon name="file" size={12} strokeWidth={2} />
    <span class="truncate"
      >{project.fileName ?? (project.origin === 'demo' ? 'proyek demo' : 'dibuat di Rentang')}</span
    >
  </span>
{/snippet}

{#snippet progressBar(project: StoredProjectSummary, index: number)}
  <span class="flex items-center gap-2.5">
    <span class="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-track">
      <span
        class="grow-x block h-full rounded-[3px] bg-accent"
        style:width={`${String(project.progress)}%`}
        style:--i={index}
      ></span>
    </span>
    <span class="mono w-10 text-right text-[12.5px] text-text-2">{project.progress}%</span>
  </span>
{/snippet}

{#snippet milestone(project: StoredProjectSummary, compact: boolean)}
  {@const text = milestoneText(project, today())}
  {#if text}
    <span class={['flex min-w-0 gap-2', compact ? 'items-center' : 'items-start']}>
      <span class={['flex', !compact && 'pt-0.5', text.done ? 'text-text-3' : 'text-accent-text']}>
        <Icon name={text.done ? 'check' : 'flag'} size={15} strokeWidth={text.done ? 2 : 1.75} />
      </span>
      {#if compact}
        <span class="truncate text-[13px]">{text.name}</span>
        <span class="mono ml-auto text-xs whitespace-nowrap text-text-3">{text.date}</span>
      {:else}
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-[13.5px]">{text.name}</span>
          <span class="mono text-xs text-text-3">{text.date}</span>
        </span>
      {/if}
    </span>
  {:else}
    <span class="text-[13px] text-text-3">Belum ada milestone</span>
  {/if}
{/snippet}

{#if $app.projects.length === 0}
  <EmptyState />
{:else}
  <main
    class="mx-auto box-border flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-10 pt-8 pb-12 max-md:px-4 max-md:pt-5"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
      <h1 class="m-0 mr-auto text-[22px] font-semibold tracking-[-0.015em]">Proyek terakhir</h1>
      <label
        class="press flex h-9 w-[300px] max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-text-3 focus-within:border-accent-border focus-within:shadow-[0_0_0_3px_rgb(245_158_11/25%)] max-sm:w-full max-sm:flex-1"
      >
        <Icon name="search" />
        <span class="sr-only">Cari proyek</span>
        <input
          type="search"
          bind:value={query}
          placeholder="Cari nama atau berkas"
          class="h-full min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-text outline-none"
        />
      </label>
      <Segmented
        label="Mode tampilan"
        value={mode}
        options={[
          { value: 'table', label: 'Tabel', icon: 'table' },
          { value: 'cards', label: 'Kartu', icon: 'cards' },
        ]}
        onChange={(next: 'table' | 'cards') => {
          mode = next
          prefs.setListMode(next)
        }}
      />
    </div>

    {#if shown.length === 0}
      <p
        in:fade
        class="m-0 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-text-2"
      >
        Tidak ada proyek yang cocok dengan “{query}”.
      </p>
    {:else if mode === 'table'}
      <div
        in:fade
        class="@container overflow-hidden rounded-lg border border-line bg-surface shadow-sm"
      >
        <div
          aria-hidden="true"
          class="row-grid hidden h-[42px] items-center gap-4 border-b border-line bg-surface-2 px-5 text-xs font-semibold text-text-2 @3xl:grid"
        >
          <span>Nama proyek</span><span>Progres</span><span>Milestone berikutnya</span><span
            >Dibuka</span
          ><span></span>
        </div>
        <ul class="m-0 list-none p-0">
          {#each shown as project, index (project.id)}
            <li
              animate:flip={{ duration: flipDuration }}
              class="stagger border-b border-line last:border-b-0"
              style:--i={index}
            >
              <button
                type="button"
                onclick={() => {
                  open(project)
                }}
                class="row group w-full px-5 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <span class="flex min-w-0 flex-col gap-[3px]">
                  <span class="truncate text-sm font-semibold">{project.name}</span>
                  {@render fileLine(project)}
                </span>
                <span class="row-progress">
                  <span class="sr-only">Progres</span>
                  {@render progressBar(project, index)}
                </span>
                <span class="row-milestone min-w-0">
                  <span class="sr-only">Milestone berikutnya:</span>
                  {@render milestone(project, false)}
                </span>
                <span class="row-opened flex items-center gap-[7px] text-[13px] text-text-2">
                  <Icon name="clock" size={14} />
                  <span class="sr-only">Dibuka</span>
                  {relativeDay(project.openedAt, today())}
                </span>
                <span
                  class="row-chevron flex text-text-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text"
                >
                  <Icon name="chevron-right" />
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <ul
        in:fade
        class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4 p-0"
      >
        {#each shown as project, index (project.id)}
          <li animate:flip={{ duration: flipDuration }} class="stagger" style:--i={index}>
            <button
              type="button"
              onclick={() => {
                open(project)
              }}
              class="group flex h-full w-full flex-col gap-4 rounded-lg border border-line bg-surface px-[18px] pt-[18px] pb-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
            >
              <span class="flex min-w-0 flex-col gap-[3px]">
                <span class="truncate text-[15px] font-semibold">{project.name}</span>
                {@render fileLine(project)}
              </span>
              {@render progressBar(project, index)}
              {@render milestone(project, true)}
              <span
                class="mt-auto flex items-center gap-[7px] border-t border-line pt-3 text-[12.5px] text-text-2"
              >
                <Icon name="clock" size={14} />
                Dibuka {relativeDay(project.openedAt, today()).toLowerCase()}
                <span
                  class="ml-auto flex text-text-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text"
                >
                  <Icon name="chevron-right" />
                </span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </main>
{/if}

<style>
  .row-grid,
  .row {
    grid-template-columns:
      minmax(240px, 2.2fr) minmax(170px, 1.2fr) minmax(190px, 1.4fr)
      minmax(130px, 1fr) 20px;
  }
  /* Narrow containers stack each row; wide ones line the cells up under the header. */
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 20px;
    grid-template-areas:
      'name chevron'
      'progress chevron'
      'milestone chevron'
      'opened chevron';
    gap: 10px 16px;
    align-items: center;
  }
  .row > :first-child {
    grid-area: name;
  }
  .row-progress {
    grid-area: progress;
  }
  .row-milestone {
    grid-area: milestone;
  }
  .row-opened {
    grid-area: opened;
  }
  .row-chevron {
    grid-area: chevron;
  }
  @container (min-width: 48rem) {
    .row {
      min-height: 68px;
      grid-template-columns:
        minmax(240px, 2.2fr) minmax(170px, 1.2fr) minmax(190px, 1.4fr)
        minmax(130px, 1fr) 20px;
      grid-template-areas: 'name progress milestone opened chevron';
    }
  }
</style>
