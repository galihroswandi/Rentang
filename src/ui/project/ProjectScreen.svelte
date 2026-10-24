<script lang="ts">
  import type { OpenProject } from '../../app/store/app-store.ts'
  import { summarizeProject } from '../../core/summary.ts'
  import type { Zoom } from '../gantt/layout.ts'
  import { AREA_LABELS } from '../labels.ts'
  import { useApp } from '../shell/context.ts'
  import TaskTimeline from './TaskTimeline.svelte'

  let { open, saved }: { open: OpenProject; saved: boolean } = $props()

  const { today } = useApp()
  let zoom: Zoom = $state('week')
  let todayRequest = $state(0)

  const analysis = $derived(open.analysis.ok ? open.analysis.value : null)
  const summary = $derived(
    analysis ? summarizeProject(open.project, analysis.schedule, today()) : null,
  )
  const names = $derived(new Map(open.project.tasks.map((task) => [task.id, task.name])))
  const cycle = $derived(
    open.analysis.ok
      ? null
      : [...open.analysis.error.taskIds, open.analysis.error.taskIds[0] ?? '']
          .map((id) => names.get(id) ?? id)
          .join(' → '),
  )

  const zooms: { value: Zoom; label: string }[] = [
    { value: 'day', label: 'Hari' },
    { value: 'week', label: 'Minggu' },
    { value: 'month', label: 'Bulan' },
  ]
</script>

<div class="flex h-screen min-w-0 flex-1 flex-col">
  <header
    class="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-6 pt-3.5 pb-3.5"
  >
    <div class="min-w-50 flex-1">
      <div class="text-sm text-text-2">{AREA_LABELS[open.project.area]}</div>
      <h1 class="mt-0.5 mb-0 text-xl leading-tight font-semibold">{open.project.name}</h1>
    </div>
    <span class="flex items-center gap-2 text-sm text-text-2" role="status">
      {#if saved}
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="6" class="fill-text" />
          <path
            d="M4 7.2l2 2L10 5"
            fill="none"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="stroke-surface"
          />
        </svg>
        Tersimpan di browser ini
      {:else}
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
          ><path d="M7 1.2L13.2 12.6H0.8z" class="fill-late" /></svg
        >
        Belum tersimpan
      {/if}
    </span>
    {#if open.origin === 'demo'}
      <span class="rounded-full border border-line bg-bg px-2.5 py-1 text-sm text-text-2"
        >Demo · data fiktif</span
      >
    {/if}
  </header>

  <div class="flex min-h-14 flex-wrap items-center gap-2 border-b border-line bg-surface px-6 py-2">
    <button
      type="button"
      disabled={!analysis}
      onclick={() => (todayRequest += 1)}
      class="h-10 cursor-pointer rounded-lg border border-line bg-surface px-3.5 disabled:cursor-not-allowed disabled:text-text-3"
    >
      Hari ini
    </button>
    <div class="flex-1"></div>
    {#if summary}
      <span class="mr-1 text-sm text-text-2"
        >{summary.taskCount} tugas · {summary.progress}% selesai</span
      >
    {/if}
    <div
      role="group"
      aria-label="Skala waktu"
      class="flex gap-0.5 rounded-[10px] border border-line bg-bg p-[3px]"
    >
      {#each zooms as option (option.value)}
        <button
          type="button"
          aria-pressed={zoom === option.value}
          onclick={() => {
            zoom = option.value
          }}
          class={[
            'h-[34px] cursor-pointer rounded-[7px] border px-3.5',
            zoom === option.value
              ? 'border-line bg-surface font-semibold text-text'
              : 'border-transparent text-text-2',
          ]}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  {#if cycle}
    <div role="alert" class="border-b border-line bg-surface px-6 py-3 text-late">
      Jadwal tidak bisa dihitung karena ada dependensi melingkar: {cycle}. Perbaiki di berkas
      aslinya, lalu impor ulang.
    </div>
  {/if}

  {#key open.project.id}
    <TaskTimeline
      project={open.project}
      {analysis}
      progress={open.progress}
      {zoom}
      today={today()}
      {todayRequest}
    />
  {/key}

  <footer
    class="flex min-h-11 flex-wrap items-center gap-5 border-t border-line bg-surface px-6 py-2 text-sm text-text-2"
  >
    <span class="flex items-center gap-2">
      <span class="h-3 w-6 rounded-sm border-2 border-critical bg-bar"></span>Jalur kritis (tepi
      tebal)
    </span>
    <span class="flex items-center gap-2"
      ><span class="size-2.5 rotate-45 bg-text"></span>Milestone</span
    >
    <span class="flex items-center gap-2"><span class="h-3.5 w-0.5 bg-today"></span>Hari ini</span>
    <div class="flex-1"></div>
    <span>Panah atas dan bawah untuk berpindah, kiri dan kanan untuk membuka atau menutup grup</span
    >
  </footer>
</div>
