<script lang="ts">
  import Dialog from '../dialog/Dialog.svelte'
  import { useApp } from './context.ts'

  const { store, ui } = useApp()

  let name = $state('')
  let nameInput: HTMLInputElement | undefined = $state()
  const valid = $derived(name.trim().length > 0)

  function close(): void {
    ui.newProjectOpen = false
    name = ''
  }

  async function create(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!valid) return
    const projectName = name
    close()
    await store.getState().createProject(projectName, 'work')
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
  </form>

  {#snippet footer()}
    <button type="button" class="btn h-10" onclick={close}>Batal</button>
    <button type="submit" form="new-project" class="btn-primary h-10 px-4" disabled={!valid}
      >Buat proyek</button
    >
  {/snippet}
</Dialog>
