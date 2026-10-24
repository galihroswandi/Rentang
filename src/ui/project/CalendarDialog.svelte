<script lang="ts">
  import { flip } from 'svelte/animate'
  import { addHoliday, removeHoliday, setWorkingDays } from '../../app/edits/project-edits.ts'
  import { isIsoDate, type IsoDate } from '../../core/dates.ts'
  import type { Project } from '../../core/model.ts'
  import Dialog from '../dialog/Dialog.svelte'
  import { formatLongDate, formatWorkingDays } from '../format.ts'
  import Icon from '../icons/Icon.svelte'
  import { prefersReducedMotion, slide } from '../motion.ts'
  import { useApp } from '../shell/context.ts'

  let {
    open,
    project,
    defaultDate,
    onClose,
  }: { open: boolean; project: Project; defaultDate: IsoDate; onClose: () => void } = $props()

  const { store } = useApp()

  /** Monday first, as the week is read here; the number is the weekday (0 = Sunday). */
  const WEEK: { day: number; label: string; short: string }[] = [
    { day: 1, label: 'Senin', short: 'Sen' },
    { day: 2, label: 'Selasa', short: 'Sel' },
    { day: 3, label: 'Rabu', short: 'Rab' },
    { day: 4, label: 'Kamis', short: 'Kam' },
    { day: 5, label: 'Jumat', short: 'Jum' },
    { day: 6, label: 'Sabtu', short: 'Sab' },
    { day: 0, label: 'Minggu', short: 'Min' },
  ]

  let date: string = $state('')
  let name = $state('')
  let dateInput: HTMLInputElement | undefined = $state()

  const working = $derived(new Set(project.calendar.workingDays))
  const holidays = $derived(project.calendar.holidays)
  const validDate = $derived(isIsoDate(date))
  const taken = $derived(validDate && holidays.some((holiday) => holiday.date === date))

  $effect(() => {
    if (open) {
      date = defaultDate
      name = ''
    }
  })

  function toggleDay(day: number): void {
    const next = working.has(day)
      ? project.calendar.workingDays.filter((candidate) => candidate !== day)
      : [...project.calendar.workingDays, day]
    store.getState().edit('Hari kerja diubah', setWorkingDays(next))
  }

  function add(event: SubmitEvent): void {
    event.preventDefault()
    if (!isIsoDate(date)) return
    store.getState().edit('Hari libur ditambahkan', addHoliday(date, name))
    name = ''
    dateInput?.focus()
  }
</script>

<Dialog
  {open}
  onOpenChange={(next) => {
    if (!next) onClose()
  }}
  title="Kalender kerja"
  width={520}
  initialFocus={() => dateInput}
>
  {#snippet description()}
    Durasi tugas dihitung dalam hari kerja. Hari yang tidak dicentang dan tanggal libur dilewati.
  {/snippet}

  <fieldset class="m-0 mb-5 flex flex-col gap-2 border-0 p-0">
    <legend class="label mb-2">Hari kerja</legend>
    <div class="grid grid-cols-7 gap-1.5">
      {#each WEEK as item (item.day)}
        {@const on = working.has(item.day)}
        <label
          class={[
            'press flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-md border text-[12px]',
            on
              ? 'border-accent-border bg-accent-soft font-semibold text-text'
              : 'border-line-strong text-text-3 hover:border-text-3',
            on && working.size === 1 && 'cursor-not-allowed',
          ]}
          title={on && working.size === 1 ? 'Minimal satu hari kerja' : item.label}
        >
          <input
            type="checkbox"
            class="sr-only"
            checked={on}
            disabled={on && working.size === 1}
            onchange={() => {
              toggleDay(item.day)
            }}
          />
          <span aria-hidden="true">{item.short}</span>
          <span class="sr-only">{item.label}</span>
          <span
            aria-hidden="true"
            class={['text-[10px] font-normal', on ? 'text-accent-text' : 'text-text-3']}
          >
            {on ? 'kerja' : 'libur'}
          </span>
        </label>
      {/each}
    </div>
    <p class="m-0 text-xs text-text-3" aria-live="polite">
      Hari kerja: {formatWorkingDays(project.calendar.workingDays)}
    </p>
  </fieldset>

  <section aria-labelledby="holiday-heading" class="flex flex-col gap-2">
    <h3 id="holiday-heading" class="label m-0">Hari libur khusus</h3>
    <form class="flex flex-wrap gap-2" onsubmit={add}>
      <label class="sr-only" for="holiday-date">Tanggal libur</label>
      <input
        bind:this={dateInput}
        id="holiday-date"
        type="date"
        class="field mono w-[160px] flex-none"
        bind:value={date}
        required
      />
      <label class="sr-only" for="holiday-name">Nama hari libur (opsional)</label>
      <input
        id="holiday-name"
        class="field min-w-[140px] flex-1"
        bind:value={name}
        placeholder="Nama (opsional)"
        autocomplete="off"
      />
      <button type="submit" class="btn-primary h-[38px]" disabled={!validDate}>
        <Icon name="plus" strokeWidth={2} />
        {taken ? 'Perbarui' : 'Tambah'}
      </button>
    </form>

    {#if holidays.length === 0}
      <p
        class="m-0 rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-text-2"
      >
        Belum ada hari libur khusus. Akhir pekan sudah dihitung dari hari kerja di atas.
      </p>
    {:else}
      <ul class="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border border-line p-0">
        {#each holidays as holiday (holiday.date)}
          <li
            animate:flip={{ duration: prefersReducedMotion() ? 0 : 220 }}
            transition:slide
            class="flex items-center gap-3 border-b border-line bg-surface py-1.5 pr-1.5 pl-3 last:border-b-0"
          >
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[13px]">{holiday.name ?? 'Libur'}</span>
              <time datetime={holiday.date} class="mono text-[11.5px] text-text-3"
                >{formatLongDate(holiday.date)}</time
              >
            </span>
            <button
              type="button"
              aria-label={`Hapus hari libur ${formatLongDate(holiday.date)}`}
              title="Hapus"
              class="btn-ghost size-9 hover:text-danger"
              onclick={() => {
                store.getState().edit('Hari libur dihapus', removeHoliday(holiday.date))
              }}
            >
              <Icon name="trash" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#snippet footer()}
    <button type="button" class="btn-primary h-10 px-4" onclick={onClose}>Selesai</button>
  {/snippet}
</Dialog>
