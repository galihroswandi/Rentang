<script lang="ts">
  import Icon, { type IconName } from '../icons/Icon.svelte'
  import { useApp } from '../shell/context.ts'

  const { store, ui } = useApp()

  const options: {
    icon: IconName
    title: string
    text: string
    hint: string
    primary?: boolean
    run: () => void
  }[] = [
    {
      icon: 'file-import',
      title: 'Impor dari GanttProject',
      text: 'Buka berkas .gan. Tugas, dependensi, orang, role, dan kalender ikut masuk, lalu Anda melihat laporan impornya.',
      hint: 'Berkas .gan',
      primary: true,
      run: () => {
        ui.pick('gan')
      },
    },
    {
      icon: 'folder-open',
      title: 'Buka berkas Rentang',
      text: 'Lanjutkan proyek yang sudah pernah disimpan sebagai berkas .rentang.',
      hint: 'Berkas .rentang',
      run: () => {
        ui.pick('rentang')
      },
    },
    {
      icon: 'plus',
      title: 'Proyek kosong',
      text: 'Mulai dari nol dengan nama dan bidang. Tugas pertama bisa langsung ditambahkan.',
      hint: 'Proyek baru',
      run: () => {
        ui.newProjectOpen = true
      },
    },
  ]
</script>

<main
  class="mx-auto box-border flex w-full max-w-[920px] flex-1 flex-col gap-7 px-6 pt-10 pb-12 max-md:px-4 max-md:pt-6"
>
  <div class="stagger">
    <h1 class="m-0 text-[28px] leading-tight font-semibold tracking-[-0.02em] max-sm:text-2xl">
      Mulai dari mana?
    </h1>
    <p class="mt-2 mb-0 max-w-[600px] text-[15px] leading-relaxed text-text-2">
      Jadwal, catatan, dan kemajuan proyek Anda dalam satu tempat. Berkas diproses di komputer Anda
      dan tidak dikirim ke mana pun.
    </p>
  </div>

  <div class="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
    {#each options as option, index (option.title)}
      <button
        type="button"
        onclick={option.run}
        style:--i={index + 1}
        class={[
          'stagger group flex min-h-48 flex-col gap-2.5 rounded-lg p-5 text-left transition-[transform,box-shadow,border-color] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-lift',
          option.primary
            ? 'border-2 border-accent-border bg-accent-soft'
            : 'border border-line bg-surface shadow-sm hover:border-line-strong',
        ]}
      >
        <span
          class="flex size-11 items-center justify-center rounded-[10px] border border-line-strong bg-surface text-text transition-transform duration-300 ease-(--ease-spring) group-hover:scale-110 group-hover:-rotate-3"
        >
          <Icon name={option.icon} size={22} strokeWidth={1.8} />
        </span>
        <span class="text-base font-semibold">{option.title}</span>
        <span class="leading-normal text-text-2">{option.text}</span>
        <span class="mono mt-auto text-xs text-text-2">{option.hint}</span>
      </button>
    {/each}
  </div>

  <div
    class="stagger flex flex-wrap items-center gap-4 rounded-lg border-2 border-dashed border-line-strong bg-surface px-5 py-4"
    style:--i="4"
  >
    <span class="flex text-text-2"><Icon name="upload" size={22} /></span>
    <span class="min-w-55 flex-1 text-sm">
      Atau seret berkas <strong>.gan</strong> atau <strong>.rentang</strong> ke mana saja di halaman ini.
    </span>
    <button
      type="button"
      class="btn h-10"
      onclick={() => {
        void store.getState().openDemo()
      }}
    >
      <Icon name="sparkles" />
      Coba dengan proyek demo
    </button>
  </div>
</main>
