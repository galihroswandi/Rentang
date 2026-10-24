<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { useApp } from '../shell/context.ts'
  import { describeReport } from './report-text.ts'

  const { store, app } = useApp()

  const pending = $derived($app.pendingImport)
  const text = $derived(pending ? describeReport(pending.report, pending.project) : null)
</script>

<Dialog.Root
  open={pending !== null}
  onOpenChange={(open) => {
    if (!open) store.getState().cancelImport()
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-text/40" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 flex max-h-[min(720px,calc(100vh-32px))] w-[min(800px,calc(100vw-32px))] -translate-1/2 flex-col overflow-hidden rounded-[14px] border border-bar-border bg-surface text-text"
    >
      {#if pending && text}
        <div class="px-7 pt-6 pb-4">
          <Dialog.Title level={1} class="m-0 text-xl font-semibold">Laporan impor</Dialog.Title>
          <Dialog.Description class="mt-1.5 mb-0 text-text-2">
            <span class="font-mono text-sm">{pending.fileName}</span> · diproses di browser Anda, tidak
            dikirim ke mana pun
          </Dialog.Description>
        </div>

        <dl class="m-0 flex gap-3 px-7 pb-4">
          {#each [{ value: text.counts.imported, label: 'tugas diimpor' }, { value: text.counts.changed, label: 'diubah' }, { value: text.counts.skipped, label: 'dilewati' }] as count (count.label)}
            <div
              class="flex flex-1 flex-col-reverse rounded-lg border border-line bg-bg px-3.5 py-3"
            >
              <dt class="text-sm text-text-2">{count.label}</dt>
              <dd class="m-0 font-mono text-2xl font-medium">{count.value}</dd>
            </div>
          {/each}
        </dl>

        <div class="flex min-h-0 flex-1 flex-col gap-4.5 overflow-auto px-7 pb-4">
          <section aria-labelledby="report-ok">
            <h2 id="report-ok" class="mt-0 mb-2 flex items-center gap-2 text-sm font-semibold">
              <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
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
              Berhasil
            </h2>
            <ul class="m-0 pl-6 leading-[1.7]">
              {#each text.imported as item (item)}
                <li>{item}</li>
              {/each}
            </ul>
          </section>

          {#if text.changed.length > 0}
            <section aria-labelledby="report-changed">
              <h2
                id="report-changed"
                class="mt-0 mb-2 flex items-center gap-2 text-sm font-semibold"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  class="stroke-accent-text"
                >
                  <path d="M7 7h12l-3-3M17 17H5l3 3" />
                </svg>
                Diubah agar sesuai
              </h2>
              <ul class="m-0 pl-6 leading-[1.7]">
                {#each text.changed as item (item.text)}
                  <li>
                    {item.text}
                    {#if item.detail}<br /><span class="text-sm text-text-2">{item.detail}</span
                      >{/if}
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          {#if text.skipped.length > 0}
            <section aria-labelledby="report-skipped">
              <h2
                id="report-skipped"
                class="mt-0 mb-2 flex items-center gap-2 text-sm font-semibold"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"
                  class="stroke-text-2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12h8" />
                </svg>
                Dilewati, belum didukung
              </h2>
              <ul class="m-0 pl-6 leading-[1.7]">
                {#each text.skipped as item (item.text)}
                  <li>
                    {item.text}
                    {#if item.detail}<br /><span class="text-sm text-text-2">{item.detail}</span
                      >{/if}
                  </li>
                {/each}
              </ul>
              <p class="mt-2 mb-0 text-sm leading-normal text-text-2">
                Data yang dilewati tidak dihapus dari berkas asli Anda. Rentang hanya membaca, tidak
                menulis ke berkas itu.
              </p>
            </section>
          {/if}
        </div>

        <div class="flex flex-wrap items-center gap-2.5 border-t border-line bg-bg px-7 py-4">
          <span class="min-w-55 flex-1 text-sm leading-normal text-text-2">
            Proyek disimpan di browser ini. Berkas .gan asli tidak diubah.
          </span>
          <Dialog.Close
            class="h-11 cursor-pointer rounded-lg border border-bar-border bg-surface px-4.5"
            >Batal</Dialog.Close
          >
          <button
            type="button"
            onclick={() => {
              void store.getState().confirmImport()
            }}
            class="h-11 cursor-pointer rounded-lg bg-amber px-5 font-semibold text-on-amber"
          >
            Simpan dan buka proyek
          </button>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
