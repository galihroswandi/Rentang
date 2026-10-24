<script lang="ts">
  import Logo from '../shell/Logo.svelte'
  import { useApp } from '../shell/context.ts'

  const { store, app } = useApp()

  let ganInput: HTMLInputElement | undefined = $state()
  let rentangInput: HTMLInputElement | undefined = $state()
  let dragging = $state(false)

  async function openFiles(files: FileList | null | undefined): Promise<void> {
    const file = files?.[0]
    if (!file) return
    await store.getState().openFile({ name: file.name, text: await file.text() })
  }

  function onChange(event: Event & { currentTarget: HTMLInputElement }): void {
    const input = event.currentTarget
    void openFiles(input.files).finally(() => {
      // Allow choosing the same file again after an error.
      input.value = ''
    })
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault()
    dragging = false
    void openFiles(event.dataTransfer?.files)
  }

  function onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return
    event.preventDefault()
    dragging = true
  }

  const steps = [
    'Periksa laporan impor: apa yang masuk, apa yang diubah, dan apa yang dilewati.',
    'Proyek tersimpan di browser ini dan muncul di sidebar.',
    'Berkas .gan asli tidak pernah diubah. Rentang hanya membacanya.',
  ]
</script>

<svelte:window
  ondragover={onDragOver}
  ondragleave={(event: DragEvent) => {
    if (event.relatedTarget === null) dragging = false
  }}
  ondrop={onDrop}
/>

<div
  class={[
    'flex min-h-screen flex-1 flex-col',
    dragging && 'outline-4 -outline-offset-8 outline-dashed outline-critical',
  ]}
>
  {#if $app.projects.length === 0}
    <header class="flex min-h-14 items-center gap-2.5 px-6">
      <Logo />
      <span class="text-[17px] font-semibold">Rentang</span>
    </header>
  {/if}

  <main class="flex flex-1 justify-center px-6 pt-8 pb-10">
    <div class="flex w-full max-w-220 flex-col gap-7">
      <div>
        <h1 class="m-0 text-[28px] leading-tight font-semibold">Mulai dari mana?</h1>
        <p class="mt-2 mb-0 max-w-150 text-[15px] leading-relaxed text-text-2">
          Jadwal, catatan, dan kemajuan proyek Anda dalam satu tempat. Berkas diproses di komputer
          Anda dan tidak dikirim ke mana pun.
        </p>
      </div>

      <div class="flex flex-wrap gap-4">
        <button
          type="button"
          onclick={() => ganInput?.click()}
          class="flex min-h-52 min-w-0 flex-[1_1_240px] cursor-pointer flex-col gap-2.5 rounded-[12px] border-2 border-critical bg-selected p-5 text-left"
        >
          <span
            class="flex size-11 items-center justify-center rounded-[10px] border border-bar-border bg-surface"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="stroke-text"
            >
              <path d="M12 4v11M7 10l5 5 5-5" />
              <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
            </svg>
          </span>
          <span class="text-base font-semibold">Impor dari GanttProject</span>
          <span class="leading-normal text-text-2">
            Buka berkas .gan. Tugas, dependensi, resource, dan kalender ikut masuk, lalu Anda
            melihat laporan impornya.
          </span>
          <span class="mt-auto font-mono text-sm text-text-2">Berkas .gan</span>
        </button>

        <button
          type="button"
          onclick={() => rentangInput?.click()}
          class="flex min-h-52 min-w-0 flex-[1_1_240px] cursor-pointer flex-col gap-2.5 rounded-[12px] border border-line bg-surface p-5 text-left"
        >
          <span
            class="flex size-11 items-center justify-center rounded-[10px] border border-bar-border bg-surface"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="stroke-text"
            >
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </span>
          <span class="text-base font-semibold">Buka berkas Rentang</span>
          <span class="leading-normal text-text-2">
            Lanjutkan proyek yang sudah pernah disimpan sebagai berkas .rentang.
          </span>
          <span class="mt-auto font-mono text-sm text-text-2">Berkas .rentang</span>
        </button>
      </div>

      <input
        bind:this={ganInput}
        type="file"
        accept=".gan"
        class="hidden"
        aria-label="Pilih berkas .gan"
        onchange={onChange}
      />
      <input
        bind:this={rentangInput}
        type="file"
        accept=".rentang"
        class="hidden"
        aria-label="Pilih berkas .rentang"
        onchange={onChange}
      />

      <div
        class="flex flex-wrap items-center gap-4 rounded-[12px] border-2 border-dashed border-bar-border bg-surface px-5 py-4.5"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="stroke-text-2"
        >
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span class="min-w-55 flex-1 text-sm">
          Atau seret berkas <strong>.gan</strong> atau <strong>.rentang</strong> ke mana saja di halaman
          ini.
        </span>
        <button
          type="button"
          onclick={() => {
            void store.getState().openDemo()
          }}
          class="h-10 cursor-pointer rounded-lg border border-bar-border bg-surface px-4"
        >
          Coba dengan proyek demo
        </button>
      </div>

      <section aria-labelledby="next-steps">
        <h2 id="next-steps" class="mt-0 mb-2.5 text-md font-semibold text-text-2">Setelah ini</h2>
        <ol class="m-0 flex list-none flex-wrap gap-3 p-0">
          {#each steps as step, index (step)}
            <li class="flex flex-[1_1_220px] items-start gap-2.5">
              <span
                class="flex size-6 flex-none items-center justify-center rounded-full bg-text text-sm font-semibold text-surface"
              >
                {index + 1}
              </span>
              <span class="leading-normal">{step}</span>
            </li>
          {/each}
        </ol>
      </section>
    </div>
  </main>
</div>
