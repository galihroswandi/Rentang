<script lang="ts">
  import CountUp from '../dialog/CountUp.svelte'
  import Dialog from '../dialog/Dialog.svelte'
  import Icon from '../icons/Icon.svelte'
  import { useApp } from '../shell/context.ts'
  import { describeReport } from './report-text.ts'

  const { store, app } = useApp()

  const pending = $derived($app.pendingImport)
  const text = $derived(pending ? describeReport(pending.report, pending.project) : null)
  let saveButton: HTMLButtonElement | undefined = $state()
</script>

<Dialog
  open={pending !== null}
  onOpenChange={(open) => {
    if (!open) store.getState().cancelImport()
  }}
  title="Laporan impor"
  width={760}
  initialFocus={() => saveButton}
>
  {#snippet description()}
    <span class="mono text-xs">{pending?.fileName}</span> · diproses di browser Anda, tidak dikirim ke
    mana pun
  {/snippet}

  {#if text}
    <dl class="m-0 grid grid-cols-3 gap-3 pb-4">
      {#each [{ value: text.counts.imported, label: 'tugas diimpor' }, { value: text.counts.changed, label: 'diubah' }, { value: text.counts.skipped, label: 'dilewati' }] as count, index (count.label)}
        <div
          class="stagger flex flex-col-reverse rounded-md border border-line bg-surface-2 px-3.5 py-3"
          style:--i={index}
        >
          <dt class="text-xs text-text-2">{count.label}</dt>
          <dd class="mono m-0 text-2xl font-medium"><CountUp value={count.value} /></dd>
        </div>
      {/each}
    </dl>

    <div class="flex flex-col gap-4.5">
      <section aria-labelledby="report-ok" class="stagger" style:--i="3">
        <h3 id="report-ok" class="mt-0 mb-2 flex items-center gap-2 text-sm font-semibold">
          <span class="flex size-5 items-center justify-center rounded-full bg-text text-surface"
            ><Icon name="check" size={12} strokeWidth={3} /></span
          >
          Berhasil
        </h3>
        <ul class="m-0 pl-7 leading-[1.75]">
          {#each text.imported as item (item)}<li>{item}</li>{/each}
        </ul>
      </section>

      {#if text.changed.length > 0}
        <section aria-labelledby="report-changed" class="stagger" style:--i="4">
          <h3 id="report-changed" class="mt-0 mb-2 flex items-center gap-2 text-sm font-semibold">
            <span
              class="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent-text"
              ><Icon name="sparkles" size={12} strokeWidth={2} /></span
            >
            Diubah agar sesuai
          </h3>
          <ul class="m-0 pl-7 leading-[1.75]">
            {#each text.changed as item (item.text)}
              <li>
                {item.text}
                {#if item.detail}<br /><span class="text-xs text-text-2">{item.detail}</span>{/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if text.skipped.length > 0}
        <section aria-labelledby="report-skipped" class="stagger" style:--i="5">
          <h3 id="report-skipped" class="mt-0 mb-2 flex items-center gap-2 text-sm font-semibold">
            <span
              class="flex size-5 items-center justify-center rounded-full bg-surface-2 text-text-2 ring-1 ring-line-strong"
              ><Icon name="x" size={11} strokeWidth={2.5} /></span
            >
            Dilewati, belum didukung
          </h3>
          <ul class="m-0 pl-7 leading-[1.75]">
            {#each text.skipped as item (item.text)}
              <li>
                {item.text}
                {#if item.detail}<br /><span class="text-xs text-text-2">{item.detail}</span>{/if}
              </li>
            {/each}
          </ul>
          <p class="mt-2 mb-0 text-xs leading-normal text-text-2">
            Data yang dilewati tidak dihapus dari berkas asli Anda. Rentang hanya membaca, tidak
            menulis ke berkas itu.
          </p>
        </section>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <span class="mr-auto min-w-50 flex-1 text-xs leading-normal text-text-2">
      Proyek disimpan di browser ini. Berkas .gan asli tidak diubah.
    </span>
    <button
      type="button"
      class="btn h-10"
      onclick={() => {
        store.getState().cancelImport()
      }}>Batal</button
    >
    <button
      bind:this={saveButton}
      type="button"
      class="btn-primary h-10 px-4"
      onclick={() => {
        void store.getState().confirmImport()
      }}
    >
      Simpan dan buka proyek
    </button>
  {/snippet}
</Dialog>
