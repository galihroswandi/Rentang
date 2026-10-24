<script lang="ts">
  import Dialog from '../dialog/Dialog.svelte'

  type Props = {
    open: boolean
    name: string
    onClose: () => void
    onSubmit: (name: string) => void
  }
  let { open, name, onClose, onSubmit }: Props = $props()

  let value = $state('')
  let input: HTMLInputElement | undefined = $state()
  const valid = $derived(value.trim().length > 0)

  // Each time the dialog opens it starts from the current name.
  $effect(() => {
    if (open) value = name
  })

  function submit(event: SubmitEvent): void {
    event.preventDefault()
    if (valid) onSubmit(value)
  }
</script>

<Dialog
  {open}
  onOpenChange={(next) => {
    if (!next) onClose()
  }}
  title="Ubah nama proyek"
  width={460}
  initialFocus={() => input}
>
  <form id="rename-project" class="flex flex-col gap-1.5" onsubmit={submit}>
    <label for="rename-project-name" class="label">Nama proyek</label>
    <input
      bind:this={input}
      id="rename-project-name"
      class="field"
      bind:value
      required
      autocomplete="off"
    />
  </form>

  {#snippet footer()}
    <button type="button" class="btn h-10" onclick={onClose}>Batal</button>
    <button type="submit" form="rename-project" class="btn-primary h-10 px-4" disabled={!valid}
      >Simpan nama</button
    >
  {/snippet}
</Dialog>
