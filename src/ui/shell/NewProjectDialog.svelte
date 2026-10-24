<script lang="ts">
  import type { Area } from '../../core/model.ts'
  import Dialog from '../dialog/Dialog.svelte'
  import { AREA_LABELS, AREA_ORDER } from '../labels.ts'
  import { useApp } from './context.ts'

  const { store, ui } = useApp()

  let name = $state('')
  let area: Area = $state('work')
  let nameInput: HTMLInputElement | undefined = $state()
  const valid = $derived(name.trim().length > 0)

  function close(): void {
    ui.newProjectOpen = false
    name = ''
    area = 'work'
  }

  async function create(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!valid) return
    const chosen = { name, area }
    close()
    await store.getState().createProject(chosen.name, chosen.area)
  }
</script>

<Dialog
  open={ui.newProjectOpen}
  onOpenChange={(open) => {
    if (!open) close()
  }}
  title="Proyek baru"
  width={460}
  initialFocus={() => nameInput}
>
  {#snippet description()}Mulai dari nol. Tugas, orang, dan role bisa ditambahkan setelahnya.{/snippet}

  <form id="new-project" class="flex flex-col gap-4" onsubmit={create}>
    <div class="flex flex-col gap-1.5">
      <label for="new-project-name" class="label">Nama proyek</label>
      <input
        bind:this={nameInput}
        id="new-project-name"
        class="field"
        bind:value={name}
        required
        autocomplete="off"
        placeholder="Misalnya: Peluncuran Toko Roti"
      />
    </div>
    <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend class="label mb-1.5">Bidang</legend>
      <div class="grid grid-cols-3 gap-2">
        {#each AREA_ORDER as option (option)}
          <label
            class={[
              'press flex h-10 items-center justify-center gap-2 rounded-md border text-[13px]',
              area === option
                ? 'border-accent-border bg-accent-soft font-semibold text-text'
                : 'border-line-strong text-text-2 hover:border-text-3',
            ]}
          >
            <input type="radio" name="area" value={option} bind:group={area} class="sr-only" />
            {AREA_LABELS[option]}
          </label>
        {/each}
      </div>
    </fieldset>
  </form>

  {#snippet footer()}
    <button type="button" class="btn h-10" onclick={close}>Batal</button>
    <button type="submit" form="new-project" class="btn-primary h-10 px-4" disabled={!valid}
      >Buat proyek</button
    >
  {/snippet}
</Dialog>
